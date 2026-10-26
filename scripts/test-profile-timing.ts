import assert from "node:assert/strict";
import { query, acceptAccompaniment } from "../lib/db";
import {
  migrateProfileTiming,
  recordActivity,
  profileTimingSQL,
} from "../lib/profile-timing";
import { elapsedLabel, normalizeDate } from "../lib/profile-dates";
import { decode, publicProfile } from "../lib/profile";
if (process.env.DATABASE_URL || process.env.VERCEL) throw Error("Local only");
await migrateProfileTiming();
const m = crypto.randomUUID(),
  b = crypto.randomUUID(),
  pair = crypto.randomUUID(),
  now = Date.now();
assert.equal(
  elapsedLabel(new Date(now - 3600000).toISOString(), now, "activity"),
  "il y a 1 heure",
);
assert.equal(
  elapsedLabel(new Date(now - 3 * 3600000).toISOString(), now, "activity"),
  "il y a 3 heures",
);
assert.equal(
  elapsedLabel(new Date(now - 2 * 86400000).toISOString(), now, "since"),
  "depuis 2 jours",
);
assert(
  elapsedLabel(
    new Date(now - 8 * 86400000).toISOString(),
    now,
    "activity",
  ).startsWith("le "),
);
assert.equal(normalizeDate(0), "1970-01-01T00:00:00.000Z");
const timing = async (id: string) =>
  (
    await query("SELECT available_since FROM profile_timing WHERE user_id=$1", [
      id,
    ])
  )[0]?.available_since;
try {
  for (const [id, role] of [
    [m, "mentor"],
    [b, "beginner"],
  ]) {
    await query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$1,$2,0,$3,$3)',
      [id, id + "@example.invalid", now],
    );
    await query(
      "INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES ($1,$1,$1,$2,$1,$3,1,$4)",
      [
        id,
        role,
        JSON.stringify({ capacity: 1, specialty: ["Vintage"] }),
        new Date(now).toISOString(),
      ],
    );
  }
  const start = await timing(m);
  assert(start);
  assert(await timing(b));
  await migrateProfileTiming();
  assert.equal(await timing(m), start);
  await query("UPDATE profiles SET name=$1 WHERE user_id=$2", ["Changed", m]);
  assert.equal(await timing(m), start);
  await query(
    "INSERT INTO accompaniments(id,beginner_id,mentor_id,status,created_at) VALUES ($1,$2,$3,'pending',$4)",
    [pair, b, m, new Date(now).toISOString()],
  );
  assert.equal(await timing(m), start);
  assert(await timing(b));
  await acceptAccompaniment(pair, m);
  assert.equal(await timing(m), null);
  assert.equal(await timing(b), null);
  await query("UPDATE accompaniments SET status='completed' WHERE id=$1", [
    pair,
  ]);
  assert(await timing(m));
  assert(await timing(b));
  await query("UPDATE profiles SET visible=0 WHERE user_id=$1", [m]);
  assert.equal(await timing(m), null);
  await query("UPDATE profiles SET visible=1 WHERE user_id=$1", [m]);
  assert(await timing(m));
  await recordActivity(m);
  const first = (
    await query("SELECT last_active_at FROM member_activity WHERE user_id=$1", [
      m,
    ])
  )[0].last_active_at;
  await recordActivity(m);
  assert.equal(
    (
      await query(
        "SELECT last_active_at FROM member_activity WHERE user_id=$1",
        [m],
      )
    )[0].last_active_at,
    first,
  );
  const p = publicProfile(
    decode(
      (
        await query(
          `SELECT p.*,${profileTimingSQL} FROM profiles p WHERE user_id=$1`,
          [m],
        )
      )[0],
    ),
  );
  assert.equal(p.memberSince, new Date(now).toISOString());
  assert(p.lastActiveAt);
  assert(p.availableSince);
  assert(!("discord" in p));
  console.log(
    "PASS : dates relatives, inscription, activité limitée à une écriture/minute, demande en attente, acceptation, fin, masquage, migration répétable, données publiques.",
  );
} finally {
  await query("DELETE FROM accompaniments WHERE id=$1", [pair]);
  for (const id of [m, b]) {
    await query("DELETE FROM profiles WHERE user_id=$1", [id]);
    await query("DELETE FROM member_activity WHERE user_id=$1", [id]);
    await query("DELETE FROM email_availability WHERE user_id=$1", [id]);
    await query('DELETE FROM "user" WHERE id=$1', [id]);
    await query("DELETE FROM email_events WHERE entity_id=$1", [id]);
  }
  await query("DELETE FROM email_events WHERE entity_id=$1", [pair]);
}
