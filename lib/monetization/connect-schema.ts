import { query } from "../db";

export async function migrateConnect() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS money_bank_details(owner_id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_bank_requests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),bank_snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','canceled')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_bank_workflow(request_id TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN ('pending','processing','paid','refused','canceled')),mode TEXT NOT NULL DEFAULT 'test' CHECK(mode IN ('test','live')),revision INTEGER NOT NULL DEFAULT 0,reference TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)`,
    `INSERT INTO money_bank_workflow(request_id,state,mode,revision,updated_at) SELECT id,status,'test',0,updated_at FROM money_bank_requests WHERE 1=1 ON CONFLICT(request_id) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS money_bank_audit(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,owner_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,from_state TEXT NOT NULL,to_state TEXT NOT NULL,revision INTEGER NOT NULL,reference TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '',request_key TEXT UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS money_bank_audit_request ON money_bank_audit(request_id,created_at)`,
    `CREATE INDEX IF NOT EXISTS money_bank_audit_owner ON money_bank_audit(owner_id,created_at)`,
    `CREATE TABLE IF NOT EXISTS money_connect_accounts(owner_id TEXT PRIMARY KEY,account_id TEXT UNIQUE,country TEXT NOT NULL,creation_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_withdrawals(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,account_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),transfer_id TEXT UNIQUE,payout_id TEXT UNIQUE,payout_attempt INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_allocations(booking_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,withdrawal_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0))`,
    `CREATE TABLE IF NOT EXISTS money_connect_retries(request_key TEXT PRIMARY KEY,withdrawal_id TEXT NOT NULL,owner_id TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_connect_attempts(withdrawal_id TEXT NOT NULL,attempt INTEGER NOT NULL,started_at TEXT NOT NULL,PRIMARY KEY(withdrawal_id,attempt))`,
    `CREATE INDEX IF NOT EXISTS money_connect_owner ON money_connect_withdrawals(owner_id,created_at)`,
  ]) await query(sql);
}
