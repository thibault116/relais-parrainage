import { query } from "../monetization/db";
export async function migrateAmbassadors() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS money_ambassador_config(id TEXT PRIMARY KEY,discount_bps INTEGER NOT NULL DEFAULT 500,commission_bps INTEGER NOT NULL DEFAULT 500,hold_days INTEGER NOT NULL DEFAULT 30,minimum_cents INTEGER NOT NULL DEFAULT 2000,revision INTEGER NOT NULL DEFAULT 0)`,
    `INSERT INTO money_ambassador_config(id) VALUES('main') ON CONFLICT(id) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS money_ambassadors(owner_id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('active','suspended','removed')),commission_bps INTEGER,discount_bps INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,coupon_id TEXT,promotion_id TEXT UNIQUE,synced_revision INTEGER NOT NULL DEFAULT 0,sync_error TEXT NOT NULL DEFAULT '',eligibility_reviewed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ambassador_orders(order_id TEXT PRIMARY KEY,buyer_id TEXT NOT NULL,ambassador_id TEXT NOT NULL,code TEXT NOT NULL,promotion_id TEXT NOT NULL,gross_cents INTEGER NOT NULL,discount_cents INTEGER NOT NULL,paid_cents INTEGER NOT NULL,credits INTEGER NOT NULL,commission_cents INTEGER NOT NULL,hold_days INTEGER NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ambassador_commissions(payment_id TEXT PRIMARY KEY,payment_intent TEXT NOT NULL UNIQUE,owner_id TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE,gross_cents INTEGER NOT NULL,paid_cents INTEGER NOT NULL,original_cents INTEGER NOT NULL,net_cents INTEGER NOT NULL,refund_cents INTEGER NOT NULL DEFAULT 0,dispute TEXT NOT NULL DEFAULT '',fraud_hold INTEGER NOT NULL DEFAULT 0,available_at TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ambassador_withdrawals(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,account_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),status TEXT NOT NULL,transfer_id TEXT UNIQUE,payout_id TEXT UNIQUE,attempt INTEGER NOT NULL DEFAULT 1,started_at TEXT,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ambassador_allocations(withdrawal_id TEXT NOT NULL,payment_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),PRIMARY KEY(withdrawal_id,payment_id))`,
    `CREATE TABLE IF NOT EXISTS money_ambassador_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,owner_id TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS money_ambassador_commission_owner ON money_ambassador_commissions(owner_id,available_at)`,
    `CREATE INDEX IF NOT EXISTS money_ambassador_withdrawal_owner ON money_ambassador_withdrawals(owner_id,status)`,
  ]) await query(sql);
}
