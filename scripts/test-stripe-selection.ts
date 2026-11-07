import assert from "node:assert/strict";
import { query } from "../lib/db";
import { migrateMonetization, balance } from "../lib/monetization/store";
import { checkout } from "../lib/monetization/payments";
import { stripeTest } from "../lib/monetization/stripe";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local sandbox test only");
await migrateMonetization();
const owner = "qa-selection-" + crypto.randomUUID(),
  s = stripeTest();
let last = "";
try {
  const sessions: string[] = [];
  for (const plan of ["starter", "plus", "pro"]) {
    await checkout(owner, plan, crypto.randomUUID(), "billing");
    const row = (
      await query(
        "SELECT session_id FROM money_orders WHERE owner_id=$1 ORDER BY created_at DESC",
        [owner],
      )
    )[0];
    last = String(row.session_id);
    sessions.push(last);
    assert.ok(
      (await s.checkout.sessions.retrieve(last)).success_url?.includes(
        "mobile=billing",
      ),
    );
  }
  assert.equal(
    (await s.checkout.sessions.retrieve(sessions[0])).status,
    "expired",
  );
  assert.equal(
    (await s.checkout.sessions.retrieve(sessions[1])).status,
    "expired",
  );
  assert.equal(
    (await s.checkout.sessions.retrieve(sessions[2])).status,
    "open",
  );
  assert.equal(await balance(query, owner), 0);
  console.log(
    "PASS: Starter → Plus → Pro sans attendre ; anciennes sessions expirées, aucun crédit sans paiement.",
  );
} finally {
  if (last) await s.checkout.sessions.expire(last).catch(() => {});
  await query("DELETE FROM money_orders WHERE owner_id=$1", [owner]);
  await query("DELETE FROM money_accounts WHERE owner_id=$1", [owner]);
}
