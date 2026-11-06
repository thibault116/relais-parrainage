import assert from "node:assert/strict";
import { query } from "../lib/db";
import { isCrmOwner as isOwner, CRM_OWNER_EMAIL } from "../lib/crm";
import { GET } from "../app/api/admin/pricing/route";
import { pricingProposal } from "../lib/pricing-proposal";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local tests only");
const id = crypto.randomUUID();
try {
  assert.equal(await isOwner(null), false);
  assert.equal(await isOwner({ id, email: CRM_OWNER_EMAIL }), false);
  await query("INSERT INTO moderators(user_id,email) VALUES($1,$2)", [
    id,
    `${id}@example.invalid`,
  ]);
  assert.equal(await isOwner({ id, email: `${id}@example.invalid` }), false);
  assert.equal(await isOwner({ id, email: CRM_OWNER_EMAIL }), true);
  const r = await GET(new Request("http://localhost/api/admin/pricing"));
  assert.equal(r.status, 403);
  assert.match(r.headers.get("cache-control") || "", /no-store/);
  assert.ok(!(await r.text()).includes(pricingProposal.heading));
  assert.deepEqual(
    pricingProposal.plans.map((p) => p.name),
    ["Free", "Starter", "Plus", "Pro"],
  );
  assert.deepEqual(
    pricingProposal.plans.map((p) => p.credits),
    [0, 10, 22, 38],
  );
  assert.equal(pricingProposal.comparison.length, 11);
  for (const row of pricingProposal.comparison)
    assert.equal(row.values.length, 4);
  assert.deepEqual(
    pricingProposal.packs.map((p) => [p.credits, p.price]),
    [
      [5, 8.9],
      [10, 16.9],
      [20, 32.9],
      [40, 62.9],
    ],
  );
  assert.deepEqual(
    pricingProposal.uses.map((p) => p.credits),
    [12, 20, null, null],
  );
  assert.equal(
    pricingProposal.plans[1].credits - pricingProposal.uses[0].credits!,
    -2,
  );
  assert.equal(
    pricingProposal.plans[2].credits +
      pricingProposal.packs[1].credits -
      12 -
      20,
    0,
  );
  console.log(
    "Pricing passed: owner + moderator required; no anonymous proposal exposure; private cache headers; four plans, packs and credit scenarios match the supplied proposal.",
  );
} finally {
  await query("DELETE FROM moderators WHERE user_id=$1", [id]);
}
