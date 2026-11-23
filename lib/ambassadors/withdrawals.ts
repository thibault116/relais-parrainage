import type Stripe from "stripe";
import { query } from "../monetization/db";
import { lock, moneyTransaction } from "../monetization/store";
import { stripeTest } from "../monetization/stripe";
import { audit, config, sandboxOnly, totals } from "./service";

async function account(owner: string, s: Stripe) {
  const [link] = await query("SELECT account_id FROM money_connect_accounts WHERE owner_id=$1", [owner]);
  if (!link?.account_id) throw Error("Configure le compte de paiement de test avec Stripe.");
  const a = await s.accounts.retrieve(String(link.account_id));
  if (a.metadata?.mentora_owner !== owner || a.metadata?.mentora_connect_test !== "1" || a.controller?.is_controller !== true || !a.details_submitted || !a.payouts_enabled || a.capabilities?.transfers !== "active" || a.requirements?.currently_due?.length || a.requirements?.past_due?.length) throw Error("Les vérifications Stripe du bénéficiaire ne sont pas terminées.");
  if ((await s.balance.retrieve({}, {stripeAccount: a.id})).livemode) throw Error("Compte réel refusé.");
  return a;
}

export async function verificationStatus(owner:string,provider=stripeTest){
  const [link]=await query("SELECT account_id,country FROM money_connect_accounts WHERE owner_id=$1",[owner]);
  if(!link?.account_id)return {state:"missing",country:null};
  try{const a=await provider().accounts.retrieve(String(link.account_id));if(a.metadata?.mentora_owner!==owner||a.metadata?.mentora_connect_test!=="1")throw Error("Compte incompatible.");return {state:a.details_submitted&&a.payouts_enabled&&a.capabilities?.transfers==="active"&&!a.requirements?.currently_due?.length&&!a.requirements?.past_due?.length?"verified":"incomplete",country:String(link.country)};}catch{return {state:"unavailable",country:String(link.country)}}
}

export async function requestWithdrawal(actor: string, owner: string, key: string, provider = stripeTest) {
  sandboxOnly();
  const a = await account(owner, provider());
  return moneyTransaction(async q => {
    await lock(q, owner);
    const [prior] = await q("SELECT id FROM money_ambassador_withdrawals WHERE request_key=$1", [`${owner}:${key}`]);
    if (prior) return String(prior.id);
    const [member] = await q("SELECT eligibility_reviewed FROM money_ambassadors WHERE owner_id=$1", [owner]);
    if (!Number(member?.eligibility_reviewed)) throw Error("L’éligibilité du bénéficiaire doit être examinée, même pour cet essai.");
    // Acquired claims remain withdrawable after suspension or removal.
    const available = (await totals(owner, q)).available, c = await config(q);
    if (available < Number(c.minimum_cents)) throw Error(`Le solde disponible doit atteindre ${(Number(c.minimum_cents)/100).toFixed(2)} €.`);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await q("INSERT INTO money_ambassador_withdrawals(id,owner_id,request_key,account_id,amount_cents,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$6)", [id, owner, `${owner}:${key}`, a.id, available, now]);
    const claims=await q(`SELECT c.payment_id,c.net_cents,COALESCE((SELECT SUM(a.amount_cents) FROM money_ambassador_allocations a JOIN money_ambassador_withdrawals w ON w.id=a.withdrawal_id WHERE a.payment_id=c.payment_id AND w.status NOT IN ('refused','canceled')),0) AS allocated FROM money_ambassador_commissions c WHERE c.owner_id=$1 AND c.available_at<=$2 AND c.fraud_hold=0 AND c.dispute IN ('','won') ORDER BY c.created_at`,[owner,now]);
    let remaining=available;
    for(const claim of claims){const amount=Math.min(remaining,Math.max(0,Number(claim.net_cents)-Number(claim.allocated)));if(amount>0){await q("INSERT INTO money_ambassador_allocations(withdrawal_id,payment_id,amount_cents) VALUES($1,$2,$3)",[id,String(claim.payment_id),amount]);remaining-=amount;}}
    if(remaining!==0)throw Error("Solde en cours de rapprochement. Réessaie après vérification.");
    await audit(q, actor, owner, "demande-retrait-test", { id, cents: available });
    return id;
  });
}
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

export async function approveWithdrawal(actor: string, id: string, provider = stripeTest) {
  sandboxOnly();
  const s = provider();
  if ((await s.balance.retrieve()).livemode) throw Error("Fonds réels refusés.");
  const r = await moneyTransaction(async q => {
    const [r] = await q("SELECT * FROM money_ambassador_withdrawals WHERE id=$1", [id]);
    if (!r) throw Error("Demande introuvable.");
    await lock(q, String(r.owner_id));
    const [current] = await q("SELECT * FROM money_ambassador_withdrawals WHERE id=$1", [id]);
    if (!["pending", "uncertain", "payout_failed"].includes(String(current.status))) throw Error("Demande déjà traitée ou en cours. Actualise son statut.");
    if ((await totals(String(r.owner_id), q)).available < 0) throw Error("Une correction de commission doit être réglée avant ce versement.");
    const [member] = await q("SELECT eligibility_reviewed FROM money_ambassadors WHERE owner_id=$1", [String(r.owner_id)]);
    if (!Number(member?.eligibility_reviewed)) throw Error("Éligibilité non validée.");
    if (current.started_at && Date.now() - Date.parse(String(current.started_at)) > 23 * 3600000 && !current.transfer_id) throw Error("Envoi ancien incertain : rapprochement Stripe nécessaire avant toute nouvelle tentative.");
    const attempt = Number(current.attempt) + (current.status === "payout_failed" ? 1 : 0);
    await q("UPDATE money_ambassador_withdrawals SET status='processing',attempt=$1,payout_id=CASE WHEN status='payout_failed' THEN NULL ELSE payout_id END,started_at=COALESCE(started_at,$2),updated_at=$2 WHERE id=$3", [attempt, new Date().toISOString(), id]);
    await audit(q, actor, String(r.owner_id), "approbation-retrait-test", { id, attempt });
    return { ...current, attempt } as Record<string, unknown> & { attempt: number };
  });
  try {
    const a = await account(String(r.owner_id), s);
    if (a.id !== r.account_id) throw Error("Le compte de paiement a changé.");
    let transferId = String(r.transfer_id || "");
    if (!transferId) {
      const t = await s.transfers.create({ amount: Number(r.amount_cents), currency: "eur", destination: a.id, metadata: { mentora_ambassador_withdrawal: id } }, { idempotencyKey: `amb-transfer:${id}` });
      if (t.livemode || t.amount !== Number(r.amount_cents)) throw Error("Transfert incompatible.");
      transferId = t.id;
      await query("UPDATE money_ambassador_withdrawals SET transfer_id=$1 WHERE id=$2", [t.id, id]);
    }
    const p = r.payout_id && r.status !== "payout_failed" ? await s.payouts.retrieve(String(r.payout_id), {}, { stripeAccount: a.id }) : await s.payouts.create({ amount: Number(r.amount_cents), currency: "eur", metadata: { mentora_ambassador_withdrawal: id, attempt: String(r.attempt) } }, { stripeAccount: a.id, idempotencyKey: `amb-payout:${id}:${r.attempt}` });
    await recordPayout(id, p);
    await audit(query, actor, String(r.owner_id), "stripe-retrait-test", { id, transfer: transferId, payout: p.id, status: p.status });
  } catch {
    // An ambiguous outcome keeps funds reserved. No automatic retry or release.
    await query("UPDATE money_ambassador_withdrawals SET status='uncertain',reason='Résultat Stripe à vérifier ; fonds réservés.',updated_at=$1 WHERE id=$2 AND status='processing'", [new Date().toISOString(), id]);
    throw Error("Retrait test non confirmé. Les fonds restent réservés ; vérifie Stripe avant de reprendre.");
  }
}
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
