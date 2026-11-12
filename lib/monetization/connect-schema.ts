import { query } from "../db";

export async function migrateConnect() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS money_connect_accounts(owner_id TEXT PRIMARY KEY,account_id TEXT UNIQUE,country TEXT NOT NULL,creation_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_withdrawals(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,account_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),transfer_id TEXT UNIQUE,payout_id TEXT UNIQUE,payout_attempt INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_allocations(booking_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,withdrawal_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0))`,
    `CREATE TABLE IF NOT EXISTS money_connect_retries(request_key TEXT PRIMARY KEY,withdrawal_id TEXT NOT NULL,owner_id TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_attempts(withdrawal_id TEXT NOT NULL,attempt INTEGER NOT NULL,started_at TEXT NOT NULL,PRIMARY KEY(withdrawal_id,attempt))`,
    `CREATE INDEX IF NOT EXISTS money_connect_owner ON money_connect_withdrawals(owner_id,created_at)`,
  ]) await query(sql);
}
