import type Stripe from "stripe";
import { payoutRate } from "../monetization/payout-rate";
import { z } from "zod";
import { query } from "../monetization/db";
import { lock, moneyTransaction } from "../monetization/store";
import { billingLive } from "../monetization/mode";
import { stripeTest } from "../monetization/stripe";
import { rechargeOffers, checkoutOffer } from "../monetization/catalog";
import { principalAccount } from "../monetization/access";
import { canUseFeature } from "../beta";

export const bps = z.number().int().min(0).max(5000);
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,24}$/, "Utilise 4 à 24 lettres ou chiffres.");
export function sandboxOnly() { if (billingLive()) throw Error("Le programme Ambassadeurs réel est désactivé."); }
export async function privateActor(id: string) {
  return await principalAccount(id) && await canUseFeature(id, "ambassadors");
}
export async function config(q = query) { return (await q("SELECT * FROM money_ambassador_config WHERE id='main'"))[0]; }
export function percentage(cents: number, rate: number) {
  if (!Number.isSafeInteger(cents) || cents < 0 || !bps.safeParse(rate).success || !Number.isSafeInteger(cents * rate)) throw Error("Montant invalide.");
  // Round to the nearest cent; exactly half a cent rounds upwards.
  return Math.floor((cents * rate + 5000) / 10000);
}
export async function audit(q: typeof query, actor: string, owner: string, action: string, details: unknown) {
  await q("INSERT INTO money_ambassador_audit(id,actor_id,owner_id,action,details,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [crypto.randomUUID(), actor, owner, action, JSON.stringify(details), new Date().toISOString()]);
}
export async function saveConfig(actor: string, raw: unknown) {
  sandboxOnly();
  const d = z.object({ discountBps: bps.min(1), commissionBps: bps, revision: z.number().int().nonnegative() }).parse(raw);
  return moneyTransaction(async q => {
    await lock(q, "ambassador-config");
    const rows = await q("UPDATE money_ambassador_config SET discount_bps=$1,commission_bps=$2,revision=revision+1 WHERE id='main' AND revision=$3 RETURNING id", [d.discountBps, d.commissionBps, d.revision]);
    if (!rows.length) throw Error("Configuration modifiée ailleurs. Actualise.");
    // A changed discount needs a new immutable Stripe coupon on the next sync.
    await q("UPDATE money_ambassadors SET discount_bps=$1,revision=revision+1,sync_error='Synchronisation requise' WHERE status<>'removed'", [d.discountBps]);
    await audit(q, actor, "main", "configuration", d);
  });
}
export async function saveAmbassador(actor: string, raw: unknown) {
  sandboxOnly();
  const d = z.object({ ownerId: z.string().min(1).max(200), code: codeSchema.optional(), commissionBps: bps.nullable().default(null), status: z.enum(["active", "suspended", "removed"]), eligibilityReviewed: z.boolean().default(false) }).parse(raw);
  const code = d.code || `MENTORA${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  return moneyTransaction(async q => {
    await lock(q, d.ownerId);
    if (!(await q('SELECT id FROM "user" WHERE id=$1', [d.ownerId])).length) throw Error("Membre introuvable.");
    const [old] = await q("SELECT * FROM money_ambassadors WHERE owner_id=$1", [d.ownerId]);
    if (old?.status === "removed") throw Error("Ce statut a été retiré définitivement. Son historique est conservé.");
    if (old && d.code && old.code !== code) throw Error("Le code personnel est immuable ; suspends-le pour le désactiver.");
    if ((await q("SELECT owner_id FROM money_ambassadors WHERE code=$1 AND owner_id<>$2", [code, d.ownerId])).length) throw Error("Ce code est déjà attribué.");
    const c = await config(q), now = new Date().toISOString();
    if (!old) await q("INSERT INTO money_ambassadors(owner_id,code,status,commission_bps,discount_bps,eligibility_reviewed,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)", [d.ownerId, code, d.status, d.commissionBps, Number(c.discount_bps), d.eligibilityReviewed ? 1 : 0, now]);
    else await q("UPDATE money_ambassadors SET status=$1,commission_bps=$2,eligibility_reviewed=$3,revision=revision+1,sync_error='Synchronisation requise',updated_at=$4 WHERE owner_id=$5", [d.status, d.commissionBps, d.eligibilityReviewed ? 1 : 0, now, d.ownerId]);
    await audit(q, actor, d.ownerId, old ? "statut-ou-taux" : "activation", { before: old ? { status: old.status, commissionBps: old.commission_bps } : null, ...d, code: old?.code || code });
  });
}
export async function syncCode(actor: string, owner: string, provider = stripeTest) {
  sandboxOnly();
  // Persist local suspension first. A failed Stripe sync never reopens local eligibility.
  const [a] = await query("SELECT * FROM money_ambassadors WHERE owner_id=$1", [owner]);
  if (!a) throw Error("Ambassadeur introuvable.");
  const s = provider(), revision = Number(a.revision);
  try {
    if (a.promotion_id) {
      const old = await s.promotionCodes.retrieve(String(a.promotion_id));
      if (old.livemode) throw Error("Code réel refusé.");
      if (a.status !== "active" || a.synced_revision !== a.revision) await s.promotionCodes.update(old.id, { active: false });
      if (a.status !== "active") {
        await query("UPDATE money_ambassadors SET synced_revision=$1,sync_error='' WHERE owner_id=$2 AND revision=$1", [revision, owner]);
        await audit(query, actor, owner, "stripe-désactivation", { revision }); return;
      }
      if (Number(a.synced_revision) === revision && old.active) return;
    }
    if (a.status !== "active") return;
    const coupon = await s.coupons.create({ duration: "once", percent_off: Number(a.discount_bps) / 100, name: "Mentora · Ambassadeur TEST", metadata: { mentora_ambassador: owner } }, { idempotencyKey: `amb-coupon:${owner}:${revision}` });
    if (coupon.livemode) throw Error("Coupon réel refusé.");
    const promo = await s.promotionCodes.create({ code: String(a.code), promotion: { type: "coupon", coupon: coupon.id }, metadata: { mentora_ambassador: owner } }, { idempotencyKey: `amb-promo:${owner}:${revision}` });
    if (promo.livemode) throw Error("Code réel refusé.");
    const updated = await query("UPDATE money_ambassadors SET coupon_id=$1,promotion_id=$2,synced_revision=$3,sync_error='' WHERE owner_id=$4 AND revision=$3 AND status='active' RETURNING owner_id", [coupon.id, promo.id, revision, owner]);
    if (!updated.length) { await s.promotionCodes.update(promo.id, { active: false }); throw Error("Le statut a changé pendant la synchronisation. Relance-la."); }
    await audit(query, actor, owner, "stripe-synchronisation", { promotion: promo.id, revision });
  } catch {
    await query("UPDATE money_ambassadors SET sync_error='Synchronisation Stripe non confirmée. Réessayer.' WHERE owner_id=$1 AND revision=$2", [owner, revision]);
    throw Error("Synchronisation Stripe non confirmée. Le code reste inutilisable dans Mentora jusqu’à confirmation.");
  }
}
export async function promoQuote(buyer: string, code: string, offer: string, q = query) {
  sandboxOnly();
  if (!await privateActor(buyer)) throw Error("Essai réservé au compte administrateur principal en bêta.");
  const item = rechargeOffers.find(p => p.id === offer && p.season === "launch");
  if (!item) throw Error("Ce pack n’est pas éligible aux codes ambassadeurs.");
  const [a] = await q("SELECT * FROM money_ambassadors WHERE code=$1", [codeSchema.parse(code)]);
  if (!a || a.status !== "active" || !a.promotion_id || Number(a.synced_revision) !== Number(a.revision) || a.sync_error) throw Error("Code invalide, suspendu ou non synchronisé.");
  const same = await q('SELECT id FROM "user" WHERE id=$1 AND lower(email)=(SELECT lower(email) FROM "user" WHERE id=$2)', [buyer, String(a.owner_id)]);
  if (a.owner_id === buyer || same.length) throw Error("Tu ne peux pas utiliser ton propre code.");
  if ((await q("SELECT user_id FROM profile_blocks WHERE user_id=$1 OR user_id=$2", [buyer, String(a.owner_id)])).length) throw Error("Compte non éligible.");
  const c = await config(q), discount = percentage(item.cents, Number(a.discount_bps));
  return { ambassadorId: String(a.owner_id), code: String(a.code), promotionId: String(a.promotion_id), grossCents: item.cents, discountCents: discount, paidCents: item.cents - discount, credits: item.credits, commissionCents: percentage(item.cents, Number(a.commission_bps ?? c.commission_bps)), holdDays: Number(c.hold_days) };
}
export async function recordAttribution(q: typeof query, order: string, buyer: string, quote: Awaited<ReturnType<typeof promoQuote>>) {
  await q("INSERT INTO money_ambassador_orders(order_id,buyer_id,ambassador_id,code,promotion_id,gross_cents,discount_cents,paid_cents,credits,commission_cents,hold_days,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [order, buyer, quote.ambassadorId, quote.code, quote.promotionId, quote.grossCents, quote.discountCents, quote.paidCents, quote.credits, quote.commissionCents, quote.holdDays, new Date().toISOString()]);
}
export async function validatePromoPayment(order: string, session: Stripe.Checkout.Session, provider = stripeTest) {
  if(billingLive())return null;
  const [a] = await query("SELECT * FROM money_ambassador_orders WHERE order_id=$1", [order]);
  if (!a) return null;
  sandboxOnly();
  const promo = await provider().promotionCodes.retrieve(String(a.promotion_id));
  const applied = session.discounts?.map(d => typeof d.promotion_code === "string" ? d.promotion_code : d.promotion_code?.id) || [];
  if (session.livemode || promo.livemode || applied.length !== 1 || applied[0] !== a.promotion_id || session.currency !== "eur" || session.amount_total !== Number(a.paid_cents) || session.amount_subtotal !== Number(a.gross_cents) || session.total_details?.amount_discount !== Number(a.discount_cents) || session.total_details?.amount_tax || session.total_details?.amount_shipping) throw Error("Paiement promotionnel incompatible avec la commande.");
  return a;
}
export async function recordCommission(order: string, payment: string, intent: string, paidAt: number) {
  sandboxOnly();
  return moneyTransaction(async q => {
    const [a] = await q("SELECT * FROM money_ambassador_orders WHERE order_id=$1", [order]);
    if (!a) return;
    await lock(q, String(a.ambassador_id));
    const [member] = await q("SELECT status FROM money_ambassadors WHERE owner_id=$1", [String(a.ambassador_id)]);
    // A suspended/removed member cannot acquire a new commission. Existing claims survive.
    if (member?.status !== "active" || a.buyer_id === a.ambassador_id) return;
    await q("INSERT INTO money_ambassador_commissions(payment_id,payment_intent,owner_id,order_id,gross_cents,paid_cents,original_cents,net_cents,dispute,available_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7,'unverified',$8,$9) ON CONFLICT(payment_id) DO NOTHING", [payment, intent, String(a.ambassador_id), order, Number(a.gross_cents), Number(a.paid_cents), Number(a.commission_cents), new Date(paidAt * 1000 + Number(a.hold_days) * 86400000).toISOString(), new Date(paidAt * 1000).toISOString()]);
  });
}
export async function adjustCommission(intent: string, refund?: number, dispute?: string) {
  if (billingLive()) return;
  return moneyTransaction(async q => {
    const [r] = await q("SELECT * FROM money_ambassador_commissions WHERE payment_intent=$1", [intent]);
    if (!r) return;
    await lock(q, String(r.owner_id));
    const [c] = await q("SELECT * FROM money_ambassador_commissions WHERE payment_intent=$1", [intent]);
    const refunded = Math.max(Number(c.refund_cents), Math.min(refund ?? Number(c.refund_cents), Number(c.paid_cents)));
    const state = dispute ?? String(c.dispute);
    const net = state && state !== "won" ? 0 : Math.max(0, Number(c.original_cents) - Math.ceil(Number(c.original_cents) * refunded / Number(c.paid_cents)));
    await q("UPDATE money_ambassador_commissions SET refund_cents=$1,dispute=$2,net_cents=$3 WHERE payment_intent=$4", [refunded, state, net, intent]);
    if (net !== Number(c.net_cents) || state !== c.dispute) await audit(q, "stripe", String(c.owner_id), "ajustement-commission", { payment: c.payment_id, before: Number(c.net_cents), after: net, refund: refunded, dispute: state });
  });
}
export async function totals(owner: string, q = query, now = new Date().toISOString()) {
  const [c] = await q("SELECT COALESCE(SUM(net_cents),0) AS total,COALESCE(SUM(CASE WHEN available_at<=$2 AND fraud_hold=0 AND dispute IN ('','won') THEN net_cents ELSE 0 END),0) AS matured,COUNT(*) AS purchases,COALESCE(SUM(gross_cents),0) AS revenue,COALESCE(SUM(paid_cents),0) AS paid_revenue FROM money_ambassador_commissions WHERE owner_id=$1", [owner, now]);
  const [w] = await q("SELECT COALESCE(SUM(CASE WHEN status NOT IN ('refused','canceled') THEN amount_cents ELSE 0 END),0) AS committed,COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) AS paid FROM money_ambassador_withdrawals WHERE owner_id=$1", [owner]);
  return { purchases: Number(c.purchases), revenue: Number(c.revenue), discounts: Number(c.revenue) - Number(c.paid_revenue), total: Number(c.total), pending: Number(c.total) - Number(c.matured), available: Number(c.matured) - Number(w.committed), withdrawn: Number(w.paid), reserved: Number(w.committed) - Number(w.paid) };
}
export async function profitability() {
  const c = await config();
  return rechargeOffers.filter(p => p.season === "launch").map(p => {
    const discount = percentage(p.cents, Number(c.discount_bps)), commission = percentage(p.cents, Number(c.commission_bps)), mentor = Math.round(p.credits * payoutRate());
    return { ...p, discount, commission, paid: p.cents - discount, mentor, theoreticalRemainder: p.cents - discount - commission - mentor, singleCreditRemainder:p.cents-discount-commission-p.credits*Math.round(payoutRate()) };
  });
}
export async function dashboard(search = "") {
  sandboxOnly();
  const list = await query(`SELECT a.*,COALESCE(p.name,'Membre') AS name FROM money_ambassadors a LEFT JOIN profiles p ON p.user_id=a.owner_id ORDER BY a.created_at DESC`);
  const members = search.trim() ? await query(`SELECT u.id,COALESCE(p.name,'Membre') AS name,p.role FROM "user" u LEFT JOIN profiles p ON p.user_id=u.id WHERE lower(COALESCE(p.name,'')) LIKE $1 ORDER BY p.name LIMIT 25`, [`%${search.toLowerCase().slice(0,80)}%`]) : [];
  const ambassadors = await Promise.all(list.map(async a => ({ ...a, totals: await totals(String(a.owner_id)) })));
  const commissions = await query(`SELECT c.payment_id,c.owner_id,c.gross_cents,c.paid_cents,c.original_cents,c.net_cents,c.refund_cents,c.dispute,c.fraud_hold,c.available_at,c.created_at,COALESCE((SELECT SUM(a.amount_cents) FROM money_ambassador_allocations a JOIN money_ambassador_withdrawals w ON w.id=a.withdrawal_id WHERE a.payment_id=c.payment_id AND w.status='paid'),0) AS withdrawn_cents FROM money_ambassador_commissions c ORDER BY c.created_at DESC LIMIT 200`);
  const withdrawals = await query("SELECT * FROM money_ambassador_withdrawals ORDER BY created_at DESC LIMIT 200");
  return { mode: "test", private: true, liveEnabled: false, config: await config(), ambassadors, members, commissions, withdrawals, profitability: await profitability(), audit: await query("SELECT * FROM money_ambassador_audit ORDER BY created_at DESC LIMIT 100"), testStripeConfigured: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ""), offers: rechargeOffers.filter(p=>p.season==="launch") };
}
export function eligiblePack(id: string) { return !!checkoutOffer(id) && rechargeOffers.some(p=>p.id===id&&p.season==="launch"); }
