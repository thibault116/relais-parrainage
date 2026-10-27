import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
let sqlite: DatabaseSync | undefined;
let pool: Pool | undefined;
export function database() {
  if (process.env.DATABASE_URL)
    return (pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    }));
  if (process.env.VERCEL)
    throw new Error("DATABASE_URL est nécessaire sur Vercel.");
  if (!sqlite) {
    mkdirSync(".data", { recursive: true });
    sqlite = new DatabaseSync(".data/relais.sqlite");
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  }
  return sqlite;
}
export async function query<
  T extends Record<string, unknown> = Record<string, unknown>,
>(text: string, params: (string | number | null)[] = []): Promise<T[]> {
  const db = database();
  if (db instanceof Pool) return (await db.query(text, params)).rows as T[];
  const args: (string | number | null)[] = [];
  const prepared = text.replace(/\$(\d+)/g, (_, n) => {
    args.push(params[Number(n) - 1]);
    return "?";
  });
  return db.prepare(prepared).all(...args) as T[];
}
export async function migrateProfiles() {
  await query(
    `CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, discord TEXT NOT NULL UNIQUE, role TEXT NOT NULL, name TEXT NOT NULL, details TEXT NOT NULL, visible INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  );
  await query(
    "CREATE INDEX IF NOT EXISTS profiles_visibility ON profiles (visible, role)",
  );
}

export async function migrateAccompaniments() {
  await query(
    `CREATE TABLE IF NOT EXISTS accompaniments (id TEXT PRIMARY KEY, beginner_id TEXT NOT NULL, mentor_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','active','completed','declined','cancelled')), created_at TEXT NOT NULL, completed_at TEXT, rating INTEGER CHECK(rating BETWEEN 1 AND 5), rated_at TEXT, UNIQUE(beginner_id,mentor_id), CHECK(beginner_id <> mentor_id), CHECK(rating IS NULL OR status='completed'))`,
  );
  if (database() instanceof Pool) {
    await query(
      "ALTER TABLE accompaniments ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT ''",
    );
  } else if (
    !(await query("PRAGMA table_info(accompaniments)")).some(
      (c) => c.name === "objective",
    )
  ) {
    await query(
      "ALTER TABLE accompaniments ADD COLUMN objective TEXT NOT NULL DEFAULT ''",
    );
  }
  for (const [name, definition] of [
    ["initiator_id", "TEXT"],
    ["decline_reason", "TEXT NOT NULL DEFAULT ''"],
  ]) {
    if (database() instanceof Pool)
      await query(
        `ALTER TABLE accompaniments ADD COLUMN IF NOT EXISTS ${name} ${definition}`,
      );
    else if (
      !(await query("PRAGMA table_info(accompaniments)")).some(
        (c) => c.name === name,
      )
    )
      await query(
        `ALTER TABLE accompaniments ADD COLUMN ${name} ${definition}`,
      );
  }
  await query(
    "CREATE INDEX IF NOT EXISTS accompaniments_mentor ON accompaniments (mentor_id,status)",
  );
}

export async function migrateVerifications() {
  await query(
    `CREATE TABLE IF NOT EXISTS verifications (user_id TEXT PRIMARY KEY, revision TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','changes')), dossier TEXT NOT NULL, feedback TEXT NOT NULL DEFAULT '', verified_sales INTEGER, verified_specialties TEXT, submitted_at TEXT NOT NULL, reviewed_at TEXT, reviewer_id TEXT)`,
  );
  await query(
    "CREATE TABLE IF NOT EXISTS moderators (user_id TEXT PRIMARY KEY, email TEXT UNIQUE)",
  );
  // Bind access to existing account IDs, never to an unverified email at login.
  const emails = (process.env.MENTORA_MODERATOR_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    if (
      (await query("SELECT user_id FROM moderators WHERE email=$1", [email]))
        .length
    )
      continue;
    const users = await query('SELECT id FROM "user" WHERE LOWER(email)=$1', [
      email,
    ]);
    if (!users.length)
      throw new Error("Le compte de modération configuré doit déjà exister.");
    await query(
      "INSERT INTO moderators (user_id,email) VALUES ($1,$2) ON CONFLICT(user_id) DO NOTHING",
      [String(users[0].id), email],
    );
  }
}

export async function migrateAdministration() {
  await query(
    `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY,reporter_id TEXT NOT NULL,target_id TEXT NOT NULL,reason TEXT NOT NULL,details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),created_at TEXT NOT NULL,reviewed_at TEXT,reviewer_id TEXT,review_note TEXT NOT NULL DEFAULT '')`,
  );
  await query(
    "CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open ON reports (reporter_id,target_id) WHERE status='open'",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS profile_blocks (user_id TEXT PRIMARY KEY,reason TEXT NOT NULL,moderator_id TEXT NOT NULL,created_at TEXT NOT NULL)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS hidden_ratings (accompaniment_id TEXT PRIMARY KEY,reason TEXT NOT NULL,moderator_id TEXT NOT NULL,created_at TEXT NOT NULL)",
  );
  // Remove the retired field and convert legacy single-choice profiles once.
  const rows = await query("SELECT id,details FROM profiles");
  const allowed = [
    "Vintage",
    "Luxe",
    "Sneakers",
    "Généraliste",
    "Expert en photo",
    "Bot",
    "Brocante",
    "Fournisseur",
    "Délégation",
  ];
  for (const row of rows) {
    const d = JSON.parse(String(row.details));
    const before = JSON.stringify(d);
    delete d.joined;
    d.specialty = (
      Array.isArray(d.specialty) ? d.specialty : [d.specialty]
    ).filter((s: string) => allowed.includes(s));
    if (d.revenue === "5 000 € et plus")
      d.revenue = "Je préfère ne pas préciser";
    if (JSON.stringify(d) !== before)
      await query("UPDATE profiles SET details=$1 WHERE id=$2", [
        JSON.stringify(d),
        String(row.id),
      ]);
  }
}

export async function migrateVerificationFiles() {
  await query(
    `CREATE TABLE IF NOT EXISTS verification_files (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,stored_path TEXT NOT NULL,created_at TEXT NOT NULL)`,
  );
  await query(
    "CREATE INDEX IF NOT EXISTS verification_files_owner ON verification_files (user_id)",
  );
}

export async function migrateFollows() {
  await query(
    "CREATE TABLE IF NOT EXISTS follows (follower_id TEXT NOT NULL,followed_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(follower_id,followed_id),CHECK(follower_id<>followed_id))",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS follows_target ON follows(followed_id)",
  );
}

export async function migrateSuggestions() {
  await query(
    "CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,message TEXT NOT NULL,page TEXT NOT NULL,attachment TEXT,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed')),created_at TEXT NOT NULL)",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS suggestions_owner ON suggestions(user_id,created_at)",
  );
}

// Lock both participants in a stable order: mentor capacity and one active mentor per beginner.
export async function acceptAccompaniment(id: string, recipientId: string) {
  const db = database();
  const execute = async (q: typeof query) => {
    const pair = (await q("SELECT * FROM accompaniments WHERE id=$1", [id]))[0];
    if (!pair || pair.status !== "pending") return false;
    const initiator = String(pair.initiator_id || pair.beginner_id);
    const recipient =
      initiator === pair.beginner_id
        ? String(pair.mentor_id)
        : String(pair.beginner_id);
    if (recipient !== recipientId) return false;
    const profiles = await q(
      `SELECT user_id,role,details FROM profiles WHERE user_id IN ($1,$2) ORDER BY user_id ${db instanceof Pool ? "FOR UPDATE" : ""}`,
      [String(pair.mentor_id), String(pair.beginner_id)],
    );
    const mentor = profiles.find(
      (p) => p.user_id === pair.mentor_id && p.role === "mentor",
    );
    if (
      !mentor ||
      !profiles.some(
        (p) => p.user_id === pair.beginner_id && p.role === "beginner",
      )
    )
      return false;
    const capacity = Number(JSON.parse(String(mentor.details)).capacity) || 0;
    const rows = await q(
      `UPDATE accompaniments SET status='active' WHERE id=$1 AND status='pending'
      AND (SELECT COUNT(*) FROM accompaniments WHERE mentor_id=$2 AND status='active')<$3
      AND NOT EXISTS(SELECT 1 FROM accompaniments WHERE beginner_id=$4 AND status='active')
      AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id IN ($2,$4)) RETURNING id`,
      [id, String(pair.mentor_id), capacity, String(pair.beginner_id)],
    );
    return rows.length > 0;
  };
  if (db instanceof Pool) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await execute(
        async (sql, params) => (await client.query(sql, params)).rows,
      );
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await execute(query);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
