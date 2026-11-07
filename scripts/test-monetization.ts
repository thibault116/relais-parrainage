import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { query } from "../lib/db";
import {
  migrateMonetization,
  saveService,
  book,
  bookingAction,
  balance,
} from "../lib/monetization/store";
import {
  recordPaid,
  recordRefund,
  handleEvent,
} from "../lib/monetization/payments";
import { stripeTest } from "../lib/monetization/stripe";
import { GET, POST } from "../app/api/admin/monetization/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local test only");
await migrateMonetization();
const owner = "money-test-" + crypto.randomUUID(),
  other = "money-other-" + crypto.randomUUID();
const oldKey = process.env.STRIPE_SECRET_KEY,
  oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
try {
  assert.equal(
    (await GET(new Request("http://localhost/api/admin/monetization"))).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/admin/monetization", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  process.env.STRIPE_SECRET_KEY = "sk_live_rejected_test_fixture";
  assert.throws(() => stripeTest(), /refusées/);
  await assert.rejects(
    () => handleEvent({ livemode: true } as Stripe.Event),
    /réel refusé/,
  );
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture_not_a_real_key";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_" + crypto.randomUUID();
  assert.equal(
    (
      await webhook(
        new Request("http://localhost/api/stripe/webhook", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    400,
  );
  const payload = JSON.stringify({
    id: "evt_fixture_" + crypto.randomUUID(),
    type: "test.no_effect",
    livemode: false,
    data: { object: {} },
  });
  const signature = stripeTest().webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  assert.equal(
    (
      await webhook(
        new Request("http://localhost/api/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": signature },
          body: payload,
        }),
      )
    ).status,
    200,
  );
  await query("DELETE FROM money_events WHERE id=$1", [JSON.parse(payload).id]);
  await Promise.all([
    recordPaid(owner, "pay_" + owner, "pi_" + owner, 3290, 20, null),
    recordPaid(owner, "pay_" + owner, "pi_" + owner, 3290, 20, null),
  ]);
  assert.equal(
    await balance(query, owner),
    20,
    "duplicate payment must not credit twice",
  );
  const service = await saveService(owner, {
    title: "Analyse test",
    description: "Analyse détaillée du compte de test.",
    category: "Vinted",
    duration: 30,
    calls: 1,
    followup: "Retour écrit",
    availability: "Sur rendez-vous",
    credits: 12,
    capacity: 5,
    published: true,
  });
  await assert.rejects(
    () =>
      book(other, service, crypto.randomUUID(), "Demande de test", "Demain"),
    /introuvable/,
  );
  const key = crypto.randomUUID(),
    id = String(await book(owner, service, key, "Demande de test", "Demain"));
  assert.equal(
    await book(owner, service, key, "Demande de test", "Demain"),
    id,
  );
  assert.equal(await balance(query, owner), 8);
  await assert.rejects(
    () => book(owner, service, crypto.randomUUID(), "Autre demande", "Demain"),
    /insuffisants/,
  );
  await bookingAction(owner, id, "accept");
  await bookingAction(owner, id, "complete");
  assert.equal(
    (
      await query("SELECT payout_cents FROM money_bookings WHERE id=$1", [id])
    )[0].payout_cents,
    1800,
  );
  await bookingAction(owner, id, "refund");
  assert.equal(await balance(query, owner), 20);
  await assert.rejects(() => bookingAction(owner, id, "refund"));
  const attempts = await Promise.allSettled([
    book(owner, service, crypto.randomUUID(), "Demande concurrente", "Demain"),
    book(owner, service, crypto.randomUUID(), "Demande concurrente", "Demain"),
  ]);
  assert.equal(
    attempts.filter((x) => x.status === "fulfilled").length,
    1,
    "no overspending",
  );
  const reserved = attempts.find(
    (x) => x.status === "fulfilled",
  ) as PromiseFulfilledResult<unknown>;
  await bookingAction(owner, String(reserved.value), "decline");
  assert.equal(await balance(query, owner), 20);
  await recordRefund("pi_" + owner, 1645);
  assert.equal(await balance(query, owner), 10);
  await recordRefund("pi_" + owner, 1645);
  assert.equal(await balance(query, owner), 10);
  await recordRefund("pi_" + owner, 3290);
  assert.equal(await balance(query, owner), 0);
  await recordRefund("pi_" + owner, 100);
  assert.equal(
    await balance(query, owner),
    0,
    "older refund event cannot recredit",
  );
  console.log(
    "PASS: private API, test-only keys, signed webhook, duplicate payment/refund, owner isolation, reservations, concurrent balance, payout and restitution.",
  );
} finally {
  for (const table of [
    "money_bookings",
    "money_services",
    "money_ledger",
    "money_payments",
    "money_orders",
    "money_accounts",
  ])
    await query(`DELETE FROM ${table} WHERE owner_id IN ($1,$2)`, [
      owner,
      other,
    ]);
  if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = oldKey;
  if (oldSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
}
