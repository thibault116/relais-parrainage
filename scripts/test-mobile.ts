import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
import { communityMentionRelevant } from "../lib/community";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
if (
  process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Local tests only");
const stamp = randomUUID().slice(0, 8);
const accounts: { id: string; cookie: string }[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin = base,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    cache: r.headers.get("cache-control"),
  };
}
async function account(role: string, n: number) {
  const a = await call("/api/auth/sign-up/email", "POST", {
    name: `Communauté ${role} ${n}`,
    email: `mobile-${stamp}-${n}@example.invalid`,
    password: "Relais-test-local-2026!",
  });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  const user = { id: a.data.user.id, cookie: a.cookie };
  accounts.push(user);
  const p = await call(
    "/api/me",
    "PUT",
    {
      ...initialProfile,
      role,
      name: `Communauté ${role} ${n}`,
      discord: `community_${stamp}_${n}`,
      experience: 12,
      bio: "Compte fictif pour vérifier les échanges.",
      goals: "Progresser en achat-revente",
      references: "Vintage",
      specialty: ["Vintage"],
    },
    a.cookie,
  );
  assert.equal(p.status, 200, JSON.stringify(p.data));
  return user;
}
const profiles: string[] = [];
const proofPaths: string[] = [];
const pairId = randomUUID();
try {
  const a = await account("mentor", 1),
    b = await account("beginner", 2),
    outsider = await account("mentor", 3);
  for (const x of accounts)
    profiles.push(
      String(
        (await query("SELECT id FROM profiles WHERE user_id=$1", [x.id]))[0].id,
      ),
    );
  assert.equal((await call("/api/messages")).status, 401);
  assert.equal(
    (await call("/api/messages", "GET", undefined, a.cookie)).status,
    403,
  );
  for (const x of accounts)
    await query(
      "INSERT INTO beta_preferences(user_id,enabled,updated_at) VALUES($1,1,$2) ON CONFLICT(user_id) DO UPDATE SET enabled=1",
      [x.id, new Date().toISOString()],
    );
  assert.equal(
    (
      await call(
        "/api/messages",
        "POST",
        { action: "connect", profileId: profiles[1] },
        a.cookie,
        "https://evil.example",
      )
    ).status,
    403,
  );
  const connected = await call(
    "/api/messages",
    "POST",
    { action: "connect", profileId: profiles[1] },
    a.cookie,
  );
  assert.equal(connected.status, 201, JSON.stringify(connected.data));
  const id = connected.data.id;
  assert.equal(
    (
      await call(
        "/api/messages",
        "POST",
        { action: "send", id, body: "Avant acceptation" },
        a.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/messages", "POST", { action: "accept", id }, a.cookie))
      .status,
    403,
  );
  assert.equal(
    (await call("/api/messages?chat=" + id, "GET", undefined, outsider.cookie))
      .status,
    403,
  );
  assert.equal(
    (await call("/api/messages", "POST", { action: "accept", id }, b.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/messages",
        "POST",
        { action: "send", id, body: "Message privé de test" },
        a.cookie,
      )
    ).status,
    201,
  );
  const history = await call(
    "/api/messages?chat=" + id,
    "GET",
    undefined,
    b.cookie,
  );
  assert.equal(history.data.messages.length, 1);
  assert.equal(history.data.messages[0].body, "Message privé de test");
  assert.match(history.cache || "", /no-store/);
  await query("UPDATE private_messages SET created_at=$1 WHERE author_id=$2", [
    new Date(Date.now() - 5000).toISOString(),
    a.id,
  ]);
  const form = new FormData();
  form.set("chat", id);
  form.set("body", "Photo de test");
  form.set(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "test.png",
  );
  const uploaded = await fetch(base + "/api/messages", {
    method: "POST",
    headers: { Origin: base, Cookie: a.cookie },
    body: form,
  });
  assert.equal(uploaded.status, 201, await uploaded.text());
  const [attachment] = await query(
    "SELECT id,file_path FROM private_messages WHERE chat_id=$1 AND file_path IS NOT NULL",
    [id],
  );
  proofPaths.push(String(attachment.file_path));
  const ownImage = await fetch(base + "/api/messages?file=" + attachment.id, {
    headers: { Cookie: b.cookie },
  });
  assert.equal(ownImage.status, 200);
  assert.match(ownImage.headers.get("cache-control") || "", /no-store/);
  assert.equal(
    (
      await fetch(base + "/api/messages?file=" + attachment.id, {
        headers: { Cookie: outsider.cookie },
      })
    ).status,
    403,
  );
  await query(
    "INSERT INTO accompaniments(id,mentor_id,beginner_id,status,created_at) VALUES($1,$2,$3,'active',$4)",
    [pairId, a.id, b.id, new Date().toISOString()],
  );
  assert.equal(
    (
      await call(
        "/api/mobile",
        "POST",
        { action: "note", id: pairId, body: "Objectif partagé" },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/mobile?pair=" + pairId, "GET", undefined, b.cookie)).data
      .notes[0].body,
    "Objectif partagé",
  );
  assert.equal(
    (
      await call(
        "/api/mobile?pair=" + pairId,
        "GET",
        undefined,
        outsider.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/messages", "POST", { action: "block", id }, b.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/messages",
        "POST",
        { action: "send", id, body: "Bloqué" },
        a.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/messages", "POST", { action: "unblock", id }, b.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/messages",
        "POST",
        { action: "pin", id, value: true },
        b.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    Number(
      (await call("/api/messages", "GET", undefined, b.cookie)).data.chats[0]
        .pinned,
    ),
    1,
  );
  assert.equal(
    (
      await call(
        "/api/mobile",
        "POST",
        { action: "bookmark", id: profiles[1], saved: true },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/mobile", "GET", undefined, a.cookie)).data.bookmarks
      .length,
    1,
  );
  assert.equal(
    (await call("/api/mobile", "GET", undefined, b.cookie)).data.bookmarks
      .length,
    0,
  );
  assert.equal(
    (
      await call(
        "/api/mobile",
        "POST",
        { action: "note", id: randomUUID(), body: "Note interdite" },
        outsider.cookie,
      )
    ).status,
    403,
  );
  const topic = await call(
    "/api/community",
    "POST",
    { body: "Sourcing test", channel: "sourcing" },
    a.cookie,
  );
  assert.equal(topic.status, 201, JSON.stringify(topic.data));
  assert.ok(
    (
      await call("/api/community?channel=sourcing", "GET", undefined, a.cookie)
    ).data.messages.some((m: any) => m.id === topic.data.id),
  );
  assert.ok(
    !(
      await call("/api/community?channel=general", "GET", undefined, a.cookie)
    ).data.messages.some((m: any) => m.id === topic.data.id),
  );
  assert.ok(
    !(
      await call("/api/community?channel=sourcing", "GET", undefined, b.cookie)
    ).data.messages.some((m: any) => m.id === topic.data.id),
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "Fausse annonce", channel: "announcements" },
        a.cookie,
      )
    ).status,
    403,
  );
  await query("UPDATE beta_preferences SET enabled=0 WHERE user_id=$1", [a.id]);
  assert.equal(
    (await call("/api/messages?chat=" + id, "GET", undefined, a.cookie)).status,
    403,
  );
  assert.equal(
    (await call("/api/mobile", "GET", undefined, a.cookie)).status,
    403,
  );
  assert.equal(
    (await call("/api/community", "GET", undefined, a.cookie)).status,
    200,
  );
  console.log(
    "Mobile API: authentication, beta opt-out, contact acceptance, chat isolation, blocking, pinning, bookmark ownership, notes denial and community channel isolation passed.",
  );
} finally {
  const { deleteProof } = await import("../lib/proof-storage");
  for (const path of proofPaths) await deleteProof(path);
  await query("DELETE FROM pair_notes WHERE pair_id=$1", [pairId]);
  await query("DELETE FROM accompaniments WHERE id=$1", [pairId]);
  await query("DELETE FROM email_events WHERE entity_id=$1", [pairId]);
  for (const a of accounts) {
    await query(
      "DELETE FROM private_messages WHERE chat_id IN(SELECT id FROM private_chats WHERE user_a=$1 OR user_b=$1)",
      [a.id],
    );
    await query("DELETE FROM private_chat_preferences WHERE user_id=$1", [
      a.id,
    ]);
    await query("DELETE FROM private_chats WHERE user_a=$1 OR user_b=$1", [
      a.id,
    ]);
    await query("DELETE FROM member_blocks WHERE user_id=$1 OR target_id=$1", [
      a.id,
    ]);
    await query("DELETE FROM member_bookmarks WHERE user_id=$1", [a.id]);
    await query("DELETE FROM community_messages WHERE author_id=$1", [a.id]);
    await query("DELETE FROM beta_preferences WHERE user_id=$1", [a.id]);
    await query("DELETE FROM push_outbox WHERE user_id=$1", [a.id]);
    await call(
      "/api/auth/delete-user",
      "POST",
      { password: "Relais-test-local-2026!" },
      a.cookie,
    );
  }
}
