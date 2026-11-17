import {isCrmOwner} from "../crm";
import {query} from "./db";
import {withMoneyMode,billingLive} from "./mode";
import {moneyTransaction,entry,lock,balance} from "./store";
import {plans,checkoutOffer,currentCheckoutCode,isRechargeCode} from "./catalog";
export const walletRevision="credits-v2-admin-2026-11-16";
type Payment={id:string;amount:number;credits:number;refund_amount:number;reversed_credits:number;offer:string|null};
export function repricedPayment(p:Payment){
 if(p.offer){const code=p.offer;
  if(isRechargeCode(code)||/credits-v[23]-|custom-v2-/.test(code))return Number(checkoutOffer(code)?.credits??p.credits);
  if(plans.some(plan=>code===plan.id||code===`${plan.id}-annual`))return Number(checkoutOffer(currentCheckoutCode(code))?.credits??p.credits);
 }
 for(const plan of plans.filter(p=>p.cents>0)){
  if(Number(p.amount)===plan.cents && [10,22,38,700,1600,2800].includes(Number(p.credits)))return plan.credits;
  if(Number(p.amount)===Math.round(plan.cents*12*.8)&&[120,264,456,8400,19200,33600].includes(Number(p.credits)))return plan.credits*12;
 }
 return Math.max(0,Math.floor(Number(p.amount)/2));
}
async function authorized(actor:{id:string;email:string}){if(!await isCrmOwner(actor))throw Error("Accès refusé.");}
export async function testWalletPreview(actor:{id:string;email:string}){
 await authorized(actor);return withMoneyMode("test",async()=>{
 const payments=await query<Payment>("SELECT p.*,o.offer FROM money_payments p LEFT JOIN money_orders o ON o.session_id=p.id WHERE p.owner_id=$1 AND NOT EXISTS(SELECT 1 FROM money_test_reprices r WHERE r.payment_id=p.id)",[actor.id]);
 const adjustments=payments.map(p=>{const target=repricedPayment(p),reversed=Number(p.amount)>0?Math.min(target,Math.ceil(target*Number(p.refund_amount)/Number(p.amount))):target;return {id:p.id,paidCents:Number(p.amount),before:Number(p.credits),after:target,reversed,delta:target-reversed-(Number(p.credits)-Number(p.reversed_credits))};});
 const current=await balance(query,actor.id);return {applied:await hasCurrentTestCredits(actor.id),current,after:current+adjustments.reduce((s,p)=>s+p.delta,0),adjustments};
 });
}
export async function repriceTestWallet(actor:{id:string;email:string}){
 await authorized(actor);return withMoneyMode("test",()=>moneyTransaction(async q=>{
 await lock(q,actor.id);
 const payments=await q<Payment>("SELECT p.*,o.offer FROM money_payments p LEFT JOIN money_orders o ON o.session_id=p.id WHERE p.owner_id=$1 AND NOT EXISTS(SELECT 1 FROM money_test_reprices r WHERE r.payment_id=p.id)",[actor.id]);
 let added=0;for(const p of payments){
 const target=repricedPayment(p),reversed=Number(p.amount)>0?Math.min(target,Math.ceil(target*Number(p.refund_amount)/Number(p.amount))):target;
 const delta=target-reversed-(Number(p.credits)-Number(p.reversed_credits));
 await q("INSERT INTO money_test_reprices(payment_id,owner_id,old_credits,old_reversed,new_credits,new_reversed,delta,version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[p.id,actor.id,Number(p.credits),Number(p.reversed_credits),target,reversed,delta,walletRevision,new Date().toISOString()]);
 await q("UPDATE money_payments SET credits=$1,reversed_credits=$2 WHERE id=$3 AND owner_id=$4",[target,reversed,p.id,actor.id]);
 if(delta)await entry(q,actor.id,delta,"Actualisation du barème de test",`test-reprice:${walletRevision}:${p.id}`);added+=delta;
 }
 await q("INSERT INTO money_test_wallet_updates(owner_id,version,updated_at) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO NOTHING",[actor.id,walletRevision,new Date().toISOString()]);
 return {ok:true,added,balance:await balance(q,actor.id),payments:payments.length};
 }));
}
export async function hasCurrentTestCredits(owner:string){return !billingLive()&&!!(await query("SELECT owner_id FROM money_test_wallet_updates WHERE owner_id=$1",[owner])).length;}
