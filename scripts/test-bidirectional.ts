import assert from "node:assert/strict";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
import { processEvents } from "../lib/email";
import { renderMail } from "../lib/email-templates";
if (
  process.env.DATABASE_URL ||
  process.env.VERCEL ||
  process.env.GMAIL_APP_PASSWORD
)
  throw Error("Local only, no SMTP");
const base = "http://127.0.0.1:3001";
const accounts: {
  id: string;
  cookie: string;
  profileId: string;
  role: string;
}[] = [];
const snap = (
  await query("SELECT data FROM platform_settings WHERE id='main'")
)[0];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  u?: (typeof accounts)[number],
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(u ? { cookie: u.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; "),
  };
}
try {
  const cfg = JSON.parse(String(snap.data));
  await query("UPDATE platform_settings SET data=$1 WHERE id='main'", [
    JSON.stringify({
      ...cfg,
      requestsEnabled: true,
      verifiedMentorsOnly: false,
    }),
  ]);
  for (const role of ["mentor", "mentor", "beginner", "beginner", "beginner"]) {
    const suffix = crypto.randomUUID().slice(0, 8);
    const r = await call("/api/auth/sign-up/email", "POST", {
      name: "Test demandes",
      email: `pair-${suffix}@example.invalid`,
      password: "Mentora-pair-test-2026!",
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const a = { id: r.data.user.id, cookie: r.cookie, profileId: "", role };
    accounts.push(a);
    const p = await call(
      "/api/me",
      "PUT",
      {
        ...initialProfile,
        role,
        name: "Test demandes",
        discord: `private_${suffix}`,
        bio: "Profil temporaire de test des demandes.",
        goals: "Progresser dans mes ventes de vêtements.",
        capacity: 1,
        experience: 12,
      },
      a,
    );
    assert.equal(p.status, 200, JSON.stringify(p.data));
    a.profileId = p.data.profile.id;
  }
  const [m, n, b, c, d] = accounts;
  const post = (from: typeof m, to: typeof m) =>
    call(
      "/api/accompaniments",
      "POST",
      {
        targetProfileId: to.profileId,
        objective: "Je peux t’aider à améliorer tes annonces.",
      },
      from,
    );
  const rows = async (u: typeof m) =>
    (await call("/api/accompaniments", "GET", undefined, u)).data
      .accompaniments;
  const act = (u: typeof m, id: string, action: string, reason?: string) =>
    call("/api/accompaniments", "PATCH", { id, action, reason }, u);
  assert.equal(
    (await call("/api/profiles?contact=" + m.profileId, "GET", undefined, b))
      .status,
    403,
  );
  assert.equal((await post(m, b)).status, 201);
  let pair = (await rows(b))[0];
  assert.equal(pair.direction, "received");
  assert.equal(pair.partner_discord, null);
  assert.equal((await rows(m))[0].direction, "sent");
  assert.equal((await act(m, pair.id, "accept")).status, 409);
  assert.equal((await act(b, pair.id, "decline")).status, 400);
  assert.equal((await act(b, pair.id, "decline", "   ")).status, 400);
  await processEvents();
  const pending = await query(
    "SELECT user_id,payload FROM email_outbox WHERE event_id=$1 AND kind='request_received'",
    [`pair:${pair.id}:pending`],
  );
  assert.equal(pending[0].user_id, b.id);
  assert(!JSON.parse(String(pending[0].payload)).discord);
  const reason = "Je cherche une aide sur une autre spécialité.";
  assert.equal((await act(b, pair.id, "decline", reason)).status, 200);
  assert.equal((await rows(m))[0].decline_reason, reason);
  await processEvents();
  const declined = (
    await query(
      "SELECT * FROM email_outbox WHERE event_id=$1 AND kind='declined'",
      [`pair:${pair.id}:declined`],
    )
  )[0];
  assert.equal(declined.user_id, m.id);
  assert(
    renderMail("declined", JSON.parse(String(declined.payload))).text.includes(
      reason,
    ),
  );
  assert.equal(
    (await call("/api/profiles?contact=" + m.profileId, "GET", undefined, b))
      .status,
    403,
  );
  assert.equal((await post(m, c)).status, 201);
  assert.equal((await post(d, m)).status, 201);
  const pc = (await rows(c))[0],
    pd = (await rows(d))[0];
  const results = await Promise.all([
    act(c, pc.id, "accept"),
    act(m, pd.id, "accept"),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const active = (
    await query(
      "SELECT * FROM accompaniments WHERE mentor_id=$1 AND status='active'",
      [m.id],
    )
  )[0];
  const accepted = accounts.find((a) => a.id === active.beginner_id)!;
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + m.profileId,
        "GET",
        undefined,
        accepted,
      )
    ).status,
    200,
  );
  assert((await rows(accepted))[0].partner_discord);
  assert.equal(
    (await call("/api/profiles?contact=" + m.profileId, "GET", undefined, n))
      .status,
    403,
  );
  await processEvents();
  assert.equal(
    (
      await query(
        "SELECT * FROM email_outbox WHERE event_id=$1 AND kind='accepted'",
        [`pair:${active.id}:active`],
      )
    ).length,
    2,
  );
  assert.equal((await post(n, accepted)).status, 201);
  const other = (await rows(n))[0];
  assert.equal((await act(accepted, other.id, "accept")).status, 409);
  assert.equal((await act(n, other.id, "cancel")).status, 200);
  assert.equal(
    (await act(accepted, String(active.id), "complete")).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + m.profileId,
        "GET",
        undefined,
        accepted,
      )
    ).status,
    200,
  );
  for (const k of [
    "request_received",
    "request_sent",
    "declined",
    "cancelled",
  ] as const)
    assert(
      !renderMail(k, { name: "Test", discord: "SECRET_CONTACT" }).text.includes(
        "SECRET_CONTACT",
      ),
    );
  console.log(
    "PASS: two-way requests, recipient-only decisions, mandatory reasons, private Discord until acceptance, inbox directions, email recipients/reasons, concurrent capacity and single mentor, cancellation/completion. No real email sent.",
  );
} finally {
  for (const a of accounts) {
    await query(
      "DELETE FROM accompaniments WHERE mentor_id=$1 OR beginner_id=$1",
      [a.id],
    );
    for (const t of [
      "email_outbox",
      "email_availability",
      "member_activity",
      "profile_timing",
      "profiles",
    ])
      await query(`DELETE FROM ${t} WHERE user_id=$1`, [a.id]);
    await query('DELETE FROM session WHERE "userId"=$1', [a.id]);
    await query('DELETE FROM account WHERE "userId"=$1', [a.id]);
    await query('DELETE FROM "user" WHERE id=$1', [a.id]);
  }
  await query(
    "DELETE FROM email_events WHERE kind IN ('pending','active','declined','cancelled','completed') AND NOT EXISTS(SELECT 1 FROM accompaniments a WHERE a.id=email_events.entity_id)",
  );
  await query("UPDATE platform_settings SET data=$1 WHERE id='main'", [
    String(snap.data),
  ]);
}
