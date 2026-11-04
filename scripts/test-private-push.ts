import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { query } from "../lib/db";
import { sendPrivate } from "../lib/mobile-space";
import { runPushWorker } from "../lib/push";
if (process.env.DATABASE_URL || process.env.VERCEL) throw Error("Local only");
const ids = [randomUUID(), randomUUID()],
  chat = randomUUID(),
  saved = webpush.sendNotification,
  old = [
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
    process.env.VAPID_SUBJECT,
  ],
  sent: string[] = [];
try {
  for (const id of ids) {
    await query(
      `INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$1,$1,'mentor','Private push test','{}',1,$2)`,
      [id, new Date().toISOString()],
    );
    await query(
      "INSERT INTO beta_preferences(user_id,enabled,updated_at) VALUES($1,1,$2)",
      [id, new Date().toISOString()],
    );
  }
  await query(
    "INSERT INTO private_chats(id,user_a,user_b,requested_by,status,created_at) VALUES($1,$2,$3,$2,'accepted',$4)",
    [chat, ...ids, new Date().toISOString()],
  );
  for (let i = 0; i < 2; i++)
    await query(
      "INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,label,created_at) VALUES($1,$2,$3,'test','test','Test',$4)",
      [
        randomUUID(),
        ids[1],
        `https://fcm.googleapis.com/private-test-${chat}-${i}`,
        new Date().toISOString(),
      ],
    );
  const message = await sendPrivate(ids[0], chat, "Secret message content");
  process.env.VAPID_PUBLIC_KEY = "test";
  process.env.VAPID_PRIVATE_KEY = "test";
  process.env.VAPID_SUBJECT = "mailto:test@example.invalid";
  webpush.sendNotification = (async (sub, payload) => {
    sent.push(String(payload));
    return { statusCode: 201, body: "", headers: {} };
  }) as typeof saved;
  assert.equal((await runPushWorker(message)).sent, 2);
  assert.ok(
    sent.every(
      (p) =>
        !p.includes("Secret") && JSON.parse(p).url.includes("mobile=messages"),
    ),
  );
  assert.equal((await runPushWorker(message)).sent, 0);
  await query("UPDATE private_messages SET created_at=$1 WHERE author_id=$2", [
    new Date(Date.now() - 5000).toISOString(),
    ids[0],
  ]);
  const second = await sendPrivate(ids[0], chat, "Hidden after block");
  await query("INSERT INTO member_blocks(user_id,target_id) VALUES($1,$2)", [
    ids[1],
    ids[0],
  ]);
  assert.equal((await runPushWorker(second)).sent, 0);
  console.log(
    "Private push: two devices, deep link, no message content, deduplication and blocking verified with simulated provider.",
  );
} finally {
  webpush.sendNotification = saved;
  for (const [i, key] of [
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ].entries()) {
    if (old[i] === undefined) delete process.env[key];
    else process.env[key] = old[i];
  }
  await query("DELETE FROM private_messages WHERE chat_id=$1", [chat]);
  await query("DELETE FROM private_chats WHERE id=$1", [chat]);
  for (const id of ids) {
    await query("DELETE FROM push_outbox WHERE user_id=$1", [id]);
    await query("DELETE FROM push_subscriptions WHERE user_id=$1", [id]);
    await query("DELETE FROM member_blocks WHERE user_id=$1 OR target_id=$1", [
      id,
    ]);
    await query("DELETE FROM beta_preferences WHERE user_id=$1", [id]);
    await query("DELETE FROM profiles WHERE user_id=$1", [id]);
  }
}
