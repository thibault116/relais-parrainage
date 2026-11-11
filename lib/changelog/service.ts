import { memberRelease } from "../member-release";
import { query } from "../db";
import { announcementSchema, applicationUrl, description, discordPayload, shaSchema } from "./shared";
import { analyzeChanges, verifyCommit } from "./github";
import { deliverDraft, webhookConfigured } from "./discord";
import { getDraft, initialize, listDrafts, putDraft, recoverStaleSend, settings } from "./store";

function deployment() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const id = process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_ENV !== "production" || !sha || !id)
    throw new Error("La publication exige une version Vercel de production active.");
  return { sha: shaSchema.parse(sha), id };
}

export async function validateProduction() {
  const expected = deployment();
  const response = await fetch(`${applicationUrl}/api/version`, {
    cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error",
  });
  if (!response.ok) throw new Error("La production ne répond pas correctement.");
  const current = await response.json();
  if (current.version !== expected.id || current.commit !== expected.sha || current.environment !== "production")
    throw new Error("Cette version n’est pas la production active. Recharge Mentora.");
  return expected.sha;
}

export async function dashboard() {
  await recoverStaleSend();
  const [config, drafts] = await Promise.all([settings(), listDrafts()]);
  return {
    settings: config,
    drafts,
    webhookConfigured: webhookConfigured(),
    production: process.env.VERCEL_ENV === "production",
    currentSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    release: memberRelease.id,
    applicationUrl,
  };
}

export async function generateDraft(manual = false) {
  const target = await validateProduction();
  const config = await initialize(target);
  const base = config.last_published_sha || config.baseline_sha;
  if (manual) return { draft: await putDraft(base, target), analysis: null };
  if (base === target) return { draft: null, analysis: "Le suivi commence avec cette production. Aucune nouvelle version à annoncer." };
  const analysis = await analyzeChanges(base, target);
  if (!Object.values(analysis.sections).flat().length)
    return { draft: null, analysis: `${analysis.commits} commit(s) examinés. Aucun changement membre déclaré depuis le dernier point de suivi.` };
  const draft = await putDraft(base, target, analysis.sections, analysis.evidence, true);
  return { draft, analysis: analysis.comparisonUrl };
}

export async function publish(id: string, revision: number, automatic = false) {
  const target = await validateProduction();
  const draft = await getDraft(id);
  if (!draft || draft.target_sha !== target)
    throw new Error("Le brouillon doit correspondre à la production actuellement active.");
  return deliverDraft(id, revision, automatic);
}

export async function preview(id: string) {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Brouillon introuvable.");
  announcementSchema.parse(draft);
  return {
    payload: discordPayload(draft.id, draft.title, draft.sections, draft.created_at),
    characters: description(draft.sections).length,
    sent: false,
  };
}

export async function changeBaseline(sha: string) {
  const target = await validateProduction();
  await verifyCommit(sha);
  await analyzeChanges(sha, target);
  const rows = await query(
    `UPDATE discord_changelog_settings SET baseline_sha=$1,scan_sha=NULL,scan_after='',last_error=''
     WHERE id='main' AND last_published_sha IS NULL AND sending_id IS NULL RETURNING id`, [sha],
  );
  if (!rows.length) throw new Error("Le point de départ ne peut être changé qu’avant la première publication.");
}

export async function toggleAutomatic(enabled: boolean) {
  if (enabled) {
    const sha = await validateProduction();
    if (!webhookConfigured()) throw new Error("Configure d’abord le webhook Discord.");
    await initialize(sha);
  } else {
    const config = await settings();
    if (!config) return;
  }
  await query(
    "UPDATE discord_changelog_settings SET auto_enabled=$1,scan_sha=NULL,scan_after='',last_error='' WHERE id='main'",
    [enabled ? 1 : 0],
  );
}

let localCooldown = 0;
export async function automaticProductionCheck() {
  if (process.env.VERCEL_ENV !== "production" || Date.now() < localCooldown) return;
  localCooldown = Date.now() + 60000;
  try {
    const config = await settings();
    if (!config?.auto_enabled || !webhookConfigured() || config.sending_id) return;
    const current = process.env.VERCEL_GIT_COMMIT_SHA;
    const now = new Date().toISOString();
    const claim = await query(
      `UPDATE discord_changelog_settings SET scan_after=$1 WHERE id='main' AND auto_enabled=1
       AND scan_after<$2 AND (scan_sha IS NULL OR scan_sha<>$3) RETURNING id`,
      [new Date(Date.now() + 300000).toISOString(), now, current || ""],
    );
    if (!claim.length) return;
    const result = await generateDraft();
    if (result.draft?.automatic && result.draft.status === "draft") {
      await publish(result.draft.id, result.draft.revision, true);
    }
    await query("UPDATE discord_changelog_settings SET scan_sha=$1,last_error='' WHERE id='main'", [current || null]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyse de production indisponible.";
    await query("UPDATE discord_changelog_settings SET last_error=$1 WHERE id='main'", [message.slice(0,400)]).catch(() => {});
  }
}
