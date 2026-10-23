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
