import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { query, database } from "./db";
import { Pool } from "pg";
import { isModerator } from "./verification";
export const CRM_OWNER_EMAIL = "thibault.cordiez@hotmail.com";
export async function isCrmOwner(
  u: { id: string; email: string } | null | undefined,
) {
  return (
    !!u &&
    u.email.toLowerCase() === CRM_OWNER_EMAIL &&
    (await isModerator(u.id))
  );
}
export async function migrateCrm() {
  await query(
    `CREATE TABLE IF NOT EXISTS crm_connections(owner_id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,expires_at TEXT NOT NULL,account_key TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,last_sync_at TEXT,last_status TEXT NOT NULL DEFAULT 'waiting',last_message TEXT NOT NULL DEFAULT '',last_page TEXT NOT NULL DEFAULT '')`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS crm_sales(owner_id TEXT NOT NULL,account_key TEXT NOT NULL,order_id TEXT NOT NULL,title TEXT NOT NULL,photo_url TEXT NOT NULL DEFAULT '',order_url TEXT NOT NULL,amount_cents INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,sold_on TEXT,first_seen_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,account_key,order_id))`,
  );
  await query(
    "CREATE INDEX IF NOT EXISTS crm_sales_dates ON crm_sales(owner_id,sold_on)",
  );
}
export const hashToken = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export async function createCrmConnection(ownerId: string) {
  const token = randomBytes(32).toString("hex"),
    now = new Date().toISOString(),
    expires = new Date(Date.now() + 90 * 86400000).toISOString();
  await query(
    `INSERT INTO crm_connections(owner_id,token_hash,expires_at,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=excluded.created_at,last_status='waiting',last_message=''`,
    [ownerId, hashToken(token), expires, now],
  );
  return { token, expiresAt: expires };
}
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  })
  .nullable();
const vintedUrl = z
  .string()
  .url()
  .max(2000)
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      u.hostname === "www.vinted.fr" &&
      !u.username &&
      !u.password
    );
  });
const photo = z
  .string()
  .max(2000)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        (u.hostname === "vinted.net" || u.hostname.endsWith(".vinted.net")) &&
        !u.username &&
        !u.password
      );
    } catch {
      return false;
    }
  });
export const saleSchema = z
  .object({
    orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    title: z.string().trim().min(1).max(500),
    photoUrl: photo,
    orderUrl: vintedUrl,
    amountCents: z.number().int().min(0).max(100000000),
    currency: z.literal("EUR"),
    status: z.enum(["completed", "pending", "cancelled", "refunded"]),
    soldOn: date,
  })
  .strict();
export const syncSchema = z
  .object({
    accountKey: z.string().regex(/^[a-zA-Z0-9_.-]{1,150}$/),
    sales: z.array(saleSchema).max(100),
    status: z.enum([
      "syncing",
      "complete",
      "paused",
      "login_required",
      "unsupported",
      "error",
    ]),
    message: z.string().max(500),
    page: vintedUrl,
  })
  .strict();
export type CrmSale = z.infer<typeof saleSchema>;
export async function ingestCrm(
  token: string,
  input: z.infer<typeof syncSchema>,
) {
  const db = database();
  const run = async (q: typeof query) => {
    const [c] = await q(
      `SELECT c.owner_id,c.account_key FROM crm_connections c JOIN "user" u ON u.id=c.owner_id JOIN moderators m ON m.user_id=u.id WHERE c.token_hash=$1 AND c.expires_at>$2 AND LOWER(u.email)=$3 ${db instanceof Pool ? "FOR UPDATE OF c" : ""}`,
      [hashToken(token), new Date().toISOString(), CRM_OWNER_EMAIL],
    );
    if (!c) throw Error("unauthorized");
    if (c.account_key && c.account_key !== input.accountKey)
      throw Error("account_mismatch");
    const historical = await q(
      "SELECT account_key FROM crm_sales WHERE owner_id=$1 LIMIT 1",
      [String(c.owner_id)],
    );
    if (historical[0] && historical[0].account_key !== input.accountKey)
      throw Error("account_mismatch");
    const now = new Date().toISOString();
    for (const s of input.sales)
      await q(
        `INSERT INTO crm_sales(owner_id,account_key,order_id,title,photo_url,order_url,amount_cents,currency,status,sold_on,first_seen_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT(owner_id,account_key,order_id) DO UPDATE SET title=excluded.title,photo_url=CASE WHEN excluded.photo_url='' THEN crm_sales.photo_url ELSE excluded.photo_url END,order_url=excluded.order_url,amount_cents=excluded.amount_cents,status=excluded.status,sold_on=COALESCE(excluded.sold_on,crm_sales.sold_on),updated_at=excluded.updated_at`,
        [
          String(c.owner_id),
          input.accountKey,
          s.orderId,
          s.title,
          s.photoUrl,
          s.orderUrl,
          s.amountCents,
          s.currency,
          s.status,
          s.soldOn,
          now,
        ],
      );
    await q(
      `UPDATE crm_connections SET account_key=$2,last_sync_at=$3,last_status=$4,last_message=$5,last_page=$6 WHERE owner_id=$1`,
      [
        String(c.owner_id),
        input.accountKey,
        now,
        input.status,
        input.message,
        input.page,
      ],
    );
    return { received: input.sales.length };
  };
  if (db instanceof Pool) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await run(
        async (sql, args) => (await client.query(sql, args)).rows,
      );
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await run(query);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function crmPeriodBounds(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m] = today.split("-");
  return {
    today,
    month: `${y}-${m}-01`,
    quarter: `${y}-${String(Math.floor((Number(m) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`,
    year: `${y}-01-01`,
  };
}
export async function crmOverview(ownerId: string, page: number) {
  const b = crmPeriodBounds();
  const [connection, counts, sales] = await Promise.all([
    query(
      "SELECT account_key,expires_at,created_at,last_sync_at,last_status,last_message FROM crm_connections WHERE owner_id=$1",
      [ownerId],
    ),
    query(
      `SELECT COUNT(*) AS total,SUM(CASE WHEN status='completed' AND sold_on=$2 THEN amount_cents ELSE 0 END) AS day_cents,SUM(CASE WHEN status='completed' AND sold_on>=$3 AND sold_on<=$2 THEN amount_cents ELSE 0 END) AS month_cents,SUM(CASE WHEN status='completed' AND sold_on>=$4 AND sold_on<=$2 THEN amount_cents ELSE 0 END) AS quarter_cents,SUM(CASE WHEN status='completed' AND sold_on>=$5 AND sold_on<=$2 THEN amount_cents ELSE 0 END) AS year_cents,SUM(CASE WHEN sold_on IS NULL THEN 1 ELSE 0 END) AS undated,SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END) AS pending_cents,MIN(sold_on) AS oldest FROM crm_sales WHERE owner_id=$1`,
      [ownerId, b.today, b.month, b.quarter, b.year],
    ),
    query(
      "SELECT * FROM crm_sales WHERE owner_id=$1 ORDER BY COALESCE(sold_on,'') DESC,order_id DESC LIMIT 30 OFFSET $2",
      [ownerId, page * 30],
    ),
  ]);
  return {
    connection: connection[0] || null,
    stats: counts[0],
    sales,
    page,
    today: b.today,
  };
}
