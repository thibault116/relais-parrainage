import { Pool } from "pg";
import { database, query } from "./db";
import { featureAvailable } from "./feature-release";
export async function migrateBeta() {
  await query(
    `CREATE TABLE IF NOT EXISTS beta_preferences (user_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),updated_at TEXT NOT NULL)`,
  );
  if (database() instanceof Pool)
    await query(
      "ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'idea'",
    );
  else if (
    !(await query("PRAGMA table_info(suggestions)")).some(
      (c) => c.name === "kind",
    )
  )
    await query(
      "ALTER TABLE suggestions ADD COLUMN kind TEXT NOT NULL DEFAULT 'idea'",
    );
}
export async function isBetaTester(userId: string) {
  const [row] = await query(
    `SELECT enabled FROM beta_preferences WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1)`,
    [userId],
  );
  return Number(row?.enabled) === 1;
}
export async function canUseFeature(userId: string, feature: string) {
  return featureAvailable(feature, await isBetaTester(userId));
}
