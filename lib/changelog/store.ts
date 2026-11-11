import { query } from "../db";
import { moneyTransaction } from "../monetization/store";
import { emptySections, type Sections, announcementSchema } from "./shared";

export type Draft = {
  id: string;
  base_sha: string;
  target_sha: string;
  title: string;
  sections: Sections;
  evidence: unknown[];
  status: "draft" | "sending" | "published" | "failed" | "uncertain";
  automatic: number;
  revision: number;
  created_at: string;
  attempted_at: string | null;
  published_at: string | null;
  message_id: string | null;
  error: string;
};
export type Settings = {
  baseline_sha: string;
  last_published_sha: string | null;
  auto_enabled: number;
  scan_sha: string | null;
  scan_after: string;
  sending_id: string | null;
  last_error: string;
};

export async function migrateChangelog() {
  await query(`CREATE TABLE IF NOT EXISTS discord_changelog_settings (
    id TEXT PRIMARY KEY, baseline_sha TEXT NOT NULL, last_published_sha TEXT,
    auto_enabled INTEGER NOT NULL DEFAULT 0, scan_sha TEXT, scan_after TEXT NOT NULL DEFAULT '',
    sending_id TEXT, last_error TEXT NOT NULL DEFAULT ''
  )`);
  await query(`CREATE TABLE IF NOT EXISTS discord_changelog_drafts (
    id TEXT PRIMARY KEY,base_sha TEXT NOT NULL,target_sha TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,sections TEXT NOT NULL,evidence TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',automatic INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,
    attempted_at TEXT,published_at TEXT,message_id TEXT,error TEXT NOT NULL DEFAULT ''
  )`);
}

export async function settings() {
  return (await query<Settings>("SELECT * FROM discord_changelog_settings WHERE id='main'"))[0] || null;
}

export async function initialize(sha: string) {
  await query(
    "INSERT INTO discord_changelog_settings(id,baseline_sha) VALUES('main',$1) ON CONFLICT(id) DO NOTHING", [sha],
  );
  return (await settings())!;
}

function decode(row: Record<string, unknown>): Draft {
  return { ...row, sections: JSON.parse(String(row.sections)), evidence: JSON.parse(String(row.evidence)) } as Draft;
}

export async function getDraft(id: string) {
  const [row] = await query("SELECT * FROM discord_changelog_drafts WHERE id=$1", [id]);
  return row ? decode(row) : null;
}

export async function listDrafts() {
  return (await query("SELECT * FROM discord_changelog_drafts ORDER BY created_at DESC LIMIT 100")).map(decode);
}

export async function putDraft(base: string, target: string, sections: Sections = emptySections, evidence: unknown[] = [], automatic = false) {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO discord_changelog_drafts(id,base_sha,target_sha,title,sections,evidence,automatic,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(target_sha) DO UPDATE SET
       base_sha=excluded.base_sha,title=excluded.title,sections=excluded.sections,evidence=excluded.evidence,
       automatic=excluded.automatic,revision=discord_changelog_drafts.revision+1,error='',status='draft'
     WHERE discord_changelog_drafts.base_sha<>excluded.base_sha AND discord_changelog_drafts.status IN ('draft','failed')`,
    [id, base, target, "Les nouveautés de Mentora", JSON.stringify(sections), JSON.stringify(evidence),
      automatic ? 1 : 0, new Date().toISOString()],
  );
  const [row] = await query("SELECT * FROM discord_changelog_drafts WHERE target_sha=$1", [target]);
  return decode(row);
}

export async function editDraft(id: string, revision: number, raw: unknown) {
  const data = announcementSchema.parse(raw);
  const rows = await query(
    `UPDATE discord_changelog_drafts SET title=$1,sections=$2,automatic=0,revision=revision+1,error='',status='draft'
     WHERE id=$3 AND revision=$4 AND status IN ('draft','failed') RETURNING id`,
    [data.title, JSON.stringify(data.sections), id, revision],
  );
  if (!rows.length) throw new Error("Le brouillon a changé ou son envoi est déjà engagé. Actualise.");
}

export async function recoverStaleSend() {
  return moneyTransaction(async (q) => {
    const cutoff = new Date(Date.now() - 300000).toISOString();
    await q(
      `UPDATE discord_changelog_drafts SET status='uncertain',error='Envoi interrompu. Vérifie le salon avant toute autre action.'
       WHERE status='sending' AND attempted_at<$1`, [cutoff],
    );
  });
}
