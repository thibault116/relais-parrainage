import type Stripe from "stripe";
import { z } from "zod";
import { query, database } from "../db";
import { Pool } from "pg";
import { testPayoutCents } from "./payout-config";
import { stripeTest } from "./stripe";
import { diagnosePayoutTest, safeStripeFailure } from "./payout-diagnostics";

export type PayoutTest = {
  id: string; owner_id: string; request_key: string; amount: number;
  stripe_id: string | null; status: string; error: string; created_at: string; updated_at: string;
};
export async function migratePayoutTests() {
  await query(`CREATE TABLE IF NOT EXISTS money_payout_tests (
    id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL CHECK(amount IN (0,1)),stripe_id TEXT UNIQUE,status TEXT NOT NULL,
    error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
  )`);
  // Keep the original 0/1 column and all historical tests unchanged. New tests
  // record their explicit cents in an additive column (no destructive rebuild).
  if (database() instanceof Pool) {
    await query("ALTER TABLE money_payout_tests ADD COLUMN IF NOT EXISTS amount_cents INTEGER");
  } else {
    const columns=await query("PRAGMA table_info(money_payout_tests)");
    if (!columns.some(column=>column.name === "amount_cents"))
      await query("ALTER TABLE money_payout_tests ADD COLUMN amount_cents INTEGER");
  }
}
async function readTests(sql: string,params: (string | number | null)[]) {
  const rows=await query<PayoutTest & {amount_cents?:number | null}>(sql,params);
  return rows.map(({amount_cents,...row})=>({...row,amount:Number(amount_cents ?? row.amount)}));
}
export async function listPayoutTests(owner: string) {
  return readTests("SELECT * FROM money_payout_tests WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50", [owner]);
}
const readableErrors: Record<string, string> = {
  balance_insufficient: "Le solde EUR disponible du bac à sable Stripe est insuffisant. Ajoute des fonds de test dans Stripe.",
  insufficient_funds: "Le solde de test Stripe est insuffisant.",
  bank_account_missing: "Ajoute un compte bancaire de test EUR dans les paramètres de versement Stripe.",
  payout_bank_account_missing: "Ajoute un compte bancaire de test EUR dans les paramètres de versement Stripe.",
};
function validatePayout(payout: Stripe.Payout, row: PayoutTest) {
  if (payout.livemode !== false || payout.amount !== row.amount || payout.currency !== "eur" ||
    payout.metadata?.mentora_payout_test !== row.id || payout.metadata?.mentora_owner !== row.owner_id)
    throw new Error("Réponse Stripe incompatible avec ce test. Aucun statut de réussite enregistré.");
}
async function recordPayout(row: PayoutTest, payout: Stripe.Payout) {
  validatePayout(payout, row);
  await query("UPDATE money_payout_tests SET stripe_id=$1,status=$2,error=$3,updated_at=$4 WHERE id=$5 AND owner_id=$6",
    [payout.id,payout.status,payout.failure_code ? "Stripe signale un échec du virement de test." : "",new Date().toISOString(),row.id,row.owner_id]);
}
export async function refreshPayoutTests(owner: string, client: () => Stripe = stripeTest) {
  const rows = await listPayoutTests(owner);
  const pending = rows.filter(row => row.stripe_id && ["pending", "in_transit"].includes(row.status)).slice(0, 10);
  if (pending.length) {
    const stripe = client();
    await Promise.all(pending.map(async row => {
      const payout = await stripe.payouts.retrieve(row.stripe_id!);
      await recordPayout(row, payout);
    }));
  }
  return listPayoutTests(owner);
}
// This is a separate sandbox register: never debit member credits or remuneration.
export async function createPayoutTest(owner: string, amount: unknown, key: unknown, client: () => Stripe = stripeTest) {
  const cents = z.union([z.literal(0), z.literal(testPayoutCents)]).parse(amount);
  const requestKey = z.string().uuid().parse(key);
  const now = new Date().toISOString();
  await query(`INSERT INTO money_payout_tests(id,owner_id,request_key,amount,amount_cents,status,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(request_key) DO NOTHING`,
    [crypto.randomUUID(),owner,requestKey,cents === 0 ? 0 : 1,cents,cents === 0 ? "simulated" : "creating",now]);
  const [row] = await readTests("SELECT * FROM money_payout_tests WHERE request_key=$1 AND owner_id=$2", [requestKey,owner]);
  if (!row || row.amount !== cents) throw new Error("Référence de test invalide.");
  if (cents === 0 || row.stripe_id || row.status === "failed") return row;
  // Stripe idempotency keys are retained at least 24h. Never recreate an old ambiguous request.
  if (Date.now() - new Date(row.created_at).getTime() > 23 * 3600000)
    throw new Error("Ancien test non confirmé : vérifie son identifiant Mentora dans Stripe avant tout nouvel essai.");
  const diagnostic = await diagnosePayoutTest(client);
  if (!diagnostic.ready || (!diagnostic.destination && !diagnostic.usesDefaultDestination)) {
    await query("UPDATE money_payout_tests SET status='failed',error=$1,updated_at=$2 WHERE id=$3 AND stripe_id IS NULL",
      [diagnostic.checks.join(" ") + (diagnostic.code ? ` [${diagnostic.code}]` : ""),new Date().toISOString(),row.id]);
    return (await readTests("SELECT * FROM money_payout_tests WHERE id=$1 AND owner_id=$2",[row.id,owner]))[0];
  }
  const stripe = client();
  let payout: Stripe.Payout;
  try {
    payout = await stripe.payouts.create({
      amount: cents,currency: "eur",method: "standard",...(diagnostic.destination ? {destination:diagnostic.destination.id} : {}),
      description: "Mentora — retrait administrateur TEST 1,00 EUR",
      metadata: { mentora_payout_test: row.id,mentora_owner: owner },
    }, { idempotencyKey: `mentora-payout-test:${row.id}` });
  } catch (failure) {
    const error = failure as { statusCode?: number; code?: string; type?: string };
    const detail = safeStripeFailure(failure);
    const definitive = !!error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 409;
    const message = error.type === "StripePermissionError"
      ? "La clé Stripe test doit autoriser les versements (Payouts). Vérifie ses permissions dans Stripe."
      : readableErrors[error.code || ""] || (definitive
        ? "Stripe a refusé le test. Vérifie le solde EUR, le compte bancaire de test et les autorisations de versement dans le Dashboard Stripe."
        : "Résultat non confirmé. Réessaie ce même test : sa référence évite un double envoi.");
    await query("UPDATE money_payout_tests SET status=$1,error=$2,updated_at=$3 WHERE id=$4 AND stripe_id IS NULL",
      [definitive ? "failed" : "uncertain",`${message} Stripe : ${detail.message} [${detail.code}]${detail.requestId ? ` · ${detail.requestId}` : ""}`,new Date().toISOString(),row.id]);
    return (await readTests("SELECT * FROM money_payout_tests WHERE id=$1 AND owner_id=$2",[row.id,owner]))[0];
  }
  await recordPayout(row,payout);
  return (await readTests("SELECT * FROM money_payout_tests WHERE id=$1 AND owner_id=$2",[row.id,owner]))[0];
}
