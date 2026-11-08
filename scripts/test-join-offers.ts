import assert from "node:assert/strict";
import { query } from "../lib/db";
import { randomUUID } from "node:crypto";
if (process.env.DATABASE_URL || process.env.VERCEL) throw Error("Local only");
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Local URL only");
const password = "Mentora-offers-qa-2026!";
const users: { id: string; cookie: string }[] = [];
async function call(path: string, method = "GET", body?: unknown, cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
  };
}
try {
  assert.equal((await call("/api/offers")).status, 401);
  for (const [role, beta, expected] of [
    ["beginner", 0, 403],
    ["beginner", 1, 200],
    ["mentor", 1, 403],
  ] as const) {
    const signup = await call("/api/auth/sign-up/email", "POST", {
      name: "Offres test",
      email: `offers-${randomUUID()}@example.invalid`,
      password,
    });
    assert.equal(signup.status, 200);
    const u = { id: signup.data.user.id, cookie: signup.cookie };
    users.push(u);
    const now = new Date().toISOString();
    await query(
      "INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$2,$3,$4,$5,$6,0,$7)",
      [randomUUID(), u.id, randomUUID(), role, "Offres test", "{}", now],
    );
    await query(
      "INSERT INTO beta_preferences(user_id,enabled,updated_at) VALUES($1,$2,$3)",
      [u.id, beta, now],
    );
    const r = await call("/api/offers", "GET", undefined, u.cookie);
    assert.equal(r.status, expected);
    if (expected === 200) {
      assert.equal(r.data.plans.length, 4);
      assert.equal(r.data.plans.find((p: any) => p.id === "plus").credits, 22);
      assert.equal(r.data.discount, 20);
      assert.ok(
        r.data.plans.every(
          (p: any) => p.annualCents === Math.round(p.cents * 9.6),
        ),
      );
      assert.equal(r.data.comparison.length, 11);
      assert.ok(!JSON.stringify(r.data).includes("checkout.stripe"));
      await query("UPDATE beta_preferences SET enabled=0 WHERE user_id=$1", [
        u.id,
      ]);
      assert.equal(
        (await call("/api/offers", "GET", undefined, u.cookie)).status,
        403,
      );
    }
  }
  console.log(
    "PASS anonymous, normal beginner, beta beginner, mentor and beta opt-out; annual prices and comparison; no checkout exposed.",
  );
} finally {
  for (const u of users) {
    await query("DELETE FROM profiles WHERE user_id=$1", [u.id]);
    await call("/api/auth/delete-user", "POST", { password }, u.cookie);
  }
}
