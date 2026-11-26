import { randomBytes, randomUUID, createHash } from "node:crypto";
import { query, inTransaction } from "../db";
import { SITE_ORIGIN } from "../site";
import { config } from "../discord-tickets/store";
import {
  discordApi,
  DiscordFailure,
  type DiscordApi,
} from "../discord-tickets/client";
import { geographicRoles } from "../discord-community/role-options";
import { discordAccountAllowed } from "./access";
import { hash, seal, unseal } from "./crypto";
export const callbackUrl = `${SITE_ORIGIN}/api/discord-account/callback`;
export const returnPath = "/?mobile=settings&profileTab=appearance&settingsSection=discord#profile";
export type Actor = { id: string; sessionId: string };
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};
export type Snapshot = {
  status: "beginner" | "mentor" | null;
  region: string | null;
  notifications: { updates: boolean; announcements: boolean };
  warnings: string[];
};
export class AccountError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export const messages: Record<string, string> = {
  forbidden: "Accès réservé au compte administrateur principal en bêta.",
  configuration: "La connexion Discord doit encore être configurée.",
  expired: "Cette connexion a expiré. Recommence depuis les paramètres.",
  cancelled: "Connexion Discord annulée.",
  revoked: "La connexion a été révoquée. Reconnecte ton compte Discord.",
  not_member: "Ce compte ne fait pas partie du serveur Mentora.",
  permissions: "Le bot ne peut pas lire les rôles du serveur.",
  unavailable: "Discord est temporairement indisponible. Réessaie.",
  already_linked: "Ce compte Discord est déjà lié à un autre compte Mentora.",
  disconnect_first:
    "Dissocie ton compte Discord actuel avant d’en connecter un autre.",
  busy: "Une synchronisation est déjà en cours. Réessaie dans un instant.",
  unlinked: "Aucun compte Discord connecté.",
  invalid: "Réponse Discord invalide.",
};
export function friendly(error: unknown) {
  return messages[error instanceof AccountError ? error.code : "unavailable"];
}
export async function authorize(actor: Actor) {
  if (!(await discordAccountAllowed(actor.id)))
    throw new AccountError("forbidden");
}
function credentials() {
  const clientId = process.env.DISCORD_TICKET_APPLICATION_ID,
    secret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  if (!clientId || !secret) throw new AccountError("configuration");
  return { clientId, secret };
}
export function configured() {
  return (
    !!process.env.DISCORD_TICKET_APPLICATION_ID &&
    !!process.env.DISCORD_OAUTH_CLIENT_SECRET &&
    !!process.env.BETTER_AUTH_SECRET
  );
}
export type OAuthFetch = typeof fetch;
async function oauth(path: string, init: RequestInit, net: OAuthFetch = fetch) {
  try {
    return await net(`https://discord.com/api/v10${path}`, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new AccountError("unavailable");
  }
}
async function token(body: Record<string, string>, net: OAuthFetch) {
  const { clientId, secret } = credentials(),
    r = await oauth(
      "/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...body,
          client_id: clientId,
          client_secret: secret,
        }),
      },
      net,
    );
  if (!r.ok)
    throw new AccountError(
      r.status === 400 || r.status === 401 ? "revoked" : "unavailable",
    );
  const d = await r.json();
  if (
    typeof d.access_token !== "string" ||
    typeof d.refresh_token !== "string" ||
    !Number.isFinite(d.expires_in) ||
    d.expires_in <= 0 ||
    !String(d.scope).split(" ").includes("identify")
  )
    throw new AccountError("invalid");
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + d.expires_in * 1000,
  } satisfies Tokens;
}
async function identity(t: Tokens, net: OAuthFetch) {
  const r = await oauth(
    "/users/@me",
    { headers: { Authorization: `Bearer ${t.access_token}` } },
    net,
  );
  if (!r.ok)
    throw new AccountError(r.status === 401 ? "revoked" : "unavailable");
  const d = await r.json();
  if (!/^\d{15,22}$/.test(d.id) || typeof d.username !== "string")
    throw new AccountError("invalid");
  return {
    id: d.id as string,
    username: String(d.global_name || d.username).slice(0, 100),
    avatar:
      typeof d.avatar === "string" && /^(a_)?[a-f0-9]{32}$/.test(d.avatar)
        ? d.avatar
        : null,
  };
}
async function revoke(t: Tokens, net: OAuthFetch = fetch) {
  try {
    const { clientId, secret } = credentials();
    await oauth(
      "/oauth2/token/revoke",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: secret,
          token: t.refresh_token,
          token_type_hint: "refresh_token",
        }),
      },
      net,
    );
  } catch {
    /* Local unlink remains final even when Discord is unavailable. */
  }
}
export async function begin(actor: Actor) {
  await authorize(actor);
  const { clientId } = credentials(),
    state = randomBytes(32).toString("base64url"),
    cookie = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url"),
    expires = new Date(Date.now() + 600000).toISOString();
  await query(
    "DELETE FROM discord_account_flows WHERE user_id=$1 OR expires_at<$2",
    [actor.id, new Date().toISOString()],
  );
  await query(
    "INSERT INTO discord_account_flows(state_hash,user_id,session_hash,cookie_hash,verifier_cipher,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [
      hash(state),
      actor.id,
      hash(actor.sessionId),
      hash(cookie),
      seal(verifier),
      expires,
    ],
  );
  const u = new URL("https://discord.com/oauth2/authorize");
  u.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUrl,
    scope: "identify",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "consent",
  }).toString();
  return { url: u.toString(), cookie };
}
export async function complete(
  actor: Actor,
  params: URLSearchParams,
  cookie: string,
  net: OAuthFetch = fetch,
  api: DiscordApi = discordApi,
) {
  await authorize(actor);
  const state = params.get("state") || "";
  if (!/^[\w-]{43}$/.test(state) || !cookie) throw new AccountError("expired");
  const [flow] = await query(
    "UPDATE discord_account_flows SET consumed=1 WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND cookie_hash=$4 AND expires_at>$5 AND consumed=0 RETURNING *",
    [
      hash(state),
      actor.id,
      hash(actor.sessionId),
      hash(cookie),
      new Date().toISOString(),
    ],
  );
  if (!flow) throw new AccountError("expired");
  if (params.get("error")) {
    await query("DELETE FROM discord_account_flows WHERE state_hash=$1", [
      hash(state),
    ]);
    throw new AccountError("cancelled");
  }
  if (params.has("iss") && params.get("iss") !== "https://discord.com")
    throw new AccountError("invalid");
  const code = params.get("code");
  if (!code || code.length > 2000) throw new AccountError("invalid");
  let tokens: Tokens | undefined;
  try {
    tokens = await token(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        code_verifier: unseal<string>(String(flow.verifier_cipher)),
      },
      net,
    );
    const me = await identity(tokens, net),
      generation = randomUUID();
    await inTransaction(async (q) => {
      if (!(await discordAccountAllowed(actor.id)))
        throw new AccountError("forbidden");
      if (
        !(
          await q(
            "UPDATE discord_account_flows SET consumed=2 WHERE state_hash=$1 AND consumed=1 AND expires_at>$2 RETURNING state_hash",
            [hash(state), new Date().toISOString()],
          )
        ).length
      )
        throw new AccountError("expired");
      const [taken] = await q(
        "SELECT user_id FROM discord_account_links WHERE discord_id=$1",
        [me.id],
      );
      if (taken && taken.user_id !== actor.id)
        throw new AccountError("already_linked");
      const [own] = await q(
        "SELECT discord_id FROM discord_account_links WHERE user_id=$1",
        [actor.id],
      );
      if (own && own.discord_id !== me.id)
        throw new AccountError("disconnect_first");
      await q(
        `INSERT INTO discord_account_links(user_id,discord_id,username,avatar,token_cipher,generation,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,avatar=excluded.avatar,token_cipher=excluded.token_cipher,generation=excluded.generation,status='linked',snapshot='{}',error_code='',lease_id='',lease_until=''`,
        [
          actor.id,
          me.id,
          me.username,
          me.avatar,
          seal(tokens),
          generation,
          new Date().toISOString(),
        ],
      );
      await q("DELETE FROM discord_account_flows WHERE user_id=$1", [actor.id]);
    });
  } catch (e) {
    if (tokens) await revoke(tokens, net);
    if (
      (e as any)?.code === "23505" ||
      String((e as Error).message).includes("UNIQUE constraint")
    )
      throw new AccountError("already_linked");
    throw e;
  }
  await sync(actor, net, api);
}
export async function read(actor: Actor) {
  await authorize(actor);
  const [r] = await query(
    "SELECT discord_id,username,avatar,status,snapshot,synced_at,error_code FROM discord_account_links WHERE user_id=$1",
    [actor.id],
  );
  const [p] = await query("SELECT id FROM profiles WHERE user_id=$1", [
    actor.id,
  ]);
  return {
    configured: configured(),
    linked: !!r,
    profileId: p?.id || null,
    account: r
      ? {
          id: r.discord_id,
          username: r.username,
          avatar: r.avatar
            ? `https://cdn.discordapp.com/avatars/${r.discord_id}/${r.avatar}.png?size=128`
            : null,
          status: r.status,
          snapshot: JSON.parse(String(r.snapshot)),
          syncedAt: r.synced_at,
          error: messages[String(r.error_code)] || null,
        }
      : null,
  };
}
export function projectRoles(
  memberRoles: string[],
  roles: { id: string }[],
  details: any,
): Snapshot {
  const valid = new Set(roles.map((r) => r.id)),
    warnings: string[] = [];
  const has = (id: string) => !!id && valid.has(id) && memberRoles.includes(id);
  const mentor = has(details.status?.mentor),
    beginner = has(details.status?.beginner);
  if (mentor && beginner)
    warnings.push(
      "Deux statuts Discord sont présents. Aucun statut Mentora n’a été modifié.",
    );
  const regions = geographicRoles.filter(([key]) =>
    has(details.regions?.[key]),
  );
  if (regions.length > 1)
    warnings.push(
      "Plusieurs régions Discord sont présentes. Choisis une seule région dans Discord.",
    );
  if (
    [
      details.updates,
      details.announcements,
      details.status?.mentor,
      details.status?.beginner,
      ...geographicRoles.map(([key]) => details.regions?.[key]),
    ].some((id) => !valid.has(id))
  )
    warnings.push(
      "Un rôle configuré a été supprimé ou reste à configurer sur Discord.",
    );
  return {
    status:
      mentor && beginner
        ? null
        : mentor
          ? "mentor"
          : beginner
            ? "beginner"
            : null,
    region: regions.length === 1 ? regions[0][1] : null,
    notifications: {
      updates: has(details.updates),
      announcements: has(details.announcements),
    },
    warnings,
  };
}
export async function sync(
  actor: Actor,
  net: OAuthFetch = fetch,
  api: DiscordApi = discordApi,
) {
  await authorize(actor);
  const lock = randomUUID(),
    now = new Date().toISOString();
  const [r] = await query(
    "UPDATE discord_account_links SET lease_id=$2,lease_until=$3 WHERE user_id=$1 AND (lease_id='' OR lease_until<$4) RETURNING *",
    [actor.id, lock, new Date(Date.now() + 60000).toISOString(), now],
  );
  if (!r) {
    if (
      (
        await query(
          "SELECT user_id FROM discord_account_links WHERE user_id=$1",
          [actor.id],
        )
      ).length
    )
      throw new AccountError("busy");
    throw new AccountError("unlinked");
  }
  try {
    if (r.status === "revoked") throw new AccountError("revoked");
    let t = unseal<Tokens>(String(r.token_cipher));
    if (t.expires_at < Date.now() + 30000) {
      t = await token(
        { grant_type: "refresh_token", refresh_token: t.refresh_token },
        net,
      );
      await query(
        "UPDATE discord_account_links SET token_cipher=$3 WHERE user_id=$1 AND generation=$2 AND lease_id=$4",
        [actor.id, String(r.generation), seal(t), lock],
      );
    }
    const me = await identity(t, net);
    if (me.id !== r.discord_id) throw new AccountError("invalid");
    const c = await config();
    if (!c) throw new AccountError("configuration");
    let member: { roles: string[] }, roles: { id: string }[];
    try {
      [member, roles] = await Promise.all([
        api<{ roles: string[] }>(`/guilds/${c.guild_id}/members/${me.id}`),
        api<{ id: string }[]>(`/guilds/${c.guild_id}/roles`),
      ]);
    } catch (e) {
      if (e instanceof DiscordFailure)
        throw new AccountError(
          e.status === 404
            ? "not_member"
            : e.status === 403
              ? "permissions"
              : "unavailable",
        );
      throw e;
    }
    const [panel] = await query(
      "SELECT details FROM discord_community_panels WHERE kind='roles'",
    );
    const snapshot = projectRoles(
      member.roles,
      roles,
      JSON.parse(String(panel?.details || "{}")),
    );
    await query(
      "UPDATE discord_account_links SET snapshot=$3,status='linked',error_code='',synced_at=$4,username=$5,avatar=$6 WHERE user_id=$1 AND generation=$2 AND lease_id=$7",
      [
        actor.id,
        String(r.generation),
        JSON.stringify(snapshot),
        new Date().toISOString(),
        me.username,
        me.avatar,
        lock,
      ],
    );
    return snapshot;
  } catch (e) {
    const code = e instanceof AccountError ? e.code : "unavailable";
    const clear = ["revoked", "not_member", "permissions"].includes(code);
    await query(
      `UPDATE discord_account_links SET error_code=$3,status=$4${clear ? ",snapshot='{}'" : ""}${code === "revoked" ? ",token_cipher=''" : ""} WHERE user_id=$1 AND generation=$2 AND lease_id=$5`,
      [
        actor.id,
        String(r.generation),
        code,
        code === "revoked" ? "revoked" : "error",
        lock,
      ],
    );
    throw e;
  } finally {
    await query(
      "UPDATE discord_account_links SET lease_id='',lease_until='' WHERE user_id=$1 AND lease_id=$2",
      [actor.id, lock],
    );
  }
}
export async function unlink(actor: Actor, net: OAuthFetch = fetch) {
  await authorize(actor);
  const tokenCipher = await inTransaction(async (q) => {
    // Lock/delete flows first, matching callback lock order, so an in-flight
    // callback cannot recreate a link after the user has disconnected it.
    await q("DELETE FROM discord_account_flows WHERE user_id=$1", [actor.id]);
    const [r] = await q(
      "DELETE FROM discord_account_links WHERE user_id=$1 RETURNING token_cipher",
      [actor.id],
    );
    return r?.token_cipher;
  });
  if (tokenCipher) {
    try {
      await revoke(unseal<Tokens>(String(tokenCipher)), net);
    } catch {}
  }
}
export async function syncLinkedMember(discordId: string) {
  const [r] = await query(
    "SELECT user_id FROM discord_account_links WHERE discord_id=$1",
    [discordId],
  );
  if (!r || !(await discordAccountAllowed(String(r.user_id)))) return;
  try {
    await sync({ id: String(r.user_id), sessionId: "" });
  } catch {
    /* Manual synchronization exposes a readable error without failing Discord buttons. */
  }
}
