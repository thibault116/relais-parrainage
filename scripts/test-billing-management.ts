import assert from "node:assert/strict";
import { query } from "../lib/db";
import { stripeTest } from "../lib/monetization/stripe";
import { migrateMonetization, balance } from "../lib/monetization/store";
import {
  manageSubscription,
  billingDetails,
} from "../lib/monetization/billing";
import { GET as summary } from "../app/api/admin/monetization/summary/route";
import { GET as billing } from "../app/api/admin/monetization/billing/route";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local sandbox only");
assert.equal(
  (
    await summary(
      new Request("http://localhost/api/admin/monetization/summary"),
    )
  ).status,
  403,
);
assert.equal(
  (
    await billing(
      new Request("http://localhost/api/admin/monetization/billing"),
    )
  ).status,
  403,
);
await migrateMonetization();
const s = stripeTest(),
  owner = "qa-billing-" + crypto.randomUUID();
let subId = "";
try {
  const clock = await s.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: "Mentora billing management TEST",
  });
  const c = await s.customers.create({
    test_clock: clock.id,
    name: "Mentora TEST fictif",
  });
  const pm = await s.paymentMethods.attach("pm_card_visa", { customer: c.id });
  await s.customers.update(c.id, {
    invoice_settings: { default_payment_method: pm.id },
  });
  const price = await s.prices.create({
    currency: "eur",
    unit_amount: 1490,
    recurring: { interval: "month" },
    product_data: { name: "Mentora Starter TEST" },
  });
  const sub = await s.subscriptions.create({
    customer: c.id,
    items: [{ price: price.id }],
    metadata: { mentora_plan: "starter" },
  });
  subId = sub.id;
  await query(
    "INSERT INTO money_accounts(owner_id,customer_id,subscription_id,plan,status) VALUES($1,$2,$3,'starter','active')",
    [owner, c.id, sub.id],
  );
  await manageSubscription(owner, "change", "plus");
  let d = await billingDetails(owner);
  assert.equal(d.pendingPlan, "plus");
  assert.equal(d.card?.last4, "4242");
  assert.ok(d.invoices.length);
  assert.equal(
    (await s.subscriptions.retrieve(sub.id)).metadata.mentora_plan,
    "starter",
  );
  assert.equal(await balance(query, owner), 0);
  console.log(
    "PASS changement Plus programmé, Starter conservé, carte masquée et factures disponibles, aucun crédit anticipé",
  );
  const next = sub.items.data[0].current_period_end + 120;
  async function advance(time: number) {
    await s.testHelpers.testClocks.advance(clock.id, { frozen_time: time });
    for (let i = 0; i < 45; i++) {
      if (
        (await s.testHelpers.testClocks.retrieve(clock.id)).status === "ready"
      )
        return;
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw Error("Clock timeout");
  }
  await advance(next);
  await advance(next + 7200);
  const renewed = await s.subscriptions.retrieve(sub.id);
  assert.equal(renewed.metadata.mentora_plan, "plus");
  assert.equal(renewed.items.data[0].price.unit_amount, 2990);
  console.log("PASS renouvellement réel sandbox à 29,90 € avec metadata Plus");
  await manageSubscription(owner, "cancel");
  assert.equal(
    (await s.subscriptions.retrieve(sub.id)).cancel_at_period_end,
    true,
  );
  assert.equal(
    Number(
      (
        await query(
          "SELECT cancel_at_end FROM money_accounts WHERE owner_id=$1",
          [owner],
        )
      )[0].cancel_at_end,
    ),
    1,
  );
  await manageSubscription(owner, "resume");
  assert.equal(
    (await s.subscriptions.retrieve(sub.id)).cancel_at_period_end,
    false,
  );
  console.log("PASS résiliation en fin de période et reprise");
} finally {
  if (subId) {
    const sub = await s.subscriptions.retrieve(subId);
    if (sub.schedule)
      await s.subscriptionSchedules
        .release(
          typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id,
        )
        .catch(() => {});
    await s.subscriptions.cancel(subId).catch(() => {});
  }
  await query("DELETE FROM money_accounts WHERE owner_id=$1", [owner]);
}
