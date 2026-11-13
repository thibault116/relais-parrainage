import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type Stripe from "stripe";
import StripeSDK from "stripe";
import {query,database} from "../lib/db";
import {migrateMonetization,saveService,book,bookingAction,entry,balance,moneyTransaction} from "../lib/monetization/store";
import {connectOverview,createConnectAccount,connectOnboarding,connectEmbeddedSession,requestConnectWithdrawal,resumeConnectWithdrawal,refreshConnectWithdrawals,handleConnectEvent} from "../lib/monetization/connect";
import {GET,POST} from "../app/api/admin/monetization/connect/route";
import {POST as webhook} from "../app/api/stripe/webhook/route";
import {getAuth} from "../lib/auth";
import {getMigrations} from "better-auth/db/migration";

if(process.env.DATABASE_URL || process.env.VERCEL) throw Error("Tests locaux isolés uniquement.");
const cwd=process.cwd(),dir=await mkdtemp(join(tmpdir(),"mentora-connect-"));process.chdir(dir);
const previousKey=process.env.STRIPE_SECRET_KEY,previousSecret=process.env.STRIPE_WEBHOOK_SECRET,previousConnectSecret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
const previousPublic=process.env.STRIPE_PUBLISHABLE_KEY,previousNextPublic=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
try {
  await migrateMonetization();
  const auth=getAuth();await (await getMigrations(auth.options)).runMigrations();
  await query("CREATE TABLE IF NOT EXISTS moderators(user_id TEXT PRIMARY KEY,email TEXT)");
  await query("CREATE TABLE IF NOT EXISTS member_activity(user_id TEXT PRIMARY KEY,last_active_at TEXT NOT NULL)");
  assert.equal((await GET(new Request("http://localhost:3000/api/admin/monetization/connect"))).status,403);
  const member=await auth.api.signUpEmail({body:{name:"Membre test",email:"member-connect@example.test",password:"test-password-123456"},asResponse:true});
  const cookie=member.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");assert(cookie);
  for(const method of ["GET","POST"]) {
    const req=new Request("http://localhost:3000/api/admin/monetization/connect",{method,headers:{cookie,origin:"http://localhost:3000","Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({action:"setup",country:"FR",acknowledgeTest:true,owner_id:"owner"})}:{})});
    assert.equal((await (method==="GET"?GET(req):POST(req))).status,403);
  }
  for(const action of ["session","withdraw","onboarding","dashboard","refresh"]) {
    const req=new Request("http://localhost:3000/api/admin/monetization/connect",{method:"POST",headers:{cookie,origin:"http://localhost:3000","Content-Type":"application/json"},body:JSON.stringify({action,mode:"onboarding",account:"acct_owner"})});
    assert.equal((await POST(req)).status,403);
  }
  const memberData=await member.json();
  await query("INSERT INTO moderators(user_id,email) VALUES($1,$2)",[memberData.user.id,memberData.user.email]);
  assert.equal((await GET(new Request("http://localhost:3000/api/admin/monetization/connect",{headers:{cookie}}))).status,403);
  const owner="owner",other="other";
  await query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,1,$3,$3)',[owner,"thibault.cordiez@hotmail.com",new Date().toISOString()]);
  await query("INSERT INTO moderators(user_id,email) VALUES($1,$2)",[owner,"thibault.cordiez@hotmail.com"]);
  const accounts=new Map<string,Stripe.Account>();
  const transfers=new Map<string,Stripe.Transfer>(),payouts=new Map<string,Stripe.Payout>();
  let transferCalls=0,payoutCalls=0,failTransfer=false,failPayout=false,timeoutPayout=false,connectedBalance=100000,live=false;
  let bankStatus="paid",sessionLive=false,sessionAccount="acct_owner",sessionExpired=false;
  const fake={accounts:{create:async(params:any)=>{
    assert.equal(params.type,undefined);assert.equal(params.settings.payouts.schedule.interval,"manual");
    assert.equal(params.capabilities.card_payments.requested,true);assert.equal(params.capabilities.transfers.requested,true);
    const account={id:`acct_${params.metadata.mentora_owner}`,controller:{is_controller:true},metadata:params.metadata,payouts_enabled:true,details_submitted:true,settings:{payouts:{schedule:{interval:"manual"}}},capabilities:{transfers:"active"},requirements:{currently_due:[],pending_verification:[]},external_accounts:{data:[{object:"bank_account",bank_name:"TEST",last4:"2606",currency:"eur"}]}} as unknown as Stripe.Account;
    accounts.set(account.id,account);return account;
  },retrieve:async(id:string)=>accounts.get(id)!,createLoginLink:async()=>({url:"https://connect.stripe.com/test-login"})},
  accountSessions:{create:async(params:any)=>{
    assert.equal(params.account,"acct_owner");
    assert.equal(Object.keys(params.components).length,1);
    const key=Object.keys(params.components)[0];
    assert(["account_onboarding","account_management"].includes(key));
    assert.deepEqual(params.components[key],{enabled:true,features:{external_account_collection:true}});
    return {account:sessionAccount,livemode:sessionLive,client_secret:"fixture-ephemeral-secret",expires_at:Math.floor(Date.now()/1000)+(sessionExpired?-1:3600)};
  }},
  accountLinks:{create:async(params:any)=>{assert.equal(params.account,"acct_owner");assert.equal(params.type,"account_onboarding");assert.equal(params.collection_options.fields,"currently_due");return {url:"https://connect.stripe.com/test-onboarding"};}},
  balance:{retrieve:async(_params:any,options:any)=>{if(options?.stripeAccount)assert(accounts.has(options.stripeAccount));return {livemode:live,available:[{currency:"eur",amount:options?.stripeAccount?connectedBalance:100000}],pending:[]};}},
  transfers:{create:async(params:any,options:any)=>{
    if(failTransfer)throw {statusCode:400,code:"balance_insufficient",message:"Solde plateforme insuffisant"};
    assert.equal(params.destination,"acct_owner");
    if(!transfers.has(options.idempotencyKey)){transferCalls++;transfers.set(options.idempotencyKey,{id:`tr_${transferCalls}`,livemode:false,...params} as Stripe.Transfer);}
    return transfers.get(options.idempotencyKey);
  }},payouts:{create:async(params:any,options:any)=>{
    assert.equal(options.stripeAccount,"acct_owner");
    if(failPayout)throw {statusCode:400,code:"amount_too_small",message:"Montant inférieur au minimum"};
    if(!payouts.has(options.idempotencyKey)){payoutCalls++;payouts.set(options.idempotencyKey,{id:`po_${payoutCalls}`,livemode:false,status:"pending",...params} as Stripe.Payout);}
    if(timeoutPayout)throw Error("Réponse réseau perdue après création Stripe");
    return payouts.get(options.idempotencyKey);
  },retrieve:async(id:string,_params:any,options:any)=>{assert.equal(options.stripeAccount,"acct_owner");return {...Array.from(payouts.values()).find(p=>p.id===id),status:bankStatus};}}} as unknown as Stripe;
  const client=()=>fake;
  await createConnectAccount({id:owner,email:"owner@example.test"},"FR",client);
  assert.equal((await createConnectAccount({id:owner,email:"owner@example.test"},"FR",client)).id,"acct_owner");
  await assert.rejects(()=>createConnectAccount({id:owner,email:"owner@example.test"},"US",client),/autre pays/);
  assert.equal(await connectOnboarding(owner,client),"https://connect.stripe.com/test-onboarding");
  await assert.rejects(()=>connectOnboarding(other,client),/Configure/);
  delete process.env.STRIPE_PUBLISHABLE_KEY;delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  await assert.rejects(()=>connectEmbeddedSession(owner,"onboarding",client),/publique Stripe/);
  process.env.STRIPE_PUBLISHABLE_KEY="pk_live_fixture";
  await assert.rejects(()=>connectEmbeddedSession(owner,"onboarding",client),/publique Stripe/);
  process.env.STRIPE_PUBLISHABLE_KEY="pk_test_fixture";
  for(const mode of ["onboarding","management"]) {
    assert.deepEqual(await connectEmbeddedSession(owner,mode,client),{publishableKey:"pk_test_fixture",clientSecret:"fixture-ephemeral-secret"});
  }
  await assert.rejects(()=>connectEmbeddedSession(owner,"payouts",client));
  await assert.rejects(()=>connectEmbeddedSession(other,"onboarding",client),/Configure/);
  sessionLive=true;await assert.rejects(()=>connectEmbeddedSession(owner,"onboarding",client),/incompatible/);sessionLive=false;
  sessionAccount="acct_foreign";await assert.rejects(()=>connectEmbeddedSession(owner,"management",client),/incompatible/);sessionAccount="acct_owner";
  sessionExpired=true;await assert.rejects(()=>connectEmbeddedSession(owner,"management",client),/incompatible/);sessionExpired=false;
  const ownAccount=accounts.get("acct_owner")!;
  ownAccount.metadata!.mentora_owner=other;
  await assert.rejects(()=>connectEmbeddedSession(owner,"onboarding",client),/associé/);
  ownAccount.metadata!.mentora_owner=owner;
  live=true;await assert.rejects(()=>connectEmbeddedSession(owner,"onboarding",client),/réel/);live=false;
  live=true;await assert.rejects(()=>connectOverview(owner,client),/réel/);live=false;
  const service=await saveService(owner,{title:"Conseils test",description:"Une prestation de conseil en achat-revente pour tests.",category:"Conseil",duration:0,calls:0,followup:"",availability:"Messages",credits:10,capacity:50,published:true});
  await moneyTransaction(async q=>{await entry(q,owner,1000,"fixture","connect-fixture");});
  async function completed() {const id=String(await book(owner,service,crypto.randomUUID(),"Objectif de test","Flexible"));await bookingAction(owner,id,"accept");await bookingAction(owner,id,"complete");return id;}
  const first=await completed();const creditsBefore=await balance(query,owner);
  const key=crypto.randomUUID();
  const [one,two]=await Promise.all([requestConnectWithdrawal(owner,key,client),requestConnectWithdrawal(owner,key,client)]);
  assert.equal(one.id,two.id);assert.equal(one.payout_id,two.payout_id);assert.equal(transferCalls,1);assert.equal(payoutCalls,1);
  assert.equal((await connectOverview(owner,client)).availableCents,0);
  assert.equal(await balance(query,owner),creditsBefore);
  await assert.rejects(()=>bookingAction(owner,first,"refund"),/réservée ou transférée/);
  await assert.rejects(()=>resumeConnectWithdrawal(other,one.id,crypto.randomUUID(),client),/introuvable/);
  await refreshConnectWithdrawals(owner,client);
  assert.equal((await connectOverview(owner,client)).withdrawals[0].status,"paid");
  assert.equal((await connectOverview(other,client)).withdrawals.length,0);
  // Two different request keys still cannot reserve the same earnings twice.
  await completed();
  const concurrent=await Promise.allSettled([requestConnectWithdrawal(owner,crypto.randomUUID(),client),requestConnectWithdrawal(owner,crypto.randomUUID(),client)]);
  assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);
  // Platform transfer failure releases gains; payout failure never transfers twice.
  await completed();failTransfer=true;
  const failed=await requestConnectWithdrawal(owner,crypto.randomUUID(),client);assert.equal(failed.status,"failed");
  assert((await connectOverview(owner,client)).availableCents>0);failTransfer=false;failPayout=true;
  const rejected=await requestConnectWithdrawal(owner,crypto.randomUUID(),client);assert.equal(rejected.status,"payout_failed");
  assert.equal((await connectOverview(owner,client)).availableCents,0);const transferred=transferCalls;
  failPayout=false;
  const resumed=await resumeConnectWithdrawal(owner,rejected.id,crypto.randomUUID(),client);
  assert.equal(resumed.status,"pending");assert.equal(transferCalls,transferred);
  // A response lost after Stripe creates a payout is recovered idempotently.
  await completed();timeoutPayout=true;
  const uncertain=await requestConnectWithdrawal(owner,crypto.randomUUID(),client);assert.equal(uncertain.status,"uncertain");
  const beforeRetry=payoutCalls;timeoutPayout=false;
  assert.equal((await resumeConnectWithdrawal(owner,uncertain.id,crypto.randomUUID(),client)).status,"pending");assert.equal(payoutCalls,beforeRetry);
  // Pending settlements may take several days; a never-started payout remains resumable.
  await completed();connectedBalance=0;
  const funded=await requestConnectWithdrawal(owner,crypto.randomUUID(),client);assert.equal(funded.status,"funded");
  await query("UPDATE money_connect_withdrawals SET created_at=$1 WHERE id=$2",[new Date(Date.now()-3*86400000).toISOString(),funded.id]);connectedBalance=100000;
  assert.equal((await resumeConnectWithdrawal(owner,funded.id,crypto.randomUUID(),client)).status,"pending");
  // A foreign account/metadata or a live balance must never be accepted.
  const own=accounts.get("acct_owner")!;accounts.set("acct_owner",{...own,metadata:{mentora_owner:other,mentora_connect_test:"1"}});
  await assert.rejects(()=>connectOverview(owner,client),/associé/);accounts.set("acct_owner",own);
  await assert.rejects(()=>handleConnectEvent({livemode:true} as Stripe.Event,client),/réel/);
  await handleConnectEvent({id:"evt_unknown",account:"acct_unrelated",livemode:false,type:"payout.paid"} as Stripe.Event,client);
  for(const item of (await connectOverview(owner,client)).withdrawals.filter(w=>w.payout_id && w.status==="pending")) {
    const event={id:"evt_connect_"+item.id,account:"acct_owner",livemode:false,type:"payout.paid",data:{object:{id:item.payout_id}}} as Stripe.Event;
    await handleConnectEvent(event,client);await handleConnectEvent(event,client);
  }
  assert.equal((await connectOverview(owner,client)).withdrawals.filter(w=>w.status==="pending").length,0);
  bankStatus="failed";
  const lateFailure={id:"evt_late_failure",account:"acct_owner",livemode:false,type:"payout.failed",data:{object:{id:one.payout_id}}} as Stripe.Event;
  await handleConnectEvent(lateFailure,client);
  assert.equal((await connectOverview(owner,client)).withdrawals.find(w=>w.id===one.id)?.status,"payout_failed");
  bankStatus="paid";await handleConnectEvent(lateFailure,client);
  assert.equal((await connectOverview(owner,client)).withdrawals.find(w=>w.id===one.id)?.status,"payout_failed");
  process.env.STRIPE_SECRET_KEY="sk_test_fixture_connect";process.env.STRIPE_WEBHOOK_SECRET="whsec_fixture_connect";
  assert.equal((await webhook(new Request("http://localhost/api/stripe/webhook",{method:"POST",body:"{}"}))).status,400);
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET="whsec_fixture_connect_separate";
  const event=JSON.stringify({id:"evt_connect_foreign",account:"acct_unrelated",livemode:false,type:"payout.paid",data:{object:{id:"po_foreign"}}});
  const signature=new StripeSDK("sk_test_fixture").webhooks.generateTestHeaderString({payload:event,secret:process.env.STRIPE_CONNECT_WEBHOOK_SECRET});
  assert.equal((await webhook(new Request("http://localhost/api/stripe/webhook",{method:"POST",headers:{"stripe-signature":signature},body:event}))).status,200);
  delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  console.log("PASS sessions intégrées privées, permissions minimales, mauvaise clé, mode réel, compte étranger et session expirée refusés");
  console.log("PASS accès anonyme et membre refusés, comptes Connect isolés et mode réel rejeté");
  console.log("PASS prestations terminées uniquement, crédits inchangés, remboursement d’un gain réservé bloqué");
  console.log("PASS doubles clics et demandes concurrentes, un seul transfert et un seul payout");
  console.log("PASS solde insuffisant, échec bancaire, réseau incertain, reprise sans double virement");
  console.log("PASS règlement différé, confirmation Stripe et événements Connect répétés ou étrangers");
} finally {
  if(previousKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previousKey;
  if(previousSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=previousSecret;
  if(previousConnectSecret===undefined)delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;else process.env.STRIPE_CONNECT_WEBHOOK_SECRET=previousConnectSecret;
  if(previousPublic===undefined)delete process.env.STRIPE_PUBLISHABLE_KEY;else process.env.STRIPE_PUBLISHABLE_KEY=previousPublic;
  if(previousNextPublic===undefined)delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=previousNextPublic;
  const db=database();if("close" in db)db.close();process.chdir(cwd);await rm(dir,{recursive:true,force:true});
}
