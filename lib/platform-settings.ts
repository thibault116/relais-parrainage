import { discordInviteUrl } from "./discord-invite";
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
export async function replaceRetiredDiscordInvite() {
  const [row] = await query("SELECT data,revision FROM platform_settings WHERE id='main'");
  if (!row) return;
  const data = JSON.parse(String(row.data));
  if (data.discordUrl !== "https://discord.gg/SRVs9Y5ze") return;
  await query("UPDATE platform_settings SET data=$1,revision=$2,updated_at=$3 WHERE id='main' AND revision=$4", [JSON.stringify({...data,discordUrl:discordInviteUrl}),crypto.randomUUID(),new Date().toISOString(),String(row.revision)]);
}
export async function readPlatformSettings() {
  await replaceRetiredDiscordInvite();
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
