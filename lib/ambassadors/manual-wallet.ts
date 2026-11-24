import { query } from "../monetization/db";
// Commissions allocated to a manual withdrawal stay reserved until refusal/cancellation.
export async function allocateManualCommissions(q:typeof query,owner:string,request:string,amount:number,now:string){
 const rows=await q(`SELECT c.payment_id,c.net_cents,
 COALESCE((SELECT SUM(a.amount_cents) FROM money_ambassador_allocations a JOIN money_ambassador_withdrawals w ON w.id=a.withdrawal_id WHERE a.payment_id=c.payment_id AND w.status NOT IN ('refused','canceled')),0)
 +COALESCE((SELECT SUM(a.amount_cents) FROM money_wallet_commissions a JOIN money_bank_workflow w ON w.request_id=a.request_id WHERE a.payment_id=c.payment_id AND w.state NOT IN ('refused','canceled')),0) AS allocated
 FROM money_ambassador_commissions c WHERE c.owner_id=$1 AND c.available_at<=$2 AND c.fraud_hold=0 AND c.dispute IN ('','won') ORDER BY c.created_at,c.payment_id`,[owner,now]);
 let remaining=amount;
 for(const row of rows){const n=Math.min(remaining,Math.max(0,Number(row.net_cents)-Number(row.allocated)));if(n>0){await q("INSERT INTO money_wallet_commissions(request_id,payment_id,owner_id,amount_cents) VALUES($1,$2,$3,$4)",[request,String(row.payment_id),owner,n]);remaining-=n;}}
 if(remaining!==0)throw Error("Solde de commissions à régulariser.");
}
