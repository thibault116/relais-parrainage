import {query} from '../db';
export async function migrateDiscordCommunity(){
 await query(`CREATE TABLE IF NOT EXISTS discord_reposts(source_id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,kind TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,message_ids TEXT NOT NULL DEFAULT '[]',state TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL)`);
 await query(`CREATE TABLE IF NOT EXISTS discord_community_panels(kind TEXT PRIMARY KEY,channel_id TEXT NOT NULL,message_id TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT 'draft',details TEXT NOT NULL DEFAULT '{}')`);
 await query(`CREATE TABLE IF NOT EXISTS discord_welcomes(event_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL DEFAULT '',state TEXT NOT NULL,created_at TEXT NOT NULL)`);
}
