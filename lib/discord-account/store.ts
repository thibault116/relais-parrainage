import { query } from "../db";
export async function migrateDiscordAccounts() {
  await query(
    `CREATE TABLE IF NOT EXISTS primary_administrators(id TEXT PRIMARY KEY CHECK(id='main'),user_id TEXT NOT NULL UNIQUE)`,
  );
  // Bind to an existing authenticated account ID, never a nickname or an email literal.
  const configured = process.env.MENTORA_PRIMARY_ADMIN_USER_ID;
  const owners = configured
    ? await query(
        'SELECT u.id FROM "user" u JOIN moderators m ON m.user_id=u.id WHERE u.id=$1',
        [configured],
      )
    : await query(
        'SELECT DISTINCT u.id FROM crm_connections c JOIN "user" u ON u.id=c.owner_id JOIN moderators m ON m.user_id=u.id',
      );
  if (owners.length === 1)
    await query(
      "INSERT INTO primary_administrators(id,user_id) VALUES('main',$1) ON CONFLICT(id) DO NOTHING",
      [String(owners[0].id)],
    );
  await query(
    `CREATE TABLE IF NOT EXISTS discord_account_links(user_id TEXT PRIMARY KEY,discord_id TEXT NOT NULL UNIQUE,username TEXT NOT NULL,avatar TEXT,token_cipher TEXT NOT NULL,generation TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'linked',snapshot TEXT NOT NULL DEFAULT '{}',synced_at TEXT,error_code TEXT NOT NULL DEFAULT '',lease_id TEXT NOT NULL DEFAULT '',lease_until TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS discord_account_flows(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_hash TEXT NOT NULL,cookie_hash TEXT NOT NULL,verifier_cipher TEXT NOT NULL,expires_at TEXT NOT NULL,consumed INTEGER NOT NULL DEFAULT 0)`,
  );
}
