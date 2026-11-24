import {principalAccount} from "./access";
import {totals as ambassadorTotals} from "../ambassadors/service";
import {allocateManualCommissions} from "../ambassadors/manual-wallet";
import {billingLive} from "./mode";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isValidIBAN } from "ibantools";
import { z } from "zod";
import { query } from "./db";
import { balance, lock, moneyTransaction } from "./store";
import { eligibleSql } from "./earnings";
import {manualPayoutPolicy} from "./manual-payout-policy";
import {auditBank} from "./bank-audit";

const uuid=z.string().uuid();
export const bankDetailsSchema=z.object({
  holder:z.string().trim().min(2).max(120).regex(/^[^\x00-\x1f\x7f]+$/),
  country:z.enum(["FR","BE","OTHER"]),
  iban:z.string().max(80).transform(v=>v.replace(/\s/g,"").toUpperCase()),
}).strict().superRefine((v,ctx)=>{
  if(!isValidIBAN(v.iban))ctx.addIssue({code:"custom",message:"IBAN invalide.",path:["iban"]});
  if(v.country!=="OTHER" && !v.iban.startsWith(v.country))ctx.addIssue({code:"custom",message:"Le pays ne correspond pas à l’IBAN.",path:["country"]});
});
type Bank=z.infer<typeof bankDetailsSchema>;
type SavedBank={owner_id:string;payload:string;updated_at:string};
type RequestRow={id:string;amount_cents:number;status:string;created_at:string;mode?:string;reason?:string;reference?:string};
export function bankStorageConfigured() {return /^[a-f0-9]{64}$/i.test(process.env.BANK_DETAILS_ENCRYPTION_KEY || "");}
function key() {
  if(!bankStorageConfigured())throw Error("Enregistrement bancaire non configuré.");
  return Buffer.from(process.env.BANK_DETAILS_ENCRYPTION_KEY!,"hex");
}
function seal(owner:string,purpose:string,value:Bank) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
  cipher.setAAD(Buffer.from(`mentora-bank:v1:${owner}:${purpose}`));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),data.toString("base64")].join(".");
}
export function decryptBankSnapshot(owner:string,purpose:string,payload:string):Bank {
  const [version,iv,tag,data]=payload.split(".");
  if(version!=="v1")throw Error("Coordonnées bancaires illisibles.");
  try {
    const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64"));
    decipher.setAAD(Buffer.from(`mentora-bank:v1:${owner}:${purpose}`));decipher.setAuthTag(Buffer.from(tag,"base64"));
    return bankDetailsSchema.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,"base64")),decipher.final()]).toString("utf8")));
  } catch {throw Error("Coordonnées bancaires illisibles.");}
}
function summary(bank:Bank) {return {holder:bank.holder,country:bank.country,ibanCountry:bank.iban.slice(0,2),last4:bank.iban.slice(-4)};}
export async function saveBankDetails(owner:string,input:unknown) {
  const bank=bankDetailsSchema.parse(input),payload=seal(owner,"saved",bank);
  await moneyTransaction(async q=>{
    await lock(q,owner);
    await q("INSERT INTO money_bank_details(owner_id,payload,updated_at) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",[owner,payload,new Date().toISOString()]);
  });
  return summary(bank);
}
export async function manualBankOverview(owner:string,includeAmbassadors=false) {
  const [saved,earnings,requests,connect,pending]=await Promise.all([
    query<SavedBank>("SELECT * FROM money_bank_details WHERE owner_id=$1",[owner]),query(eligibleSql,[owner]),
    query<RequestRow>("SELECT r.id,r.amount_cents,COALESCE(w.state,r.status) AS status,r.created_at,COALESCE(w.mode,'test') AS mode,w.reason,w.reference FROM money_bank_requests r LEFT JOIN money_bank_workflow w ON w.request_id=r.id WHERE r.owner_id=$1 ORDER BY r.created_at DESC",[owner]),
    query<RequestRow>("SELECT id,amount_cents,status,created_at FROM money_connect_withdrawals WHERE owner_id=$1 ORDER BY created_at DESC",[owner]),
    query("SELECT COALESCE(SUM(b.payout_cents),0) AS amount FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE s.owner_id=$1 AND b.owner_id<>s.owner_id AND b.test_booking=0 AND b.status IN ('accepted','completion_pending')",[owner]),
  ]);
  if(includeAmbassadors&&!await principalAccount(owner))throw Error("Accès refusé.");
  const commissions=includeAmbassadors?await ambassadorTotals(owner):null;
  const serviceAvailable=earnings.reduce((n,e)=>n+Number(e.payout_cents),0);
  // Return a masked bank only, never the IBAN or encrypted snapshots.
  return {testMode:!billingLive(),withdrawalsEnabled:!billingLive()||manualPayoutPolicy().liveEnabled,configured:bankStorageConfigured(),bank:saved[0]?summary(decryptBankSnapshot(owner,"saved",saved[0].payload)):null,
    pendingCents:Number(pending[0]?.amount||0)+(commissions?.pending||0),
    servicesCents:serviceAvailable,commissionsCents:commissions?.available||0,
    availableCents:Math.max(0,serviceAvailable+(commissions?.available||0)),
    history:[...requests.map(r=>({...r,kind:"manual"})),...connect.map(r=>({...r,kind:"stripe"}))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),
  };
}
export async function requestBankTransfer(owner:string,requestKey:unknown,includeAmbassadors=false) {
  if(billingLive()&&!manualPayoutPolicy().liveEnabled)throw Error("Les versements réels sont désactivés.");
  if(includeAmbassadors&&!await principalAccount(owner))throw Error("Accès refusé.");
  const reference=`${owner}:${uuid.parse(requestKey)}`;
  return moneyTransaction(async q=>{
    await lock(q,owner);
    const existing=(await q<{id:string;amount_cents:number;status:string}>("SELECT r.id,r.amount_cents,COALESCE(w.state,r.status) AS status FROM money_bank_requests r LEFT JOIN money_bank_workflow w ON w.request_id=r.id WHERE r.owner_id=$1 AND r.request_key=$2",[owner,reference]))[0];
    if(existing)return existing;
    const saved=(await q<SavedBank>("SELECT * FROM money_bank_details WHERE owner_id=$1",[owner]))[0];
    if(!saved)throw Error("Enregistre ton IBAN avant la demande.");
    const bank=decryptBankSnapshot(owner,"saved",saved.payload);
    if(await balance(q,owner)<0)throw Error("Solde de crédits à régulariser.");
    const earnings=await q(eligibleSql,[owner]),commission=includeAmbassadors?(await ambassadorTotals(owner,q)).available:0;
    if(commission<0)throw Error("Solde de commissions à régulariser.");
    const amount=earnings.reduce((n,e)=>n+Number(e.payout_cents),0)+commission;
    // No platform threshold; a positive amount of one cent is accepted.
    if(!Number.isSafeInteger(amount)||amount<=0)throw Error("Aucun gain disponible.");
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await q("INSERT INTO money_bank_requests(id,owner_id,request_key,amount_cents,bank_snapshot,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$6)",[id,owner,reference,amount,seal(owner,`request:${id}`,bank),now]);
    await q("INSERT INTO money_bank_workflow(request_id,state,mode,revision,updated_at) VALUES($1,'pending',$2,0,$3)",[id,manualPayoutPolicy().mode,now]);
    await auditBank(q,{requestId:id,owner,actor:owner,action:"created",from:"",to:"pending",revision:0});
    // Shared allocation lock prevents a second manual OR Stripe payout.
    for(const e of earnings)await q("INSERT INTO money_connect_allocations(booking_id,owner_id,withdrawal_id,amount_cents) VALUES($1,$2,$3,$4)",[String(e.id),owner,id,Number(e.payout_cents)]);
    if(commission>0)await allocateManualCommissions(q,owner,id,commission,now);
    return {id,amount_cents:amount,status:"pending"};
  });
}
export async function cancelBankTransfer(owner:string,id:unknown) {
  const parsed=uuid.parse(id);
  await moneyTransaction(async q=>{
    await lock(q,owner);
    const row=(await q("SELECT COALESCE(w.state,r.status) AS status,COALESCE(w.revision,0) AS revision FROM money_bank_requests r LEFT JOIN money_bank_workflow w ON w.request_id=r.id WHERE r.id=$1 AND r.owner_id=$2",[parsed,owner]))[0];
    if(!row)throw Error("Demande introuvable.");
    if(row.status==="canceled")return;
    if(row.status!=="pending")throw Error("Cette demande ne peut plus être annulée.");
    await q("UPDATE money_bank_requests SET status='canceled',updated_at=$1 WHERE id=$2 AND owner_id=$3",[new Date().toISOString(),parsed,owner]);
    await q("UPDATE money_bank_workflow SET state='canceled',revision=revision+1,updated_at=$1 WHERE request_id=$2",[new Date().toISOString(),parsed]);
    await auditBank(q,{requestId:parsed,owner,actor:owner,action:"canceled",from:"pending",to:"canceled",revision:Number(row.revision)+1});
    await q("DELETE FROM money_connect_allocations WHERE withdrawal_id=$1 AND owner_id=$2",[parsed,owner]);
  });
}
