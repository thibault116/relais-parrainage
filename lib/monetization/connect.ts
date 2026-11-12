import type Stripe from "stripe";
import { z } from "zod";
import { query } from "../db";
import { isCrmOwner } from "../crm";
import { lock, moneyTransaction, balance as creditBalance } from "./store";
import { stripeTest, appOrigin } from "./stripe";
import { safeStripeFailure } from "./payout-diagnostics";

type Client = () => Stripe;
type Actor = {id:string;email:string};
type LinkRow = {owner_id:string;account_id:string|null;country:string;creation_key:string;created_at:string};
type Withdrawal = {id:string;owner_id:string;request_key:string;account_id:string;amount_cents:number;transfer_id:string|null;payout_id:string|null;payout_attempt:number;status:string;error:string;created_at:string;updated_at:string};
const returnPath="/?mobile=payouts&connect=return#profile";
const uuid=z.string().uuid();
const countries=z.enum(["FR","BE","CH","LU","DE","ES","IT","GB","US","CA"]);
const reference=(owner:string,key:unknown)=>`${owner}:${uuid.parse(key)}`;
const eligibleSql=`SELECT b.id,b.payout_cents,b.credits,b.snapshot FROM money_bookings b
  JOIN money_services s ON s.id=b.service_id
  LEFT JOIN money_connect_allocations a ON a.booking_id=b.id
  WHERE s.owner_id=$1 AND b.status='completed' AND b.payout_cents>0 AND a.booking_id IS NULL
  ORDER BY b.created_at,b.id`;
function sandbox(balance:Stripe.Balance) {
  if(balance.livemode!==false) throw Error("Mode réel refusé.");
}
function assertAccount(account:Stripe.Account,owner:string,id:string) {
  if(account.id!==id || account.metadata?.mentora_connect_test!=="1" || account.metadata?.mentora_owner!==owner || account.controller?.is_controller!==true)
    throw Error("Ce compte Stripe n’est pas associé à ce parrain dans le test Mentora.");
}
async function connection(owner:string) {
  return (await query<LinkRow>("SELECT * FROM money_connect_accounts WHERE owner_id=$1",[owner]))[0];
}
async function linked(owner:string,s:Stripe) {
  const row=await connection(owner);
  if(!row?.account_id) throw Error("Configure d’abord ton compte bancaire avec Stripe.");
  const account=await s.accounts.retrieve(row.account_id);
  assertAccount(account,owner,row.account_id);
  return account;
}
async function history(owner:string) {
  return query<Withdrawal>("SELECT * FROM money_connect_withdrawals WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",[owner]);
}
async function withdrawal(owner:string,id:string) {
  const row=(await query<Withdrawal>("SELECT * FROM money_connect_withdrawals WHERE id=$1 AND owner_id=$2",[uuid.parse(id),owner]))[0];
  if(!row) throw Error("Retrait introuvable.");
  row.amount_cents=Number(row.amount_cents);row.payout_attempt=Number(row.payout_attempt);
  return row;
}
export async function createConnectAccount(actor:Actor,country:unknown,client:Client=stripeTest) {
  const selected=countries.parse(country),s=client();
  sandbox(await s.balance.retrieve());
  const row=await moneyTransaction(async q=>{
    await lock(q,actor.id);
    await q(`INSERT INTO money_connect_accounts(owner_id,country,creation_key,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id) DO NOTHING`,[actor.id,selected,crypto.randomUUID(),new Date().toISOString()]);
    return (await q<LinkRow>("SELECT * FROM money_connect_accounts WHERE owner_id=$1",[actor.id]))[0];
  });
  if(row.country!==selected) throw Error("Un compte existe déjà pour un autre pays. Reprends sa configuration.");
  if(row.account_id) return linked(actor.id,s);
  if(Date.now()-Date.parse(row.created_at)>23*3600000) throw Error("Création ancienne non confirmée : vérifie les comptes Connect dans Stripe avant de recommencer.");
  let account:Stripe.Account;
  try {account=await s.accounts.create({
    country:selected,
    controller:{fees:{payer:"application"},losses:{payments:"application"},requirement_collection:"stripe",stripe_dashboard:{type:"express"}},
    capabilities:{transfers:{requested:true}},
    settings:{payouts:{schedule:{interval:"manual"}}},
    metadata:{mentora_owner:actor.id,mentora_connect_test:"1"},
  },{idempotencyKey:`mentora-connect-test:${row.creation_key}`});}
  catch(failure) {
    // A definitive validation refusal created no account; don't trap setup in
    // an expired ambiguous request after the platform configuration is fixed.
    if(definitive(failure)) await query("DELETE FROM money_connect_accounts WHERE owner_id=$1 AND creation_key=$2 AND account_id IS NULL",[actor.id,row.creation_key]);
    throw failure;
  }
  assertAccount(account,actor.id,account.id);
  sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  await query("UPDATE money_connect_accounts SET account_id=$1 WHERE owner_id=$2 AND (account_id IS NULL OR account_id=$1)",[account.id,actor.id]);
  return account;
}
export async function connectOnboarding(owner:string,client:Client=stripeTest) {
  const s=client(),account=await linked(owner,s);
  sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  const link=await s.accountLinks.create({account:account.id,type:"account_onboarding",
    return_url:appOrigin()+returnPath,
    refresh_url:appOrigin()+"/?mobile=payouts&connect=refresh#profile",
    collection_options:{fields:"eventually_due"},
  });
  const url=new URL(link.url);
  if(url.protocol!=="https:" || !url.hostname.endsWith(".stripe.com")) throw Error("Lien Stripe inattendu.");
  return link.url;
}
export async function connectDashboard(owner:string,client:Client=stripeTest) {
  const s=client(),account=await linked(owner,s);
  sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  const result=await s.accounts.createLoginLink(account.id);
  const url=new URL(result.url);
  if(url.protocol!=="https:" || !url.hostname.endsWith(".stripe.com")) throw Error("Lien Stripe inattendu.");
  return result.url;
}
export async function connectOverview(owner:string,client:Client=stripeTest) {
  const [row,earnings,withdrawals,totals]=await Promise.all([connection(owner),query(eligibleSql,[owner]),history(owner),query("SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) AS paid,COALESCE(SUM(CASE WHEN status NOT IN ('paid','failed') THEN amount_cents ELSE 0 END),0) AS reserved FROM money_connect_withdrawals WHERE owner_id=$1",[owner])]);
  const availableCents=earnings.reduce((sum,item)=>sum+Number(item.payout_cents),0);
  const paidCents=Number(totals[0].paid),reservedCents=Number(totals[0].reserved);
  const result={testMode:true,availableCents,paidCents,reservedCents,withdrawals,earnings:earnings.map(e=>({id:e.id,title:JSON.parse(String(e.snapshot)).title,cents:Number(e.payout_cents)}))};
  if(!row?.account_id) return {...result,account:null,country:row?.country};
  const s=client(),account=await linked(owner,s),balance=await s.balance.retrieve({},{stripeAccount:account.id});
  sandbox(balance);
  const banks=account.external_accounts?.data.filter(b=>b.object==="bank_account").map(b=>({bankName:b.bank_name,last4:b.last4,currency:b.currency})) || [];
  return {...result,country:row.country,account:{id:account.id,detailsSubmitted:account.details_submitted,payoutsEnabled:account.payouts_enabled,transfersActive:account.capabilities?.transfers==="active",requirementsCount:account.requirements?.currently_due?.length || 0,pendingVerificationCount:account.requirements?.pending_verification?.length || 0,banks,availableCents:balance.available.find(b=>b.currency==="eur")?.amount || 0,pendingCents:balance.pending.find(b=>b.currency==="eur")?.amount || 0}};
}
function expired(row:Withdrawal) {
  if(Date.now()-Date.parse(row.created_at)>23*3600000) throw Error("Ancien retrait : vérifie les objets Stripe avant toute reprise pour éviter un double virement.");
}
function definitive(failure:unknown) {
  const code=(failure as {statusCode?:number}).statusCode;
  return !!code && code>=400 && code<500 && code!==409 && code!==429;
}
async function fail(row:Withdrawal,failure:unknown,phase:"transfer"|"payout") {
  const error=safeStripeFailure(failure),certain=definitive(failure);
  await moneyTransaction(async q=>{
    await lock(q,row.owner_id);
    const current=(await q<Withdrawal>("SELECT * FROM money_connect_withdrawals WHERE id=$1 AND owner_id=$2",[row.id,row.owner_id]))[0];
    if(!current || current.status==="paid" || current.payout_id || (phase==="transfer" && current.transfer_id) || Number(current.payout_attempt)!==row.payout_attempt) return;
    await q("UPDATE money_connect_withdrawals SET status=$1,error=$2,updated_at=$3 WHERE id=$4",[
      certain?(phase==="transfer"?"failed":"payout_failed"):"uncertain",`${phase==="transfer"?"Transfert vers ton compte Stripe":"Retrait bancaire"} : ${error.message} [${error.code}]`,new Date().toISOString(),row.id]);
    if(certain && phase==="transfer") await q("DELETE FROM money_connect_allocations WHERE withdrawal_id=$1 AND owner_id=$2",[row.id,row.owner_id]);
  });
}
async function recordPayout(row:Withdrawal,p:Stripe.Payout) {
  if(p.livemode!==false || p.amount!==row.amount_cents || p.currency!=="eur" || p.metadata?.mentora_connect_withdrawal!==row.id || p.metadata?.mentora_owner!==row.owner_id || p.metadata?.mentora_attempt!==String(row.payout_attempt)) throw Error("Réponse Stripe incompatible avec ce retrait.");
  const status=p.status==="paid"?"paid":["failed","canceled"].includes(p.status)?"payout_failed":"pending";
  await query("UPDATE money_connect_withdrawals SET payout_id=$1,status=$2,error=$3,updated_at=$4 WHERE id=$5 AND owner_id=$6 AND payout_attempt=$7 AND status<>'paid'",[p.id,status,p.failure_message || "",new Date().toISOString(),row.id,row.owner_id,row.payout_attempt]);
}
async function executeWithdrawal(owner:string,id:string,s:Stripe) {
  let row=await withdrawal(owner,id);
  if(["paid","failed"].includes(row.status)) return row;
  const account=await linked(owner,s);
  if(account.id!==row.account_id || !account.payouts_enabled || account.capabilities?.transfers!=="active") throw Error("Stripe doit valider ton identité et ton compte bancaire avant le retrait.");
  if(account.settings?.payouts?.schedule?.interval!=="manual") throw Error("Le compte Stripe doit utiliser les virements manuels pour ce parcours. Vérifie son calendrier dans Stripe avant de poursuivre.");
  sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  if(row.payout_id) {
    const payout=await s.payouts.retrieve(row.payout_id,{},{stripeAccount:account.id});
    await recordPayout(row,payout);
    return withdrawal(owner,id);
  }
  if(!row.transfer_id) {
    expired(row);
    try {
      const transfer=await s.transfers.create({amount:row.amount_cents,currency:"eur",destination:account.id,transfer_group:`mentora:${row.id}`,metadata:{mentora_owner:owner,mentora_connect_withdrawal:row.id}}, {idempotencyKey:`mentora-connect-transfer:${row.id}`});
      if(transfer.livemode!==false || transfer.amount!==row.amount_cents || transfer.currency!=="eur" || (typeof transfer.destination==="string"?transfer.destination:transfer.destination?.id)!==account.id || transfer.metadata?.mentora_owner!==owner || transfer.metadata?.mentora_connect_withdrawal!==row.id) throw Error("Transfert Stripe incompatible. Vérification manuelle nécessaire.");
      await query("UPDATE money_connect_withdrawals SET transfer_id=$1,status='funded',error='',updated_at=$2 WHERE id=$3 AND owner_id=$4 AND transfer_id IS NULL",[transfer.id,new Date().toISOString(),row.id,owner]);
    } catch(error) {await fail(row,error,"transfer");return withdrawal(owner,id);}
    row=await withdrawal(owner,id);
  }
  try {
    const balance=await s.balance.retrieve({},{stripeAccount:account.id});sandbox(balance);
    if((balance.available.find(b=>b.currency==="eur")?.amount || 0)<row.amount_cents) {
      await query("UPDATE money_connect_withdrawals SET status='funded',error=$1,updated_at=$2 WHERE id=$3 AND status NOT IN ('pending','paid')",["Les gains sont transférés à ton compte Stripe, mais ne sont pas encore disponibles pour le virement bancaire.",new Date().toISOString(),row.id]);
      return withdrawal(owner,id);
    }
    await query("INSERT INTO money_connect_attempts(withdrawal_id,attempt,started_at) VALUES($1,$2,$3) ON CONFLICT(withdrawal_id,attempt) DO NOTHING",[row.id,row.payout_attempt,new Date().toISOString()]);
    const [attempt]=await query("SELECT started_at FROM money_connect_attempts WHERE withdrawal_id=$1 AND attempt=$2",[row.id,row.payout_attempt]);
    if(Date.now()-Date.parse(String(attempt.started_at))>23*3600000) throw Error("Ancienne tentative bancaire non confirmée : vérification Stripe nécessaire avant une nouvelle demande.");
    const payout=await s.payouts.create({amount:row.amount_cents,currency:"eur",method:"standard",description:"Mentora — rémunération de prestations TEST",metadata:{mentora_owner:owner,mentora_connect_withdrawal:row.id,mentora_attempt:String(row.payout_attempt)}},{stripeAccount:account.id,idempotencyKey:`mentora-connect-payout:${row.id}:${row.payout_attempt}`});
    await recordPayout(row,payout);
  } catch(error) {await fail(row,error,"payout");}
  return withdrawal(owner,id);
}
export async function requestConnectWithdrawal(owner:string,key:unknown,client:Client=stripeTest) {
  const requestKey=reference(owner,key),s=client(),account=await linked(owner,s);
  if(!account.payouts_enabled || account.capabilities?.transfers!=="active") throw Error("Finalise ton dossier Stripe avant de retirer tes gains.");
  sandbox(await s.balance.retrieve());sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  const id=await moneyTransaction(async q=>{
    await lock(q,owner);
    const existing=(await q<Withdrawal>("SELECT * FROM money_connect_withdrawals WHERE request_key=$1 AND owner_id=$2",[requestKey,owner]))[0];
    if(existing) return existing.id;
    if(await creditBalance(q,owner)<0) throw Error("Ton solde de crédits est négatif après un remboursement. Vérifie les paiements avant de retirer des gains.");
    const earnings=await q(eligibleSql,[owner]);
    const cents=earnings.reduce((sum,e)=>sum+Number(e.payout_cents),0);
    if(!Number.isSafeInteger(cents) || cents<=0) throw Error("Aucun gain de prestation terminée n’est disponible.");
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await q("INSERT INTO money_connect_withdrawals(id,owner_id,request_key,account_id,amount_cents,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'creating',$6,$6)",[id,owner,requestKey,account.id,cents,now]);
    for(const e of earnings) await q("INSERT INTO money_connect_allocations(booking_id,owner_id,withdrawal_id,amount_cents) VALUES($1,$2,$3,$4)",[String(e.id),owner,id,Number(e.payout_cents)]);
    return id;
  });
  return executeWithdrawal(owner,id,s);
}
export async function resumeConnectWithdrawal(owner:string,id:string,key:unknown,client:Client=stripeTest) {
  const requestKey=reference(owner,key);uuid.parse(id);
  await moneyTransaction(async q=>{
    await lock(q,owner);
    const row=(await q<Withdrawal>("SELECT * FROM money_connect_withdrawals WHERE id=$1 AND owner_id=$2",[id,owner]))[0];
    if(!row) throw Error("Retrait introuvable.");
    const prior=(await q("SELECT withdrawal_id FROM money_connect_retries WHERE request_key=$1 AND owner_id=$2",[requestKey,owner]))[0];
    if(prior && prior.withdrawal_id!==id) throw Error("Référence de reprise invalide.");
    if(!prior && row.status==="payout_failed") {
      await q("INSERT INTO money_connect_retries(request_key,withdrawal_id,owner_id) VALUES($1,$2,$3)",[requestKey,id,owner]);
      await q("UPDATE money_connect_withdrawals SET payout_attempt=payout_attempt+1,payout_id=NULL,status='funded',error='' WHERE id=$1",[id]);
    }
  });
  return executeWithdrawal(owner,id,client());
}
export async function refreshConnectWithdrawals(owner:string,client:Client=stripeTest) {
  const rows=await history(owner);
  if(!rows.some(row=>row.payout_id && row.status==="pending")) return;
  const s=client(),account=await linked(owner,s);sandbox(await s.balance.retrieve({},{stripeAccount:account.id}));
  for(const row of rows.filter(w=>w.payout_id && w.status==="pending").slice(0,20)) {
    if(row.account_id!==account.id) throw Error("Compte du retrait incompatible.");
    row.amount_cents=Number(row.amount_cents);row.payout_attempt=Number(row.payout_attempt);
    await recordPayout(row,await s.payouts.retrieve(row.payout_id!,{},{stripeAccount:account.id}));
  }
}
export async function handleConnectEvent(event:Stripe.Event,client:Client=stripeTest) {
  if(event.livemode) throw Error("Événement réel refusé.");
  if(!event.account) return;
  const row=(await query<LinkRow>("SELECT * FROM money_connect_accounts WHERE account_id=$1",[event.account]))[0];
  if(!row) return;
  const actor=(await query("SELECT id,email FROM \"user\" WHERE id=$1",[row.owner_id]))[0];
  if(!actor || !await isCrmOwner({id:String(actor.id),email:String(actor.email)})) return;
  if(["payout.paid","payout.failed","payout.canceled","payout.updated","payout.created"].includes(event.type))
    await refreshConnectWithdrawals(row.owner_id,client);
  // Account status is always read from Stripe on the next authenticated request.
}
