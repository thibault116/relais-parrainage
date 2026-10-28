import assert from "node:assert/strict";
import { getAuth } from "../lib/auth";
import { query } from "../lib/db";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local test only");
const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const email = `settings-${crypto.randomUUID()}@example.invalid`;
const original = "Local-test-original-2026!",
  next = "Local-test-updated-2026!";
const handler = getAuth().handler;
let passwordRequests = 0;
async function request(
  path: string,
  body?: unknown,
  cookie = "",
  origin = base,
) {
  if (path === "change-password" && passwordRequests++ === 3)
    await new Promise((r) => setTimeout(r, 11000));
  return handler(
    new Request(`${base}/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin, cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
const cookie = (r: Response) =>
  r.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
let id = "";
try {
  let r = await request("sign-up/email", {
    name: "Local settings test",
    email,
    password: original,
  });
  assert.equal(r.status, 200);
  const first = cookie(r);
  id = (await r.json()).user.id;
  r = await request("sign-in/email", { email, password: original });
  assert.equal(r.status, 200);
  const second = cookie(r);
  r = await request("change-password", {
    currentPassword: original,
    newPassword: next,
  });
  assert.equal(r.status, 401);
  r = await request(
    "change-password",
    { currentPassword: original, newPassword: next },
    first,
    "https://untrusted.example",
  );
  assert.equal(r.status, 403);
  r = await request(
    "change-password",
    { currentPassword: "incorrect-password", newPassword: next },
    first,
  );
  assert.equal(r.status, 400);
  r = await request(
    "change-password",
    { currentPassword: original, newPassword: "short" },
    first,
  );
  assert.equal(r.status, 400);
  r = await request(
    "change-password",
    { currentPassword: original, newPassword: next, revokeOtherSessions: true },
    first,
  );
  assert.equal(r.status, 200);
  const updated = cookie(r);
  r = await request("get-session", undefined, second);
  assert.equal(await r.json(), null);
  r = await request("get-session", undefined, updated);
  assert.equal((await r.json()).user.id, id);
  r = await request("sign-in/email", { email, password: original });
  assert.equal(r.status, 401);
  r = await request("sign-in/email", { email, password: next });
  assert.equal(r.status, 200);
  console.log(
    "PASS: password authentication, origin protection, length checks, old password rejected, new password accepted, other sessions revoked and current session retained.",
  );
} finally {
  if (id) {
    await query('DELETE FROM session WHERE "userId"=$1', [id]);
    await query('DELETE FROM account WHERE "userId"=$1', [id]);
    await query('DELETE FROM "user" WHERE id=$1', [id]);
  }
}
