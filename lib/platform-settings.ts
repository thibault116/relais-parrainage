import { query } from "./db";
import { defaultSettings, settingsSchema } from "./platform-config";
export async function migratePlatformSettings() {
  await query(
    "CREATE TABLE IF NOT EXISTS platform_settings(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT)",
  );
  await query(
    "INSERT INTO platform_settings(id,data,revision,updated_at) VALUES ('main',$1,$2,$3) ON CONFLICT(id) DO NOTHING",
    [
      JSON.stringify(defaultSettings),
      crypto.randomUUID(),
      new Date().toISOString(),
    ],
  );
}
export async function readPlatformSettings() {
  const row = (
    await query("SELECT * FROM platform_settings WHERE id='main'")
  )[0];
  return {
    settings: row
      ? settingsSchema.parse(JSON.parse(String(row.data)))
      : defaultSettings,
    revision: String(row?.revision || ""),
    updatedAt: row?.updated_at || null,
  };
}
