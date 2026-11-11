import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "./db";
import { moneyTransaction } from "./monetization/store";
import { createMailTransport, emailConfigured } from "./email";
import { legalContact } from "./legal-versions";
import { legalRequestLabels, type LegalRequestKind } from "./legal-requests-shared";

export async function migrateLegal() {
  await query(`CREATE TABLE IF NOT EXISTS legal_requests (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
    reference TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL,
    decision TEXT, decided_at TEXT, reviewer_id TEXT
  )`);
  await query(`CREATE TABLE IF NOT EXISTS legal_mail (
    id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
    lease_until TEXT NOT NULL DEFAULT '', sent_at TEXT
  )`);
  await query(`CREATE TABLE IF NOT EXISTS legal_limits (
    key TEXT PRIMARY KEY, day TEXT NOT NULL, count INTEGER NOT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS legal_checkout_acceptances (
    order_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, version TEXT NOT NULL,
    offer TEXT NOT NULL, amount_cents INTEGER NOT NULL, credits INTEGER NOT NULL,
    period TEXT, accepted_at TEXT NOT NULL
  )`);
}

export const legalRequestSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["withdrawal", "cancellation", "report"]),
  name: z.string().trim().max(120),
  email: z.string().trim().max(254),
  reference: z.string().trim().min(3).max(500),
  details: z.string().trim().max(3000),
  confirmed: z.literal(true),
  requestedDate: z.iso.date().or(z.literal("")).default(""),
  anonymousProtection: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const anonymous = value.kind === "report" && value.anonymousProtection;
  if ((!anonymous && value.name.length < 2) || (value.name && value.name.length < 2))
    ctx.addIssue({ code: "custom", path: ["name"], message: "Indique ton nom complet." });
  if ((!anonymous || value.email) && !z.email().safeParse(value.email).success)
    ctx.addIssue({ code: "custom", path: ["email"], message: "Indique une adresse e-mail valide." });
  if (value.kind === "report" && value.details.length < 12)
    ctx.addIssue({ code: "custom", path: ["details"], message: "Explique précisément le signalement." });
});

type RequestData = z.infer<typeof legalRequestSchema>;
type RequestRow = {
  id: string;
  kind: LegalRequestKind;
  name: string;
  email: string;
  reference: string;
  details: string;
  created_at: string;
  decision: string | null;
  decided_at: string | null;
  receipt_sent_at?: string | null;
  decision_sent_at?: string | null;
};
const label = (kind: LegalRequestKind) => legalRequestLabels[kind];

function receipt(row: RequestRow) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "long", timeZone: "Europe/Paris",
  }).format(new Date(row.created_at));
  const declaration = row.kind === "withdrawal"
    ? "Je confirme me rétracter du contrat identifié ci-dessous."
    : row.kind === "cancellation"
      ? "Je confirme demander la résiliation du contrat identifié ci-dessous."
      : "Je signale le contenu identifié ci-dessous et confirme agir de bonne foi.";
  return [
    `Mentora — Accusé de réception : ${label(row.kind)}`,
    `Référence Mentora : ${row.id}`,
    `Date et heure de transmission : ${date}`,
    "",
    declaration,
    `Nom : ${row.name || "Non communiqué"}`,
    `Adresse de réponse : ${row.email || "Non communiquée"}`,
    `Contrat ou emplacement : ${row.reference}`,
    ...(row.details ? [`Précisions : ${row.details}`] : []),
    "",
    "Ta déclaration a été enregistrée. Cet accusé atteste de sa réception.",
    `Contact : ${legalContact}`,
  ].join("\n");
}

async function addMail(q: typeof query, id: string, to: string, subject: string, body: string) {
  await q(
    "INSERT INTO legal_mail(id,recipient,subject,body) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
    [id, to, subject, body],
  );
}

export async function registerLegalRequest(data: RequestData, network: string) {
  const now = new Date().toISOString();
  const details = data.kind === "cancellation" && data.requestedDate
    ? `Date de résiliation souhaitée : ${data.requestedDate}${data.details ? `\n${data.details}` : ""}`
    : data.details;
  return moneyTransaction(async (q) => {
    const insert = await q<RequestRow>(
      `INSERT INTO legal_requests(id,kind,name,email,reference,details,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING *`,
      [data.id, data.kind, data.name, data.email.toLowerCase(), data.reference, details, now],
    );
    const row = insert[0] ?? (await q<RequestRow>("SELECT * FROM legal_requests WHERE id=$1", [data.id]))[0];
    if (!row || row.kind !== data.kind || row.email !== data.email.toLowerCase() ||
      row.name !== data.name || row.reference !== data.reference || row.details !== details)
      throw new Error("Cette référence a déjà été utilisée. Recharge le formulaire.");
    if (insert.length) {
      const day = now.slice(0, 10);
      const limits = [[`network:${network}`, 30], ...(row.email ? [[`email:${row.email}`, 8]] : [])] as [string, number][];
      for (const [bucket, limit] of limits) {
        const key = createHash("sha256")
          .update(`${process.env.BETTER_AUTH_SECRET || "mentora-local"}:${day}:${bucket}`)
          .digest("hex");
        const [usage] = await q(
          `INSERT INTO legal_limits(key,day,count) VALUES($1,$2,1)
           ON CONFLICT(key) DO UPDATE SET count=legal_limits.count+1 RETURNING count`,
          [key, day],
        );
        if (Number(usage.count) > limit) throw new Error("LIMIT");
      }
      const subject = `Mentora — Accusé de réception (${label(row.kind)})`;
      if (row.email) await addMail(q, `receipt:${row.id}`, row.email, subject, receipt(row));
      await addMail(q, `alert:${row.id}`, legalContact, `Mentora — Nouvelle déclaration : ${label(row.kind)}`,
        `Déclaration ${row.id} à examiner dans l’espace d’administration des demandes juridiques.`);
    }
    return { id: row.id, receipt: receipt(row), emailQueued: !!row.email };
  });
}

export async function listLegalRequests() {
  return query<RequestRow>(
    `SELECT id,kind,name,email,reference,details,created_at,decision,decided_at,
      (SELECT sent_at FROM legal_mail WHERE id='receipt:' || legal_requests.id) AS receipt_sent_at,
      (SELECT sent_at FROM legal_mail WHERE id='decision:' || legal_requests.id) AS decision_sent_at
     FROM legal_requests ORDER BY CASE WHEN decided_at IS NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 100`,
  );
}

export async function resolveLegalRequest(id: string, reviewer: string, decision: string) {
  return moneyTransaction(async (q) => {
    const now = new Date().toISOString();
    const [row] = await q<RequestRow>(
      `UPDATE legal_requests SET decision=$1,decided_at=$2,reviewer_id=$3
       WHERE id=$4 AND decided_at IS NULL RETURNING *`, [decision, now, reviewer, id],
    );
    if (!row) return false;
    if (row.email) await addMail(q, `decision:${row.id}`, row.email, `Mentora — Suite à ta déclaration`,
      `Référence : ${row.id}\n\n${decision}\n\nContact et contestation : ${legalContact}`);
    return true;
  });
}

export async function runLegalMailWorker() {
  if (!emailConfigured()) return;
  const now = new Date().toISOString();
  const transport = createMailTransport();
  const startedAt = Date.now();
  const jobs = await query("SELECT id FROM legal_mail WHERE sent_at IS NULL AND lease_until<$1 ORDER BY lease_until LIMIT 8", [now]);
  for (const { id } of jobs) {
    if (Date.now() - startedAt > 20000) break;
    const lease = new Date(Date.now() + 300_000).toISOString();
    const [job] = await query(
      `UPDATE legal_mail SET lease_until=$1 WHERE id=$2 AND sent_at IS NULL AND lease_until<$3 RETURNING *`,
      [lease, String(id), now],
    );
    if (!job) continue;
    try {
      await transport.sendMail({
        from: legalContact, to: String(job.recipient), subject: String(job.subject),
        text: String(job.body), messageId: `<${createHash("sha256").update(String(id)).digest("hex")}@mentora-resell.vercel.app>`,
      });
      await query("UPDATE legal_mail SET sent_at=$1, recipient='', body='' WHERE id=$2 AND lease_until=$3",
        [new Date().toISOString(), String(id), lease]);
    } catch {
      console.error("LEGAL_MAIL_DELIVERY_FAILED");
    }
  }
  await query("DELETE FROM legal_limits WHERE day<$1", [new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)]);
}
