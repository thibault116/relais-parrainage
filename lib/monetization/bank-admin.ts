import {createHash} from "node:crypto";
import {z} from "zod";
import {query} from "./db";
import {isCrmOwner} from "../crm";
import {lock,moneyTransaction} from "./store";
import {decryptBankSnapshot} from "./manual-bank";
import {auditBank} from "./bank-audit";
import {manualPayoutPolicy} from "./manual-payout-policy";
type Actor={id:string;email:string};
type Row={id:string;owner_id:string;amount_cents:number;bank_snapshot:string;state:string;mode:string;revision:number;reference:string;reason:string;name:string};
const select=`SELECT r.*,w.state,w.mode,w.revision,w.reference,w.reason,COALESCE(p.name,u.name,'Ancien membre') AS name FROM money_bank_requests r JOIN money_bank_workflow w ON w.request_id=r.id LEFT JOIN "user" u ON u.id=r.owner_id LEFT JOIN profiles p ON p.user_id=r.owner_id`;
async function authorize(actor:Actor){if(!await isCrmOwner(actor))throw Error("Accès refusé.");}
export async function adminBankList(actor:Actor,page=0,state="") {
  await authorize(actor);z.number().int().min(0).max(10000).parse(page);
  z.enum(["","pending","processing","paid","refused","canceled"]).parse(state);
  const rows=await query<Row>(select+" WHERE ($1='' OR w.state=$1) ORDER BY r.created_at DESC,r.id LIMIT 50 OFFSET $2",[state,page*50]);
  return {policy:manualPayoutPolicy(),page,items:rows.map(({bank_snapshot,...r})=>r),total:Number((await query("SELECT COUNT(*) AS n FROM money_bank_requests r JOIN money_bank_workflow w ON w.request_id=r.id WHERE ($1='' OR w.state=$1)",[state]))[0].n)};
}
export async function adminBankDetails(actor:Actor,id:string) {
  await authorize(actor);z.string().uuid().parse(id);
  return moneyTransaction(async q=>{
    const [initial]=await q<Row>(select+" WHERE r.id=$1",[id]);if(!initial)throw Error("Demande introuvable.");
    await lock(q,initial.owner_id);
    const [row]=await q<Row>(select+" WHERE r.id=$1",[id]);
    const bank=decryptBankSnapshot(row.owner_id,`request:${id}`,row.bank_snapshot);
    await auditBank(q,{requestId:id,owner:row.owner_id,actor:actor.id,action:"view_bank",from:row.state,to:row.state,revision:Number(row.revision)});
    const audit=await q("SELECT a.id,a.actor_id,a.action,a.from_state,a.to_state,a.reference,a.reason,a.created_at,u.name AS actor_name FROM money_bank_audit a LEFT JOIN \"user\" u ON u.id=a.actor_id WHERE a.request_id=$1 ORDER BY a.created_at,a.id",[id]);
    return {bank,audit};
  });
}
export const bankDecisionSchema=z.object({
  id:z.string().uuid(),action:z.enum(["processing","paid","refused"]),revision:z.number().int().min(0),key:z.string().uuid(),
  reference:z.string().trim().max(120).default(""),reason:z.string().trim().max(500).default(""),confirmed:z.boolean().default(false),
}).strict().superRefine((v,ctx)=>{
  if(v.action==="paid"&&(!v.reference||!v.confirmed))ctx.addIssue({code:"custom",message:"Référence et confirmation requises."});
  if(v.action==="refused"&&v.reason.length<3)ctx.addIssue({code:"custom",message:"Motif requis."});
});
export async function decideBankTransfer(actor:Actor,input:unknown) {
  await authorize(actor);const d=bankDecisionSchema.parse(input),requestKey=`decision:${actor.id}:${d.key}`;
  return moneyTransaction(async q=>{
    const initial=(await q<Row>(select+" WHERE r.id=$1",[d.id]))[0];if(!initial)throw Error("Demande introuvable.");
    await lock(q,initial.owner_id);
    const [prior]=await q("SELECT request_id,action,reference,reason,revision FROM money_bank_audit WHERE request_key=$1",[requestKey]);
    if(prior){if(prior.request_id!==d.id||prior.action!==d.action||prior.reference!==d.reference||prior.reason!==d.reason||Number(prior.revision)!==d.revision+1)throw Error("Référence de décision réutilisée.");return {ok:true,repeated:true};}
    const [row]=await q<Row>(select+" WHERE r.id=$1",[d.id]);
    if(Number(row.revision)!==d.revision)throw Error("La demande a changé. Actualise la liste.");
    const allowed=d.action==="processing"?row.state==="pending":d.action==="paid"?row.state==="processing":["pending","processing"].includes(row.state);
    if(!allowed)throw Error("Changement de statut impossible.");
    if(row.mode==="live"&&!manualPayoutPolicy().liveEnabled&&d.action!=="refused")throw Error("Les versements réels sont désactivés.");
    const revision=Number(row.revision)+1,now=new Date().toISOString();
    const changed=await q("UPDATE money_bank_workflow SET state=$1,revision=$2,reference=$3,reason=$4,updated_at=$5 WHERE request_id=$6 AND revision=$7 RETURNING request_id",[d.action,revision,d.reference,d.reason,now,d.id,d.revision]);
    if(!changed.length)throw Error("La demande a changé. Actualise la liste.");
    if(d.action==="refused")await q("DELETE FROM money_connect_allocations WHERE withdrawal_id=$1 AND owner_id=$2",[d.id,row.owner_id]);
    // Paid allocations are retained to prevent duplicate withdrawals.
    const event=await auditBank(q,{requestId:d.id,owner:row.owner_id,actor:actor.id,action:d.action,from:row.state,to:d.action,revision,reference:d.reference,reason:d.reason,key:requestKey});
    for(const sub of await q("SELECT id FROM push_subscriptions WHERE user_id=$1",[row.owner_id])){
      const id=createHash("sha256").update(`bank:${event}:${sub.id}`).digest("hex");
      await q("INSERT INTO push_outbox(id,subscription_id,user_id,event_id,kind,url,created_at) VALUES($1,$2,$3,$4,'bank_withdrawal',$5,$6) ON CONFLICT(id) DO NOTHING",[id,String(sub.id),row.owner_id,event,"/?mobile=payouts#workspace",now]);
    }
    return {ok:true,repeated:false};
  });
}
