import { query, inTransaction, database } from "../db";
import { Pool } from "pg";
import { z } from "zod";
import { payoutRate } from "./catalog";
let queue: Promise<unknown> = Promise.resolve();
export function moneyTransaction<T>(
  work: (q: typeof query) => Promise<T>,
): Promise<T> {
  if (database() instanceof Pool) return inTransaction(work);
  const result = queue.then(() => inTransaction(work));
  queue = result.catch(() => {});
  return result;
}
export async function migrateMonetization() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS money_accounts(owner_id TEXT PRIMARY KEY,customer_id TEXT UNIQUE,subscription_id TEXT,plan TEXT NOT NULL DEFAULT 'free',status TEXT NOT NULL DEFAULT 'free',cancel_at_end INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS money_services(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_bookings(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,service_id TEXT NOT NULL,snapshot TEXT NOT NULL,credits INTEGER NOT NULL,payout_cents INTEGER NOT NULL,status TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,notes TEXT NOT NULL,slot TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ledger(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_orders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,offer TEXT NOT NULL,session_id TEXT UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_payments(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,payment_intent TEXT UNIQUE,amount INTEGER NOT NULL,credits INTEGER NOT NULL,refund_amount INTEGER NOT NULL DEFAULT 0,reversed_credits INTEGER NOT NULL DEFAULT 0,invoice_url TEXT,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_events(id TEXT PRIMARY KEY,created_at TEXT NOT NULL)`,
  ])
    await query(sql);
}
export async function lock(q: typeof query, owner: string) {
  await q(
    "INSERT INTO money_accounts(owner_id) VALUES($1) ON CONFLICT(owner_id) DO NOTHING",
    [owner],
  );
  return (
    await q(
      `SELECT * FROM money_accounts WHERE owner_id=$1 ${database() instanceof Pool ? "FOR UPDATE" : ""}`,
      [owner],
    )
  )[0];
}
export async function balance(q: typeof query, owner: string) {
  return Number(
    (
      await q(
        "SELECT COALESCE(SUM(delta),0) AS balance FROM money_ledger WHERE owner_id=$1",
        [owner],
      )
    )[0].balance,
  );
}
export async function entry(
  q: typeof query,
  owner: string,
  delta: number,
  kind: string,
  reference: string,
) {
  return (
    (
      await q(
        "INSERT INTO money_ledger(id,owner_id,delta,kind,reference,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(reference) DO NOTHING RETURNING id",
        [
          crypto.randomUUID(),
          owner,
          delta,
          kind,
          reference,
          new Date().toISOString(),
        ],
      )
    ).length > 0
  );
}
export const serviceSchema = z.object({
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(20).max(5000),
  category: z.string().trim().min(2).max(80),
  duration: z.number().int().min(0).max(10080),
  calls: z.number().int().min(0).max(50),
  followup: z.string().trim().max(2000),
  availability: z.string().trim().min(3).max(2000),
  credits: z.number().int().min(1).max(1000),
  capacity: z.number().int().min(1).max(100),
  published: z.boolean(),
});
export async function saveService(owner: string, raw: unknown, id?: string) {
  const data = serviceSchema.parse(raw);
  if (id) {
    const rows = await query(
      "UPDATE money_services SET data=$1 WHERE id=$2 AND owner_id=$3 AND archived=0 RETURNING id",
      [JSON.stringify(data), id, owner],
    );
    if (!rows.length) throw Error("Prestation introuvable");
    return id;
  }
  id = crypto.randomUUID();
  await query(
    "INSERT INTO money_services(id,owner_id,data,created_at) VALUES($1,$2,$3,$4)",
    [id, owner, JSON.stringify(data), new Date().toISOString()],
  );
  return id;
}
export async function book(
  owner: string,
  serviceId: string,
  key: string,
  notes: string,
  slot: string,
) {
  return moneyTransaction(async (q) => {
    await lock(q, owner);
    const previous = (
      await q("SELECT * FROM money_bookings WHERE request_key=$1", [
        `${owner}:${key}`,
      ])
    )[0];
    if (previous) return previous.id;
    const s = (
      await q(
        "SELECT * FROM money_services WHERE id=$1 AND owner_id=$2 AND archived=0",
        [serviceId, owner],
      )
    )[0];
    if (!s) throw Error("Prestation introuvable");
    const d = serviceSchema.parse(JSON.parse(String(s.data)));
    if (!d.published) throw Error("Prestation indisponible");
    const active = Number(
      (
        await q(
          "SELECT COUNT(*) AS n FROM money_bookings WHERE service_id=$1 AND status IN ('reserved','accepted')",
          [serviceId],
        )
      )[0].n,
    );
    if (active >= d.capacity) throw Error("Plus de disponibilité");
    if ((await balance(q, owner)) < d.credits)
      throw Error("Crédits insuffisants");
    const id = crypto.randomUUID();
    await q(
      "INSERT INTO money_bookings(id,owner_id,service_id,snapshot,credits,payout_cents,status,request_key,notes,slot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        owner,
        serviceId,
        JSON.stringify(d),
        d.credits,
        d.credits * payoutRate(),
        "reserved",
        `${owner}:${key}`,
        notes,
        slot,
        new Date().toISOString(),
      ],
    );
    await entry(q, owner, -d.credits, "Réservation", `booking:${id}`);
    return id;
  });
}
export async function bookingAction(owner: string, id: string, action: string) {
  return moneyTransaction(async (q) => {
    await lock(q, owner);
    const b = (
      await q("SELECT * FROM money_bookings WHERE id=$1 AND owner_id=$2", [
        id,
        owner,
      ])
    )[0];
    if (!b) throw Error("Réservation introuvable");
    if (action === "accept" && b.status === "reserved")
      await q("UPDATE money_bookings SET status='accepted' WHERE id=$1", [id]);
    else if (action === "complete" && b.status === "accepted")
      await q("UPDATE money_bookings SET status='completed' WHERE id=$1", [id]);
    else if (
      ["cancel", "decline"].includes(action) &&
      ["reserved", "accepted"].includes(String(b.status))
    ) {
      await q("UPDATE money_bookings SET status=$1 WHERE id=$2", [
        action === "cancel" ? "cancelled" : "declined",
        id,
      ]);
      await entry(q, owner, Number(b.credits), "Restitution", `restore:${id}`);
    } else if (action === "refund" && b.status === "completed") {
      await q("UPDATE money_bookings SET status='refunded' WHERE id=$1", [id]);
      await entry(
        q,
        owner,
        Number(b.credits),
        "Restitution après prestation",
        `restore:${id}`,
      );
    } else throw Error("Transition impossible ou déjà effectuée");
  });
}
