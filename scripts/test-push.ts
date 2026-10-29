import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import webpush from "web-push";
import { database, query } from "../lib/db";
import {
  migratePush,
  subscribe,
  removeSubscription,
  enqueuePush,
  runPushWorker,
  validPushEndpoint,
  subscriptionSchema,
  pushMessages,
} from "../lib/push";
import { enqueueMail, processEvents } from "../lib/email";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Isolated local tests only.");
const cwd = process.cwd(),
  temp = mkdtempSync(join(tmpdir(), "mentora-push-test-"));
process.chdir(temp);
const original = webpush.sendNotification;
const sent: { sub: webpush.PushSubscription; data: Record<string, unknown> }[] =
  [];
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.VAPID_SUBJECT = "mailto:test@example.invalid";
webpush.sendNotification = async (sub, payload) => {
  sent.push({ sub, data: JSON.parse(String(payload)) });
  return { statusCode: 201, body: "", headers: {} };
};
try {
  await query('CREATE TABLE "user"(id TEXT PRIMARY KEY,email TEXT,name TEXT)');
  await query(
    "CREATE TABLE email_events(id TEXT PRIMARY KEY,kind TEXT,entity_id TEXT,created_at TEXT,processed INTEGER DEFAULT 0)",
  );
  await query(
    "CREATE TABLE email_outbox(id TEXT PRIMARY KEY,event_id TEXT,user_id TEXT,kind TEXT,payload TEXT,test INTEGER,created_at TEXT)",
  );
  await query(
    "CREATE TABLE profiles(user_id TEXT PRIMARY KEY,id TEXT,name TEXT,discord TEXT,details TEXT,visible INTEGER,role TEXT)",
  );
  await query(
    "CREATE TABLE accompaniments(id TEXT PRIMARY KEY,beginner_id TEXT,mentor_id TEXT,initiator_id TEXT,status TEXT,objective TEXT,decline_reason TEXT)",
  );
  await query(
    "CREATE TABLE verifications(user_id TEXT PRIMARY KEY,revision TEXT,status TEXT,feedback TEXT)",
  );
  await query("CREATE TABLE follows(follower_id TEXT,followed_id TEXT)");
  await query("CREATE TABLE profile_blocks(user_id TEXT)");
  await migratePush();
  for (const id of ["a", "b"]) {
    await query('INSERT INTO "user" VALUES($1,$2,$1)', [
      id,
      id + "@example.invalid",
    ]);
    await query("INSERT INTO profiles VALUES($1,$1,$2,$3,$4,1,$5)", [
      id,
      "Private name " + id,
      "private.discord",
      JSON.stringify({ capacity: 3 }),
      id === "a" ? "beginner" : "mentor",
    ]);
  }
  const makeSub = (suffix: string) => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/" + suffix,
    keys: {
      p256dh: Buffer.alloc(65, 1).toString("base64url"),
      auth: Buffer.alloc(16, 2).toString("base64url"),
    },
  });
  assert(validPushEndpoint("https://web.push.apple.com/a"));
  assert(!validPushEndpoint("https://fcm.googleapis.com.evil.test/a"));
  assert(!validPushEndpoint("http://127.0.0.1/a"));
  assert(!validPushEndpoint("https://fcm.googleapis.com:8443/a"));
  assert(subscriptionSchema.safeParse(makeSub("1")).success);
  const a = await subscribe("a", makeSub("1"), "iPhone"),
    a2 = await subscribe("a", makeSub("2"), "Desktop"),
    b = await subscribe("b", makeSub("3"), "Android");
  assert.equal(await subscribe("a", makeSub("1"), "iPhone"), a);
  await assert.rejects(subscribe("b", makeSub("1"), "Other"), /DEVICE_BOUND/);
  await query(
    "INSERT INTO accompaniments VALUES('pair','a','b','a','pending','Private objective','Private refusal')",
  );
  await query(
    "INSERT INTO email_events VALUES('request','pending','pair',$1,0)",
    [new Date(Date.now() + 10).toISOString()],
  );
  await processEvents();
  await processEvents();
  assert.equal((await query("SELECT COUNT(*) AS n FROM push_outbox"))[0].n, 1); // receiver b only, not request_sent
  await Promise.all([runPushWorker(), runPushWorker()]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sub.endpoint, makeSub("3").endpoint);
  assert(!JSON.stringify(sent).includes("Private"));
  assert(!JSON.stringify(sent).includes("private.discord"));
  await query("UPDATE accompaniments SET status='active'");
  await query(
    "INSERT INTO email_events VALUES('accept','active','pair',$1,0)",
    [new Date(Date.now() + 10).toISOString()],
  );
  await processEvents();
  await runPushWorker();
  assert.equal(sent.length, 4); // two devices a, one b
  await query("INSERT INTO email_events VALUES('vacancy','vacancy','b',$1,0)", [
    new Date(Date.now() + 10).toISOString(),
  ]);
  await query("INSERT INTO follows VALUES('a','b')");
  await processEvents();
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) AS n FROM push_outbox WHERE kind='place_available'",
      )
    )[0].n,
    0,
  );
  await query("INSERT INTO push_preferences VALUES('a',1)");
  await enqueuePush("vacancy", "a", "place_available", {
    name: "Private",
    profileId: "b",
  });
  await enqueuePush("vacancy", "a", "place_available", {
    name: "Private",
    profileId: "b",
  });
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) AS n FROM push_outbox WHERE kind='place_available'",
      )
    )[0].n,
    2,
  );
  await query("UPDATE push_preferences SET vacancies=0");
  await runPushWorker();
  assert.equal(sent.length, 4);
  await removeSubscription("b", a);
  assert.equal(
    (await query("SELECT id FROM push_subscriptions WHERE id=$1", [a])).length,
    1,
  );
  // Expired endpoint cleanup, including pending notifications.
  await query(
    "INSERT INTO verifications VALUES('a','v1','approved','Private feedback')",
  );
  await query(
    "INSERT INTO email_events VALUES('review:a:v1','approved','a',$1,0)",
    [new Date(Date.now() + 10).toISOString()],
  );
  await processEvents();
  webpush.sendNotification = async () => {
    throw Object.assign(new Error("Expired"), { statusCode: 410 });
  };
  await runPushWorker();
  assert.equal(
    (await query("SELECT * FROM push_subscriptions WHERE user_id='a'")).length,
    0,
  );
  assert.equal(
    (await query("SELECT * FROM push_outbox WHERE user_id='a'")).length,
    0,
  );

  // Each remaining lifecycle event uses the shared recipient logic.
  webpush.sendNotification = async (sub, payload) => {
    sent.push({ sub, data: JSON.parse(String(payload)) });
    return { statusCode: 201, body: "", headers: {} };
  };
  await subscribe("a", makeSub("new"), "New phone");
  for (const kind of ["declined", "cancelled", "completed"]) {
    await query("UPDATE accompaniments SET status=$1", [kind]);
    await query(`INSERT INTO email_events VALUES($1,$2,'pair',$3,0)`, [
      "event-" + kind,
      kind,
      new Date(Date.now() + 10).toISOString(),
    ]);
    await processEvents();
    await runPushWorker();
  }
  await query("UPDATE verifications SET revision='v2',status='changes'");
  await query(
    "INSERT INTO email_events VALUES('review:a:v2','changes','a',$1,0)",
    [new Date(Date.now() + 10).toISOString()],
  );
  await processEvents();
  await runPushWorker();
  for (const title of [
    "Demande refusée",
    "Demande annulée",
    "Accompagnement terminé",
    "Dossier à compléter",
  ])
    assert(sent.some((s) => s.data.title === title));
  await removeSubscription("a");
  assert.equal(Object.keys(pushMessages).length, 10);
  await removeSubscription("b");
  assert.equal((await query("SELECT * FROM push_subscriptions")).length, 0);
  console.log(
    "Push tests passed: shared event pipeline, multiple devices, dedupe/concurrent claims, owner isolation, opt-in vacancy preferences, generic payloads, expired endpoints, deletion. No external messages sent.",
  );
} finally {
  webpush.sendNotification = original;
  const db = database();
  if ("close" in db) db.close();
  process.chdir(cwd);
  rmSync(temp, { recursive: true, force: true });
}
