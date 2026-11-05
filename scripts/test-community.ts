import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
import {
  communityMentionRelevant,
  communityCounts,
  readCommunityChannel,
} from "../lib/community";
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
    email: `community-${stamp}-${n}@example.invalid`,
    password: "Relais-test-local-2026!",
  });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  const user = { id: a.data.user.id, cookie: a.cookie };
  accounts.push(user);
  await query(
    "INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$2,$3,$4,$5,$6,1,$7)",
    [
      randomUUID(),
      user.id,
      `community_${stamp}_${n}`,
      role,
      `Communauté ${role} ${n}`,
      JSON.stringify({ ...initialProfile, role, experience: 12 }),
      new Date().toISOString(),
    ],
  );
  return user;
}
try {
  const mentor = await account("mentor", 1),
    otherMentor = await account("mentor", 2),
    beginner = await account("beginner", 3);
  assert.equal((await call("/api/community")).status, 401);
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "test" },
        mentor.cookie,
        "https://wrong.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "test", room: "beginner" },
        mentor.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "test", mentions: [beginner.id] },
        mentor.cookie,
      )
    ).status,
    403,
  );
  await query(
    "INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,label,created_at) VALUES($1,$2,$3,'key','auth','test',$4)",
    [
      randomUUID(),
      otherMentor.id,
      `https://fcm.googleapis.com/test-${stamp}`,
      new Date().toISOString(),
    ],
  );
  const posted = await call(
    "/api/community",
    "POST",
    {
      body: "Conseil test <script>alert(1)</script>",
      mentions: [otherMentor.id, otherMentor.id],
    },
    mentor.cookie,
  );
  assert.equal(posted.status, 201, JSON.stringify(posted.data));
  const id = posted.data.id;
  assert.equal(
    (
      await call(
        "/api/community",
        "PUT",
        { id, body: "Correction" },
        mentor.cookie,
      )
    ).status,
    403,
  );
  await call("/api/beta", "PUT", { enabled: true }, mentor.cookie);
  await call("/api/beta", "PUT", { enabled: true }, otherMentor.cookie);
  await call("/api/beta", "PUT", { enabled: true }, beginner.cookie);
  assert.equal(
    (
      await call(
        "/api/community",
        "PUT",
        { id, body: "Correction interdite" },
        otherMentor.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "PUT",
        { id, body: "Conseil corrigé" },
        mentor.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "Réponse dans mon salon", replyTo: id },
        otherMentor.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        "/api/community",
        "POST",
        { body: "Réponse hors salon", replyTo: id },
        beginner.cookie,
      )
    ).status,
    403,
  );

  const list = await call(
    "/api/community",
    "GET",
    undefined,
    otherMentor.cookie,
  );
  assert.ok(list.data.messages.some((m: { id: string }) => m.id === id));
  assert.match(list.cache || "", /private, no-store/);
  assert.equal(
    (
      await call(
        "/api/community?mentions=1",
        "GET",
        undefined,
        otherMentor.cookie,
      )
    ).data.messages.filter((m: { id: string }) => m.id === id).length,
    1,
  );
  assert.equal(
    (
      await call(
        "/api/community?summary=1",
        "GET",
        undefined,
        otherMentor.cookie,
      )
    ).data.unread,
    1,
  );
  assert.equal(
    (await query("SELECT id FROM push_outbox WHERE event_id=$1", [id])).length,
    1,
  );
  assert.equal(await communityMentionRelevant(id, otherMentor.id), true);
  assert.equal(await communityMentionRelevant(id, beginner.id), false);
  for (const suffix of ["", "?room=mentor", `?before=${id}`, "?mentions=1"]) {
    const data = await call(
      "/api/community" + suffix,
      "GET",
      undefined,
      beginner.cookie,
    );
    if (suffix === "?room=mentor") assert.equal(data.status, 403);
    else
      assert.ok(!data.data.messages.some((m: { id: string }) => m.id === id));
  }
  assert.ok(
    (await communityCounts(otherMentor.id)).some((c) => Number(c.unread) > 0),
  );
  assert.equal(await readCommunityChannel(beginner.id, id), false);
  assert.equal(await readCommunityChannel(otherMentor.id, id), true);
  assert.equal(
    (await communityCounts(otherMentor.id)).find((c) => c.id === "general")
      ?.unread,
    0,
  );
  await query("INSERT INTO moderators(user_id,email) VALUES($1,$2)", [
    beginner.id,
    `admin-${stamp}@example.invalid`,
  ]);
  const adminFeed = await call(
    "/api/community?room=mentor",
    "GET",
    undefined,
    beginner.cookie,
  );
  assert.equal(adminFeed.status, 200);
  assert.equal(adminFeed.data.canPost, false);
  assert.ok(adminFeed.data.messages.some((m: { id: string }) => m.id === id));
  await query("DELETE FROM moderators WHERE user_id=$1", [beginner.id]);
  const members = await call(
    "/api/community?members=Communaut",
    "GET",
    undefined,
    beginner.cookie,
  );
  assert.ok(
    !members.data.members.some((m: { user_id: string }) =>
      [mentor.id, otherMentor.id].includes(m.user_id),
    ),
  );
  assert.equal(
    (await call("/api/community", "DELETE", { id }, beginner.cookie)).status,
    403,
  );
  assert.equal(
    (await call("/api/community", "DELETE", { id }, otherMentor.cookie)).status,
    403,
  );
  await call("/api/community", "PATCH", { ids: [id] }, beginner.cookie);
  assert.equal(
    (
      await call(
        "/api/community?summary=1",
        "GET",
        undefined,
        otherMentor.cookie,
      )
    ).data.unread,
    1,
  );
  await query("UPDATE profiles SET role='beginner' WHERE user_id=$1", [
    otherMentor.id,
  ]);
  assert.equal(await communityMentionRelevant(id, otherMentor.id), false);
  assert.ok(
    !(
      await call("/api/community", "GET", undefined, otherMentor.cookie)
    ).data.messages.some((m: { id: string }) => m.id === id),
  );
  await query("UPDATE profiles SET role='mentor' WHERE user_id=$1", [
    otherMentor.id,
  ]);
  await call("/api/community", "PATCH", { ids: [id] }, otherMentor.cookie);
  assert.equal(await communityMentionRelevant(id, otherMentor.id), false);
  assert.equal(
    (
      await call(
        "/api/community?summary=1",
        "GET",
        undefined,
        otherMentor.cookie,
      )
    ).data.unread,
    0,
  );
  await query(
    "INSERT INTO profile_blocks(user_id,reason,moderator_id,created_at) VALUES($1,'test',$1,$2)",
    [mentor.id, new Date().toISOString()],
  );
  assert.equal(
    (await call("/api/community", "GET", undefined, mentor.cookie)).status,
    403,
  );
  assert.ok(
    !(
      await call("/api/community", "GET", undefined, otherMentor.cookie)
    ).data.messages.some((m: { id: string }) => m.id === id),
  );
  await query("DELETE FROM profile_blocks WHERE user_id=$1", [mentor.id]);
  assert.equal(
    (await call("/api/community", "DELETE", { id }, mentor.cookie)).status,
    200,
  );
  assert.equal(
    (await query("SELECT * FROM community_mentions WHERE message_id=$1", [id]))
      .length,
    0,
  );
  console.log(
    "Community: role isolation, forged roles/mentions, CSRF, private caching, persistence, unread mentions, push deduplication, role changes, blocking and deletion passed.",
  );
} finally {
  for (const a of accounts) {
    await query("DELETE FROM community_reads WHERE user_id=$1", [a.id]);
    await query("DELETE FROM moderators WHERE user_id=$1", [a.id]);
    await query("DELETE FROM push_outbox WHERE user_id=$1", [a.id]);
    await query("DELETE FROM push_subscriptions WHERE user_id=$1", [a.id]);
    await query(
      "DELETE FROM community_mentions WHERE user_id=$1 OR message_id IN (SELECT id FROM community_messages WHERE author_id=$1)",
      [a.id],
    );
    await query("DELETE FROM community_messages WHERE author_id=$1", [a.id]);
    await query("DELETE FROM profile_blocks WHERE user_id=$1", [a.id]);
    await call(
      "/api/auth/delete-user",
      "POST",
      { password: "Relais-test-local-2026!" },
      a.cookie,
    );
  }
}
