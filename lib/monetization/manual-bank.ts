import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isValidIBAN } from "ibantools";
import { z } from "zod";
import { query } from "../db";
import { balance, lock, moneyTransaction } from "./store";
import { eligibleSql } from "./connect";

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
type RequestRow={id:string;amount_cents:number;status:string;created_at:string};
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
function unseal(owner:string,purpose:string,payload:string):Bank {
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
export async function manualBankOverview(owner:string) {
  const [saved,earnings,requests,connect]=await Promise.all([
    query<SavedBank>("SELECT * FROM money_bank_details WHERE owner_id=$1",[owner]),query(eligibleSql,[owner]),
    query<RequestRow>("SELECT id,amount_cents,status,created_at FROM money_bank_requests WHERE owner_id=$1 ORDER BY created_at DESC",[owner]),
    query<RequestRow>("SELECT id,amount_cents,status,created_at FROM money_connect_withdrawals WHERE owner_id=$1 ORDER BY created_at DESC",[owner]),
  ]);
  // Return a masked bank only, never the IBAN or encrypted snapshots.
  return {testMode:true,configured:bankStorageConfigured(),bank:saved[0]?summary(unseal(owner,"saved",saved[0].payload)):null,
    availableCents:earnings.reduce((n,e)=>n+Number(e.payout_cents),0),
    history:[...requests.map(r=>({...r,kind:"manual"})),...connect.map(r=>({...r,kind:"stripe"}))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),
  };
}
export async function requestBankTransfer(owner:string,requestKey:unknown) {
  const reference=`${owner}:${uuid.parse(requestKey)}`;
  return moneyTransaction(async q=>{
    await lock(q,owner);
    const existing=(await q<{id:string;amount_cents:number;status:string}>("SELECT id,amount_cents,status FROM money_bank_requests WHERE owner_id=$1 AND request_key=$2",[owner,reference]))[0];
    if(existing)return existing;
    const saved=(await q<SavedBank>("SELECT * FROM money_bank_details WHERE owner_id=$1",[owner]))[0];
    if(!saved)throw Error("Enregistre ton IBAN avant la demande.");
    const bank=unseal(owner,"saved",saved.payload);
    if(await balance(q,owner)<0)throw Error("Solde de crédits à régulariser.");
    const earnings=await q(eligibleSql,[owner]),amount=earnings.reduce((n,e)=>n+Number(e.payout_cents),0);
    // No platform threshold; a positive amount of one cent is accepted.
    if(!Number.isSafeInteger(amount)||amount<=0)throw Error("Aucun gain disponible.");
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await q("INSERT INTO money_bank_requests(id,owner_id,request_key,amount_cents,bank_snapshot,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$6)",[id,owner,reference,amount,seal(owner,`request:${id}`,bank),now]);
    // Shared allocation lock prevents a second manual OR Stripe payout.
    for(const e of earnings)await q("INSERT INTO money_connect_allocations(booking_id,owner_id,withdrawal_id,amount_cents) VALUES($1,$2,$3,$4)",[String(e.id),owner,id,Number(e.payout_cents)]);
    return {id,amount_cents:amount,status:"pending"};
  });
}
export async function cancelBankTransfer(owner:string,id:unknown) {
  const parsed=uuid.parse(id);
  await moneyTransaction(async q=>{
    await lock(q,owner);
    const row=(await q("SELECT status FROM money_bank_requests WHERE id=$1 AND owner_id=$2",[parsed,owner]))[0];
    if(!row)throw Error("Demande introuvable.");
    if(row.status!=="pending")return;
    await q("UPDATE money_bank_requests SET status='canceled',updated_at=$1 WHERE id=$2 AND owner_id=$3",[new Date().toISOString(),parsed,owner]);
    await q("DELETE FROM money_connect_allocations WHERE withdrawal_id=$1 AND owner_id=$2",[parsed,owner]);
  });
}
