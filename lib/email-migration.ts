import { database, query } from "./db";
import { Pool } from "pg";
export async function migrateEmail() {
  await query(
    "CREATE TABLE IF NOT EXISTS email_events (id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL,processed INTEGER NOT NULL DEFAULT 0)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS email_outbox (id TEXT PRIMARY KEY,event_id TEXT NOT NULL,user_id TEXT,kind TEXT NOT NULL,payload TEXT NOT NULL,test INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,sent_at TEXT,next_attempt TEXT NOT NULL DEFAULT '',lease_until TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '')",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox(status,next_attempt)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS email_preferences (user_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1,vacancies INTEGER NOT NULL DEFAULT 1)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS email_availability (user_id TEXT PRIMARY KEY,slots INTEGER NOT NULL,revision TEXT NOT NULL)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS email_worker (id TEXT PRIMARY KEY,lease_until TEXT NOT NULL)",
  );
  await query(
    "INSERT INTO email_worker(id,lease_until) VALUES ('main','') ON CONFLICT(id) DO NOTHING",
  );
  // Establish a baseline without notifying followers about historical availability.
  const mentors = await query(
    "SELECT p.user_id,p.details,p.visible,(SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active FROM profiles p WHERE p.role='mentor'",
  );
  for (const p of mentors)
    await query(
      "INSERT INTO email_availability(user_id,slots,revision) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO NOTHING",
      [
        String(p.user_id),
        Math.max(
          0,
          Number(JSON.parse(String(p.details)).capacity) - Number(p.active),
        ),
        crypto.randomUUID(),
      ],
    );
  const pg = database() instanceof Pool;
  const definitions = [
    {
      name: "email_pair_insert",
      table: "accompaniments",
      when: "INSERT",
      condition: "",
      id: "'pair:' || NEW.id || ':pending'",
      kind: "'pending'",
      entity: "NEW.id",
    },
    {
      name: "email_pair_update",
      table: "accompaniments",
      when: "UPDATE",
      condition: "OLD.status <> NEW.status",
      id: "'pair:' || NEW.id || ':' || NEW.status",
      kind: "NEW.status",
      entity: "NEW.id",
    },
    {
      name: "email_review_update",
      table: "verifications",
      when: "UPDATE",
      condition:
        "OLD.revision <> NEW.revision AND NEW.status IN ('approved','changes')",
      id: "'review:' || NEW.user_id || ':' || NEW.revision",
      kind: "NEW.status",
      entity: "NEW.user_id",
    },
    {
      name: "email_vacancy_update",
      table: "email_availability",
      when: "UPDATE",
      condition: "OLD.slots = 0 AND NEW.slots > 0",
      id: "'vacancy:' || NEW.user_id || ':' || NEW.revision",
      kind: "'vacancy'",
      entity: "NEW.user_id",
    },
  ];
  for (const d of definitions) {
    const insert = `INSERT INTO email_events(id,kind,entity_id,created_at) VALUES (${d.id},${d.kind},${d.entity},${pg ? "CURRENT_TIMESTAMP::text" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')"}) ON CONFLICT(id) DO NOTHING;`;
    if (pg) {
      await query(
        `CREATE OR REPLACE FUNCTION ${d.name}_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${d.condition ? `IF ${d.condition} THEN` : ""} ${insert} ${d.condition ? "END IF;" : ""} RETURN NEW; END; $$`,
      );
      await query(`DROP TRIGGER IF EXISTS ${d.name} ON ${d.table}`);
      await query(
        `CREATE TRIGGER ${d.name} AFTER ${d.when} ON ${d.table} FOR EACH ROW EXECUTE FUNCTION ${d.name}_fn()`,
      );
    } else
      await query(
        `CREATE TRIGGER IF NOT EXISTS ${d.name} AFTER ${d.when} ON ${d.table} ${d.condition ? "WHEN " + d.condition : ""} BEGIN ${insert} END`,
      );
  }
  // Track places inside the same transaction as each change, including rapid accept/complete sequences.
  for (const [name, table, event, mentor] of [
    ["email_slots_pair_insert", "accompaniments", "INSERT", "NEW.mentor_id"],
    ["email_slots_pair_update", "accompaniments", "UPDATE", "NEW.mentor_id"],
    ["email_slots_pair_delete", "accompaniments", "DELETE", "OLD.mentor_id"],
    ["email_slots_profile_insert", "profiles", "INSERT", "NEW.user_id"],
    ["email_slots_profile_update", "profiles", "UPDATE", "NEW.user_id"],
  ]) {
    const capacity = pg
      ? "COALESCE((p.details::jsonb->>'capacity')::integer,0)"
      : "COALESCE(json_extract(p.details,'$.capacity'),0)";
    const revision = pg
      ? "md5(random()::text || clock_timestamp()::text)"
      : "lower(hex(randomblob(16)))";
    const slots = `${pg ? "GREATEST" : "MAX"}(0,${capacity}-(SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active'))`;
    const upsert = `INSERT INTO email_availability(user_id,slots,revision) SELECT p.user_id,${slots},${revision} FROM profiles p WHERE p.user_id=${mentor} AND p.role='mentor' ON CONFLICT(user_id) DO UPDATE SET slots=excluded.slots,revision=excluded.revision WHERE email_availability.slots<>excluded.slots;`;
    if (pg) {
      await query(
        `CREATE OR REPLACE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${upsert} RETURN ${event === "DELETE" ? "OLD" : "NEW"}; END; $$`,
      );
      await query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
      await query(
        `CREATE TRIGGER ${name} AFTER ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}_fn()`,
      );
    } else
      await query(
        `CREATE TRIGGER IF NOT EXISTS ${name} AFTER ${event} ON ${table} BEGIN ${upsert} END`,
      );
  }
}
