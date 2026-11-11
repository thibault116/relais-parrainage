import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { migrateChangelog, initialize, settings, putDraft, getDraft, editDraft } from "../lib/changelog/store";
import { automaticProductionCheck, generateDraft, preview, validateProduction, toggleAutomatic } from "../lib/changelog/service";
import { deliverDraft, reconcileMessage } from "../lib/changelog/discord";
import { description, announcementSchema, applicationUrl, repository } from "../lib/changelog/shared";
import { database } from "../lib/db";
import { parseRelease } from "../lib/changelog/github";

if (process.env.DATABASE_URL || process.env.VERCEL)
  throw new Error("Ce test utilise exclusivement une base locale temporaire.");
const cwd = process.cwd();
const directory = await mkdtemp(join(tmpdir(), "mentora-discord-qa-"));
const originalFetch = globalThis.fetch;
const previousEnvironment = { ...process.env };
process.chdir(directory);
const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40), d = "d".repeat(40);
process.env.DISCORD_CHANGELOG_WEBHOOK_URL = "https://discord.com/api/webhooks/123/test-placeholder";
process.env.VERCEL_ENV = "production";
process.env.VERCEL_GIT_COMMIT_SHA = b;
process.env.VERCEL_DEPLOYMENT_ID = "dpl_fake_local_test";
let mode: "members" | "technical" = "technical";
let sent = 0;
let localMessages: Record<string, any>[] = [];
const server = createServer(async (request, response) => {
  assert.equal(request.method, "POST");
  let body = "";
  for await (const part of request) body += part.toString();
  const payload = JSON.parse(body);
  assert.deepEqual(payload.allowed_mentions.parse, []);
  assert.equal(payload.embeds[0].color, 0x883af5);
  assert(payload.embeds[0].description.length <= 2000);
  assert.match(payload.embeds[0].description, /actualiser Mentora/);
  assert.match(payload.embeds[0].image.url, /changelog-banner.png$/);
  localMessages.push(payload);
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ id: String(1000 + localMessages.length) }));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = (server.address() as { port: number }).port;
const localDelivery: typeof fetch = async (_input, options) => {
  sent++;
  return originalFetch(`http://127.0.0.1:${port}`, options);
};
function release(id: string, notes: string[]) {
  return `export const memberRelease = { id: ${JSON.stringify(id)}, notes: ${JSON.stringify(notes)} };`;
}
globalThis.fetch = async (input, options) => {
  const url = new URL(String(input));
  if (url.origin === applicationUrl) return Response.json({
    version: process.env.VERCEL_DEPLOYMENT_ID,
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: "production",
  });
  if (url.hostname === "discord.com") return localDelivery(input, options);
  assert.equal(url.hostname, "api.github.com", "Aucun autre serveur n’est appelé pendant les tests");
  assert(url.pathname.startsWith(`/repos/${repository}/`));
  if (url.pathname.includes("/compare/")) {
    const target = process.env.VERCEL_GIT_COMMIT_SHA;
    return Response.json({
      status: "ahead", total_commits: 1, commits: [{ sha: target }],
      files: [{ filename: mode === "members" ? "lib/member-release.ts" : "lib/db.ts" }],
    });
  }
  const sha = url.searchParams.get("ref");
  const note = sha === a ? release("initial", ["Une ancienne nouveauté."])
    : sha === b ? release("members-1", ["La navigation est plus fluide sur téléphone.", "Un bug d’affichage a été corrigé."])
      : sha === c ? release("members-1", ["La navigation est plus fluide sur téléphone.", "Un bug d’affichage a été corrigé."])
        : release("members-2", ["Tu peux retrouver tes profils enregistrés."]);
  return new Response(note);
};
try {
  await migrateChangelog();
  const config = await initialize(a);
  assert.equal(config.auto_enabled, 0);
  assert.equal(parseRelease(release("escaped", ['Une phrase avec "des guillemets".'])).notes[0], 'Une phrase avec "des guillemets".');
  assert.equal((await generateDraft()).draft, null);
  mode = "members";
  const { draft } = await generateDraft();
  assert(draft);
  assert.equal(draft.sections.améliorations.length, 1);
  assert.equal(draft.sections.corrections.length, 1);
  const test = await preview(draft.id);
  assert.equal(test.sent, false);
  assert.equal(sent, 0);
  assert.equal(test.characters, description(draft.sections).length);
  assert(!announcementSchema.safeParse({ title: "Trop long", sections: { nouveautés: ["x".repeat(2100)], améliorations: [], corrections: [] } }).success);
  const simultaneous = await Promise.allSettled([
    deliverDraft(draft.id, draft.revision, false, localDelivery),
    deliverDraft(draft.id, draft.revision, false, localDelivery),
  ]);
  assert.equal(simultaneous.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sent, 1);
  assert.equal((await getDraft(draft.id))?.status, "published");
  assert.equal((await settings())?.last_published_sha, b);
  await assert.rejects(() => deliverDraft(draft.id, draft.revision, false, localDelivery));
  assert.equal(sent, 1);
  console.log("PASS brouillon, aperçu, faux envoi HTTP local, concurrence et absence de doublon");

  process.env.VERCEL_GIT_COMMIT_SHA = c;
  mode = "technical";
  assert.equal((await generateDraft()).draft, null);
  const manual = await putDraft(b, c);
  await editDraft(manual.id, 1, { title: "Évolution du profil", sections: { nouveautés: ["Un exemple de nouveauté membre."], améliorations: [], corrections: [] } });
  const fail: typeof fetch = async () => { throw new Error("timeout simulé"); };
  await assert.rejects(() => deliverDraft(manual.id, 2, false, fail));
  assert.equal((await getDraft(manual.id))?.status, "uncertain");
  await assert.rejects(() => deliverDraft(manual.id, 2, false, localDelivery));
  assert.equal(sent, 1);
  const reconcile: typeof fetch = async () => Response.json({ embeds: [{ footer: { text: `Mentora · Annonce ${manual.id}` } }] });
  await reconcileMessage(manual.id, "9999", reconcile);
  assert.equal((await getDraft(manual.id))?.message_id, "9999");
  console.log("PASS envoi ambigu bloqué et rapprochement sans nouvel envoi");

  process.env.VERCEL_ENV = "preview";
  await assert.rejects(validateProduction);
  await assert.rejects(() => toggleAutomatic(true));
  await automaticProductionCheck();
  assert.equal(sent, 1);
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_GIT_COMMIT_SHA = d;
  mode = "members";
  await toggleAutomatic(true);
  await automaticProductionCheck();
  assert.equal(sent, 2);
  await automaticProductionCheck();
  assert.equal(sent, 2);
  await toggleAutomatic(false);
  console.log("PASS mode automatique opt-in, production vérifiée et déploiement de test exclu");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in previousEnvironment)) delete process.env[key];
  Object.assign(process.env, previousEnvironment);
  const db = database();
  if ("close" in db) db.close();
  process.chdir(cwd);
  server.close();
  await rm(directory, { recursive: true, force: true });
}
