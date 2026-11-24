import type Stripe from "stripe";
import { query } from "../monetization/db";
import { lock, moneyTransaction } from "../monetization/store";
import { stripeTest } from "../monetization/stripe";
import { audit, sandboxOnly } from "./service";

export async function verificationStatus(owner:string,provider=stripeTest){
  const [link]=await query("SELECT account_id,country FROM money_connect_accounts WHERE owner_id=$1",[owner]);
  if(!link?.account_id)return {state:"missing",country:null};
  try{const a=await provider().accounts.retrieve(String(link.account_id));if(a.metadata?.mentora_owner!==owner||a.metadata?.mentora_connect_test!=="1")throw Error("Compte incompatible.");return {state:a.details_submitted&&a.payouts_enabled&&a.capabilities?.transfers==="active"&&!a.requirements?.currently_due?.length&&!a.requirements?.past_due?.length?"verified":"incomplete",country:String(link.country)};}catch{return {state:"unavailable",country:String(link.country)}}
}

// Historical reconciliation below remains available; new withdrawals use manual-bank.
export async function requestWithdrawal(actor:string,owner:string,key:string,provider=stripeTest):Promise<string>{throw Error("Utilise le Wallet et les retraits bancaires manuels.");}
export async function refuseWithdrawal(actor: string, id: string, reason: string) {
  sandboxOnly();
  return moneyTransaction(async q => {
    const [r] = await q("SELECT * FROM money_ambassador_withdrawals WHERE id=$1", [id]);
    if (!r) throw Error("Demande introuvable.");
    await lock(q, String(r.owner_id));
    const rows = await q("UPDATE money_ambassador_withdrawals SET status='refused',reason=$1,updated_at=$2 WHERE id=$3 AND status='pending' AND transfer_id IS NULL RETURNING id", [reason, new Date().toISOString(), id]);
    if (!rows.length) throw Error("Seule une demande en attente peut être refusée.");
    await audit(q, actor, String(r.owner_id), "refus-retrait", { id, reason });
  });
}
async function recordPayout(id: string, p: Stripe.Payout) {
  await moneyTransaction(async q=>{
    const [initial]=await q("SELECT owner_id FROM money_ambassador_withdrawals WHERE id=$1",[id]);
    if(!initial)throw Error("Retrait introuvable.");
    await lock(q,String(initial.owner_id));
    const [r] = await q("SELECT * FROM money_ambassador_withdrawals WHERE id=$1", [id]);
    if (!r || p.livemode!==false || p.metadata?.mentora_ambassador_withdrawal !== id || p.metadata?.attempt !== String(r.attempt) || p.amount !== Number(r.amount_cents) || p.currency !== "eur" || r.payout_id&&r.payout_id!==p.id) throw Error("Versement incompatible.");
    const status = p.status === "paid" ? "paid" : ["failed", "canceled"].includes(p.status) ? "payout_failed" : "pending_payout";
    if(["refused","canceled","reversed_review"].includes(String(r.status))||r.status==="paid"&&status==="pending_payout"||r.status==="payout_failed"&&status!=="payout_failed")return;
    await q("UPDATE money_ambassador_withdrawals SET payout_id=$1,status=$2,updated_at=$3 WHERE id=$4 AND attempt=$5", [p.id, status, new Date().toISOString(), id, Number(r.attempt)]);
    if(r.status!==status||r.payout_id!==p.id)await audit(q,"stripe",String(r.owner_id),"statut-versement",{id,payout:p.id,from:r.status,to:status,attempt:r.attempt});
  });
}

export async function approveWithdrawal(actor:string,id:string,provider=stripeTest):Promise<void>{throw Error("Utilise le Wallet et les retraits bancaires manuels.");}
export async function refreshWithdrawal(id: string, provider = stripeTest) {
  sandboxOnly();
  const [r] = await query("SELECT * FROM money_ambassador_withdrawals WHERE id=$1", [id]);
  if (!r?.payout_id) throw Error("Aucun versement connu. Un résultat incertain doit être rapproché dans Stripe.");
  const s=provider(),a=await s.accounts.retrieve(String(r.account_id));
  if(a.metadata?.mentora_owner!==r.owner_id||a.metadata?.mentora_connect_test!=="1")throw Error("Compte incompatible.");
  await recordPayout(id, await s.payouts.retrieve(String(r.payout_id), {}, { stripeAccount: a.id }));
}
export async function ambassadorPayoutEvent(event: Stripe.Event, provider = stripeTest) {
  if (event.livemode || !event.account || !event.type.startsWith("payout.")) return;
  const p = event.data.object as Stripe.Payout;
  if (!p.metadata?.mentora_ambassador_withdrawal) return;
  const [r] = await query("SELECT * FROM money_ambassador_withdrawals WHERE id=$1 AND account_id=$2", [p.metadata.mentora_ambassador_withdrawal, event.account]);
  if (!r || Number(r.attempt) !== Number(p.metadata.attempt)) return;
  // A signed webhook can recover an API timeout before payout_id was persisted.
  await recordPayout(String(r.id),await provider().payouts.retrieve(p.id,{}, {stripeAccount:event.account}));
}

export async function ambassadorTransferEvent(event: Stripe.Event, provider = stripeTest) {
  if(event.livemode||event.account||event.type!=="transfer.reversed")return;
  const t=await provider().transfers.retrieve(String(event.data.object.id));
  if(t.livemode!==false||!t.metadata?.mentora_ambassador_withdrawal)return;
  const [r]=await query("SELECT * FROM money_ambassador_withdrawals WHERE id=$1 AND transfer_id=$2",[t.metadata.mentora_ambassador_withdrawal,t.id]);
  if(!r||!t.amount_reversed)return;
  await moneyTransaction(async q=>{
    await lock(q,String(r.owner_id));
    await q("UPDATE money_ambassador_withdrawals SET status=CASE WHEN status='paid' THEN 'paid' ELSE 'reversed_review' END,reason='Transfert inversé dans Stripe : rapprochement manuel nécessaire. Fonds toujours réservés.',updated_at=$1 WHERE id=$2",[new Date().toISOString(),String(r.id)]);
    await audit(q,"stripe",String(r.owner_id),"transfert-inversé",{id:r.id,amountReversed:t.amount_reversed});
  });
}
