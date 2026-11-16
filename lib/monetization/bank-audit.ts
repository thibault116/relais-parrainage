import {query} from "./db";
type Audit={requestId:string;owner:string;actor:string;action:string;from:string;to:string;revision:number;reference?:string;reason?:string;key?:string};
export async function auditBank(q:typeof query,a:Audit) {
  const id=crypto.randomUUID();
  await q("INSERT INTO money_bank_audit(id,request_id,owner_id,actor_id,action,from_state,to_state,revision,reference,reason,request_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [id,a.requestId,a.owner,a.actor,a.action,a.from,a.to,a.revision,a.reference||"",a.reason||"",a.key||null,new Date().toISOString()]);
  return id;
}
