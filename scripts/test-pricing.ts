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
  assert.equal(pricingProposal.plans.length, 3);
  for (const p of pricingProposal.plans) {
    assert.ok(p.monthly >= 0);
    assert.ok(p.annual <= p.monthly * 12);
  }
  assert.equal(
    50 * pricingProposal.plans[1].monthly +
      10 * pricingProposal.plans[2].monthly,
    694,
  );
  console.log(
    "Pricing passed: owner + moderator required; no anonymous proposal exposure; private cache headers; prices and simulator defaults consistent.",
  );
} finally {
  await query("DELETE FROM moderators WHERE user_id=$1", [id]);
}
