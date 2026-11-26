import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { database, query } from "../lib/db";
import { migrateDiscordAccounts } from "../lib/discord-account/store";
import { discordAccountAllowed } from "../lib/discord-account/access";
import {
  begin,
  complete,
  read,
  sync,
  unlink,
  projectRoles,
  callbackUrl,
  AccountError,
} from "../lib/discord-account/service";
import { hash, seal, unseal } from "../lib/discord-account/crypto";
import { DiscordFailure, type DiscordApi } from "../lib/discord-tickets/client";
import { migrateDiscordTickets } from "../lib/discord-tickets/store";
import { migrateDiscordCommunity } from "../lib/discord-community/store";
import { geographicRoles } from "../lib/discord-community/role-options";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local isolated tests only");
process.env.BETTER_AUTH_SECRET =
  "fixture-secret-only-never-production-0123456789";
process.env.DISCORD_TICKET_APPLICATION_ID = "999999999999999999";
process.env.DISCORD_OAUTH_CLIENT_SECRET = "fixture-oauth-secret";
const repo = process.cwd(),
  owner = { id: "owner", sessionId: "session-one" },
  second = { id: "second", sessionId: "session-two" },
  guild = "111111111111111111",
  discord = "222222222222222222";
if (process.argv[2] === "restart") {
  process.chdir(process.argv[3]);
  const d = await read(owner);
  assert.equal(d.account?.snapshot.region, "Bretagne");
  const [r] = await query(
    "SELECT token_cipher FROM discord_account_links WHERE user_id=$1",
    [owner.id],
  );
  assert.equal(
    unseal<any>(String(r.token_cipher)).access_token,
    "fixture-access",
  );
  console.log("PASS new-process persistence and encrypted credentials");
  (database() as DatabaseSync).close();
  process.exit(0);
}
const dir = await mkdtemp(join(tmpdir(), "mentora-discord-account-"));
process.chdir(dir);
let identity = discord,
  revoked = false,
  networkFail = false,
  memberFailure = 0,
  refreshes = 0,
  revocations = 0;
let assigned = ["mentor", "updates", "bretagne"];
const mapping = {
  version: 2,
  status: { beginner: "beginner", mentor: "mentor" },
  updates: "updates",
  announcements: "announcements",
  regions: Object.fromEntries(geographicRoles.map(([k]) => [k, k])),
};
let roles = [
  { id: "mentor" },
  { id: "beginner" },
  { id: "updates" },
  { id: "announcements" },
  ...geographicRoles.map(([id]) => ({ id })),
];
const net: typeof fetch = async (url, init) => {
  if (networkFail) throw Error("network");
  const path = new URL(String(url)).pathname;
  if (path.endsWith("/token/revoke")) {
    revocations++;
    return Response.json({});
  }
  if (path.endsWith("/token")) {
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get("client_secret"), "fixture-oauth-secret");
    if (form.get("grant_type") === "refresh_token") refreshes++;
    else assert(form.get("code_verifier")!.length >= 43);
    if (revoked)
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      scope: "identify",
    });
  }
  if (path.endsWith("/users/@me")) {
    assert.equal((init?.headers as any).Authorization, "Bearer fixture-access");
    return revoked
      ? Response.json({}, { status: 401 })
      : Response.json({
          id: identity,
          username: "discord-member",
          global_name: "Membre Discord",
          avatar: "a_0123456789abcdef0123456789abcdef",
        });
  }
  throw Error("Unexpected OAuth request");
};
const api: DiscordApi = async <T>(path: string, method = "GET") => {
  assert.equal(method, "GET");
  if (path === `/guilds/${guild}/roles`) return roles as T;
  if (path === `/guilds/${guild}/members/${identity}`) {
    if (memberFailure) throw new DiscordFailure(memberFailure);
    return { roles: assigned } as T;
  }
  throw Error("Unexpected bot request");
};
async function flow(actor = owner) {
  const b = await begin(actor),
    url = new URL(b.url);
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.searchParams.get("scope"), "identify");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), callbackUrl);
  return {
    ...b,
    params: new URLSearchParams({
      state: url.searchParams.get("state")!,
      code: "test-code",
      iss: "https://discord.com",
    }),
  };
}
async function expectCode(work: () => Promise<unknown>, code: string) {
  await assert.rejects(
    work,
    (e: any) => e instanceof AccountError && e.code === code,
  );
}
try {
  for (const sql of [
    'CREATE TABLE "user"(id TEXT PRIMARY KEY,email TEXT)',
    "CREATE TABLE moderators(user_id TEXT PRIMARY KEY)",
    "CREATE TABLE crm_connections(owner_id TEXT)",
    "CREATE TABLE profile_blocks(user_id TEXT)",
    "CREATE TABLE beta_preferences(user_id TEXT PRIMARY KEY,enabled INTEGER)",
    "CREATE TABLE profiles(id TEXT,user_id TEXT)",
  ])
    await query(sql);
  await query('INSERT INTO "user" VALUES($1,$2)', [
    owner.id,
    "first@example.invalid",
  ]);
  await query('INSERT INTO "user" VALUES($1,$2)', [
    second.id,
    "second@example.invalid",
  ]);
  await query("INSERT INTO moderators VALUES($1)", [owner.id]);
  await query("INSERT INTO crm_connections VALUES($1)", [owner.id]);
  await query("INSERT INTO beta_preferences VALUES($1,1)", [owner.id]);
  await query("INSERT INTO profiles VALUES($1,$2)", ["own-profile", owner.id]);
  await migrateDiscordTickets();
  await migrateDiscordCommunity();
  await migrateDiscordAccounts();
  await query(
    "INSERT INTO discord_ticket_config(id,guild_id,panel_channel,owner_id,bot_id,updated_at) VALUES('main',$1,'channel','founder','bot','now')",
    [guild],
  );
  await query(
    "INSERT INTO discord_community_panels(kind,channel_id,details) VALUES('roles','channel',$1)",
    [JSON.stringify(mapping)],
  );
  assert(await discordAccountAllowed(owner.id));
  assert(!(await discordAccountAllowed(second.id)));
  assert(!(await discordAccountAllowed(undefined)));
  await expectCode(() => begin(second), "forbidden");
  await expectCode(() => read(second), "forbidden");
  await expectCode(() => sync(second, net, api), "forbidden");
  await expectCode(() => unlink(second, net), "forbidden");
  await query("UPDATE beta_preferences SET enabled=0");
  await expectCode(() => begin(owner), "forbidden");
  await query("UPDATE beta_preferences SET enabled=1");
  await query("INSERT INTO profile_blocks VALUES($1)", [owner.id]);
  assert(!(await discordAccountAllowed(owner.id)));
  await query("DELETE FROM profile_blocks");
  const encrypted = seal({ secret: "private" });
  assert(!encrypted.includes("private"));
  assert.deepEqual(unseal(encrypted), { secret: "private" });
  assert.throws(() => unseal(encrypted.slice(0, -4) + "AAAA"));
  let f = await flow();
  await expectCode(
    () =>
      complete(
        { ...owner, sessionId: "other-session" },
        f.params,
        f.cookie,
        net,
        api,
      ),
    "expired",
  );
  await expectCode(
    () => complete(owner, f.params, "wrong-cookie", net, api),
    "expired",
  );
  await complete(owner, f.params, f.cookie, net, api);
  await expectCode(
    () => complete(owner, f.params, f.cookie, net, api),
    "expired",
  );
  let data = await read(owner);
  assert.equal(data.account?.snapshot.region, "Bretagne");
  assert.equal(data.account?.snapshot.status, "mentor");
  assert.equal(data.account?.snapshot.notifications?.updates, true);
  assert(!JSON.stringify(data).includes("fixture-access"));
  assert(!JSON.stringify(data).includes("token_cipher"));
  const [stored] = await query(
    "SELECT token_cipher FROM discord_account_links WHERE user_id=$1",
    [owner.id],
  );
  assert(!String(stored.token_cipher).includes("fixture-"));
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      join(repo, "node_modules/tsx/dist/loader.mjs"),
      join(repo, "scripts/test-discord-account.ts"),
      "restart",
      dir,
    ],
    {
      cwd: repo,
      env: { ...process.env, TSX_TSCONFIG_PATH: join(repo, "tsconfig.json") },
      encoding: "utf8",
    },
  );
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assigned = ["mentor", "ile-de-france", "announcements"];
  await sync(owner, net, api);
  data = await read(owner);
  assert.equal(data.account?.snapshot.region, "Île-de-France");
  assert.equal(data.account?.snapshot.notifications?.updates, false);
  assigned = ["mentor"];
  await sync(owner, net, api);
  assert.equal((await read(owner)).account?.snapshot.region, null);
  assigned = ["mentor", "beginner", "corse", "bretagne"];
  const projected = await sync(owner, net, api);
  assert.equal(projected.status, null);
  assert.equal(projected.region, null);
  assert.equal(projected.warnings.length, 2);
  roles = roles.filter((r) => r.id !== "corse");
  assert(
    projectRoles(assigned, roles, mapping).warnings.some((w) =>
      w.includes("supprimé"),
    ),
  );
  roles.push({ id: "corse" });
  const [r] = await query(
    "SELECT generation FROM discord_account_links WHERE user_id=$1",
    [owner.id],
  );
  await query("UPDATE discord_account_links SET token_cipher=$1", [
    seal({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_at: 0,
    }),
  ]);
  await sync(owner, net, api);
  assert.equal(refreshes, 1);
  assert.equal(
    (await query("SELECT generation FROM discord_account_links"))[0].generation,
    r.generation,
  );
  memberFailure = 404;
  await expectCode(() => sync(owner, net, api), "not_member");
  assert.deepEqual((await read(owner)).account?.snapshot, {});
  memberFailure = 403;
  await expectCode(() => sync(owner, net, api), "permissions");
  memberFailure = 0;
  assigned = ["mentor", "bretagne"];
  await sync(owner, net, api);
  networkFail = true;
  await expectCode(() => sync(owner, net, api), "unavailable");
  assert.equal((await read(owner)).account?.status, "error");
  assert.equal((await read(owner)).account?.snapshot.region, "Bretagne");
  networkFail = false;
  revoked = true;
  await expectCode(() => sync(owner, net, api), "revoked");
  assert.equal((await read(owner)).account?.status, "revoked");
  assert.equal(
    (await query("SELECT token_cipher FROM discord_account_links"))[0]
      .token_cipher,
    "",
  );
  revoked = false;
  await unlink(owner, net);
  assert(!(await read(owner)).linked);
  f = await flow();
  f.params.set("error", "access_denied");
  await expectCode(
    () => complete(owner, f.params, f.cookie, net, api),
    "cancelled",
  );
  f = await flow();
  await query("UPDATE discord_account_flows SET expires_at='2000-01-01'");
  await expectCode(
    () => complete(owner, f.params, f.cookie, net, api),
    "expired",
  );
  f = await flow();
  f.params.set("iss", "https://example.invalid");
  await expectCode(
    () => complete(owner, f.params, f.cookie, net, api),
    "invalid",
  );
  f = await flow();
  await unlink(owner, net);
  await expectCode(
    () => complete(owner, f.params, f.cookie, net, api),
    "expired",
  );
  f = await flow();
  let releaseExchange!:()=>void, markStarted!:()=>void;
  const exchangePaused=new Promise<void>(resolve=>{releaseExchange=resolve}), exchangeStarted=new Promise<void>(resolve=>{markStarted=resolve});
  const delayedNet:typeof fetch=async(url,init)=>{if(String(url).endsWith('/oauth2/token')){markStarted();await exchangePaused;}return net(url,init)};
  const inFlight=complete(owner,f.params,f.cookie,delayedNet,api);
  await exchangeStarted;await unlink(owner,net);releaseExchange();
  await expectCode(()=>inFlight,'expired');assert(!(await read(owner)).linked);
  f = await flow();
  await complete(owner, f.params, f.cookie, net, api);
  await query("INSERT INTO moderators VALUES($1)", [second.id]);
  await query("INSERT INTO beta_preferences VALUES($1,1)", [second.id]);
  await query("UPDATE primary_administrators SET user_id=$1", [second.id]);
  f = await flow(second);
  await expectCode(
    () => complete(second, f.params, f.cookie, net, api),
    "already_linked",
  );
  assert.equal(
    (await query("SELECT user_id FROM discord_account_links")).length,
    1,
  );
  await query("UPDATE primary_administrators SET user_id=$1", [owner.id]);
  await query(
    "UPDATE discord_account_links SET lease_id='another',lease_until=$1",
    [new Date(Date.now() + 60000).toISOString()],
  );
  await expectCode(() => sync(owner, net, api), "busy");
  await query("UPDATE discord_account_links SET lease_id='',lease_until=''");
  await unlink(owner, net);
  assert(!(await read(owner)).linked);
  assert(revocations > 0);
  assert.equal((await query("SELECT id FROM profiles"))[0].id, "own-profile");
  assert.equal((await query("SELECT user_id FROM moderators")).length, 2);
  console.log(
    "PASS: admin-ID/beta/blocked/normal-user access, OAuth PKCE/state/session/cookie/expiry/cancel/replay, encrypted tokens/new-process persistence, unique Discord identity, refresh/revocation, missing member/role/permission and transient failures, region replace/remove/conflicts, role projection without permissions mutation, unlink and pending-flow invalidation.",
  );
} finally {
  (database() as DatabaseSync).close();
  process.chdir(repo);
  await rm(dir, { recursive: true, force: true });
}
