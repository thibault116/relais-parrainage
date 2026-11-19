import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import nodemailer from "nodemailer";
import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/auth";
import { database, query } from "../lib/db";
import { MAIL_FROM } from "../lib/email-templates";
import { passwordResetMail } from "../lib/password-reset";

if (process.env.DATABASE_URL || process.env.VERCEL) throw Error("Isolated local tests only");
const cwd = process.cwd(), dir = await mkdtemp(join(tmpdir(), "mentora-password-reset-"));
process.chdir(dir);
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.GMAIL_APP_PASSWORD = "FAKE-LOCAL-ONLY";
const sent: any[] = [];
const original = nodemailer.createTransport;
nodemailer.createTransport = (() => ({
  async sendMail(mail: any) { sent.push(mail); return { accepted: [mail.to] }; }, close() {},
})) as typeof original;
const base = "http://localhost:3000";
async function call(path: string, body?: unknown, cookie = "", ip = "198.51.100.1") {
  return getAuth().handler(new Request(base + "/api/auth" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Origin: base, "x-forwarded-for": ip, ...(cookie ? {cookie} : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}
function tokenFromMail(index = sent.length - 1) {
  const link = sent[index].text.match(/Choisir un nouveau mot de passe : (\S+)/)[1];
  return { link, token: new URL(link).pathname.split("/").at(-1)! };
}
try {
  const auth = getAuth();
  await (await getMigrations(auth.options)).runMigrations();
  const email = "recovery@example.invalid", oldPassword = "Local-original-password!", newPassword = "Local-new-password-test!";
  const signup = await call("/sign-up/email", { name: "Test local", email, password: oldPassword });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
  const response = await call("/request-password-reset", {email, redirectTo: base + "/nouveau-mot-de-passe"});
  assert.equal(response.status, 200); const knownResponse = await response.json();
  assert.equal(sent.length, 1); assert.equal(sent[0].from.address, MAIL_FROM); assert.equal(sent[0].from.name, "Mentora");
  assert.equal(sent[0].to, email); assert(sent[0].html.includes("30 minutes")); assert(sent[0].disableUrlAccess);
  const {link, token} = tokenFromMail();
  assert.equal(new URL(link).origin, base);
  const callback = await auth.handler(new Request(link));
  assert.equal(callback.status, 302); assert.equal(new URL(callback.headers.get("location")!).pathname, "/nouveau-mot-de-passe");
  assert.equal(new URL(callback.headers.get("location")!).searchParams.get("token"), token);
  const unknown = await call("/request-password-reset", {email: "unknown@example.invalid", redirectTo: base + "/nouveau-mot-de-passe"});
  assert.equal(unknown.status, 200); assert.deepEqual(await unknown.json(), knownResponse); assert.equal(sent.length, 1);
  const badOrigin = await call("/request-password-reset", {email, redirectTo: "https://evil.example/reset"});
  assert.equal(badOrigin.status, 403); assert.equal(sent.length, 1);
  assert.equal((await call("/reset-password", {token, newPassword: "short"})).status, 400);
  assert.equal((await call("/reset-password", {token: "invalid-token", newPassword})).status, 400);
  assert.equal((await call("/reset-password", {token, newPassword})).status, 200);
  assert.equal((await call("/reset-password", {token, newPassword}, "", "198.51.100.2")).status, 400);
  assert.equal(await (await call("/get-session", undefined, cookie)).json(), null);
  assert.equal((await call("/sign-in/email", {email, password: oldPassword})).status, 401);
  assert.equal((await call("/sign-in/email", {email, password: newPassword})).status, 200);
  assert.equal((await call("/request-password-reset", {email, redirectTo: base + "/nouveau-mot-de-passe"}, "", "198.51.100.3")).status, 200);
  const expired = tokenFromMail().token;
  await query('UPDATE verification SET "expiresAt"=$1 WHERE identifier=$2', [Date.now()-60000, "reset-password:"+expired]);
  const expiredCallback = await auth.handler(new Request(tokenFromMail().link));
  assert.equal(new URL(expiredCallback.headers.get("location")!).searchParams.get("error"), "INVALID_TOKEN");
  assert.equal((await call("/reset-password", {token: expired, newPassword}, "", "198.51.100.3")).status, 400);
  for(let i=0;i<3;i++)assert.equal((await call("/request-password-reset", {email:"rate@example.invalid"}, "", "198.51.100.4")).status, 200);
  assert.equal((await call("/request-password-reset", {email:"rate@example.invalid"}, "", "198.51.100.4")).status, 429);
  assert(!passwordResetMail('https://example.invalid/?x="<script>').html.includes('<script>'));
  console.log("PASS: Mentora sender, generic responses, trusted callbacks, 30-minute single-use tokens, short/invalid/expired tokens rejected, sessions revoked, new password works, request rate limited. No real e-mail sent.");
} finally {
  nodemailer.createTransport = original;
  const db = database(); if (db instanceof DatabaseSync) db.close();
  process.chdir(cwd); await rm(dir, {recursive:true,force:true});
}
