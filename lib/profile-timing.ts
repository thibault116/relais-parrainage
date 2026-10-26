import { Pool } from "pg";
import { database, query } from "./db";
export const profileTimingSQL = `(SELECT u."createdAt" FROM "user" u WHERE u.id=p.user_id) AS member_since, (SELECT a.last_active_at FROM member_activity a WHERE a.user_id=p.user_id) AS last_active_at, (SELECT t.available_since FROM profile_timing t WHERE t.user_id=p.user_id) AS available_since`;
export async function recordActivity(id: string) {
  const now = new Date().toISOString(),
    cutoff = new Date(Date.now() - 60000).toISOString();
  await query(
    "INSERT INTO member_activity(user_id,last_active_at) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET last_active_at=excluded.last_active_at WHERE member_activity.last_active_at<$3",
    [id, now, cutoff],
  );
}
export async function migrateProfileTiming() {
  await query(
    "CREATE TABLE IF NOT EXISTS member_activity(user_id TEXT PRIMARY KEY,last_active_at TEXT NOT NULL)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS profile_timing(user_id TEXT PRIMARY KEY,role TEXT NOT NULL,available_since TEXT)",
  );
  const pg = database() instanceof Pool;
  const now = pg
    ? "to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')"
    : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const cap = pg
    ? "COALESCE((p.details::jsonb->>'capacity')::integer,0)"
    : "COALESCE(json_extract(p.details,'$.capacity'),0)";
  const available = `p.visible=1 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id) AND ((p.role='mentor' AND ${cap}>(SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active')) OR (p.role='beginner' AND NOT EXISTS(SELECT 1 FROM accompaniments a WHERE a.beginner_id=p.user_id AND a.status='active')))`;
  const select = `SELECT p.user_id,p.role,CASE WHEN ${available} THEN ${now} ELSE NULL END FROM profiles p`;
  // Historical availability/activity was not recorded; do not invent earlier dates.
  await query(
    `INSERT INTO profile_timing(user_id,role,available_since) ${select} WHERE 1=1 ON CONFLICT(user_id) DO NOTHING`,
  );
  const definitions = [
    ["timing_profile_insert", "profiles", "INSERT", "NEW.user_id"],
    ["timing_profile_update", "profiles", "UPDATE", "NEW.user_id"],
    [
      "timing_pair_insert",
      "accompaniments",
      "INSERT",
      "NEW.mentor_id,NEW.beginner_id",
    ],
    [
      "timing_pair_update",
      "accompaniments",
      "UPDATE",
      "NEW.mentor_id,NEW.beginner_id,OLD.mentor_id,OLD.beginner_id",
    ],
    [
      "timing_pair_delete",
      "accompaniments",
      "DELETE",
      "OLD.mentor_id,OLD.beginner_id",
    ],
    ["timing_block_insert", "profile_blocks", "INSERT", "NEW.user_id"],
    ["timing_block_delete", "profile_blocks", "DELETE", "OLD.user_id"],
  ];
  for (const [name, table, event, ids] of definitions) {
    const statement = `INSERT INTO profile_timing(user_id,role,available_since) ${select} WHERE p.user_id IN (${ids}) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,available_since=CASE WHEN excluded.available_since IS NULL THEN NULL WHEN profile_timing.role=excluded.role THEN COALESCE(profile_timing.available_since,excluded.available_since) ELSE excluded.available_since END;`;
    if (pg) {
      await query(
        `CREATE OR REPLACE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${statement} RETURN ${event === "DELETE" ? "OLD" : "NEW"}; END; $$`,
      );
      await query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
      await query(
        `CREATE TRIGGER ${name} AFTER ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}_fn()`,
      );
    } else
      await query(
        `CREATE TRIGGER IF NOT EXISTS ${name} AFTER ${event} ON ${table} BEGIN ${statement} END`,
      );
  }
  const name = "timing_profile_delete",
    statement = "DELETE FROM profile_timing WHERE user_id=OLD.user_id;";
  if (pg) {
    await query(
      `CREATE OR REPLACE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${statement} RETURN OLD; END; $$`,
    );
    await query(`DROP TRIGGER IF EXISTS ${name} ON profiles`);
    await query(
      `CREATE TRIGGER ${name} AFTER DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION ${name}_fn()`,
    );
  } else
    await query(
      `CREATE TRIGGER IF NOT EXISTS ${name} AFTER DELETE ON profiles BEGIN ${statement} END`,
    );
}
