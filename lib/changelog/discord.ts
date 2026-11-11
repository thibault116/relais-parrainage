import { z } from "zod";
import { discordPayload, announcementSchema } from "./shared";
import { getDraft, settings, type Draft } from "./store";
import { query } from "../db";
import { moneyTransaction } from "../monetization/store";

export type Fetcher = typeof fetch;
export function webhookUrl() {
  const input = process.env.DISCORD_CHANGELOG_WEBHOOK_URL || "";
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Le webhook Discord n’est pas configuré."); }
  if (url.protocol !== "https:" || url.hostname !== "discord.com" || url.port ||
    url.username || url.password || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname))
    throw new Error("Le webhook Discord configuré est invalide.");
  url.search = "";
  url.hash = "";
  return url;
}
export function webhookConfigured() {
  try { webhookUrl(); return true; } catch { return false; }
}

export async function claimSend(id: string, revision: number, automatic: boolean) {
  return moneyTransaction(async (q) => {
    const [locked] = await q(
      "UPDATE discord_changelog_settings SET sending_id=$1 WHERE id='main' AND sending_id IS NULL RETURNING *", [id],
    );
    if (!locked) throw new Error("Une publication est déjà en cours ou doit être vérifiée.");
    const draft = await getDraft(id);
    if (!draft || draft.revision !== revision || !["draft", "failed"].includes(draft.status) ||
      draft.base_sha !== (locked.last_published_sha || locked.baseline_sha) ||
      (automatic && (!draft.automatic || !locked.auto_enabled)))
      throw new Error("Brouillon périmé ou non publiable. Actualise l’analyse.");
    announcementSchema.parse(draft);
    const claimed = await q(
      "UPDATE discord_changelog_drafts SET status='sending',attempted_at=$1,error='' WHERE id=$2 AND revision=$3 AND status IN ('draft','failed') RETURNING id",
      [new Date().toISOString(), id, revision],
    );
    if (!claimed.length) throw new Error("Le brouillon a changé. Actualise avant de publier.");
    return draft;
  });
}

export async function markPublished(draft: Draft, messageId: string) {
  await moneyTransaction(async (q) => {
    const rows = await q(
      `UPDATE discord_changelog_drafts SET status='published',message_id=$1,published_at=$2,error=''
       WHERE id=$3 AND status IN ('sending','uncertain') RETURNING id`,
      [messageId, new Date().toISOString(), draft.id],
    );
    if (!rows.length) throw new Error("Publication à vérifier.");
    const updated = await q(
      `UPDATE discord_changelog_settings SET last_published_sha=$1,sending_id=NULL,last_error=''
       WHERE id='main' AND sending_id=$2 RETURNING id`, [draft.target_sha, draft.id],
    );
    if (!updated.length) throw new Error("Publication à vérifier.");
  });
}

export async function deliverDraft(id: string, revision: number, automatic = false, transport: Fetcher = fetch) {
  const url = webhookUrl();
  url.searchParams.set("wait", "true");
  const draft = await claimSend(id, revision, automatic);
  try {
    const response = await transport(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload(draft.id, draft.title, draft.sections, draft.created_at)),
      signal: AbortSignal.timeout(12000), redirect: "error",
    });
    if (!response.ok) {
      const safeFailure = response.status >= 400 && response.status < 500;
      const state = safeFailure ? "failed" : "uncertain";
      await query("UPDATE discord_changelog_drafts SET status=$1,error=$2 WHERE id=$3 AND status='sending'",
        [state, response.status === 429 ? "Discord limite les envois. Patiente avant de réessayer." :
          safeFailure ? "Discord a refusé le message. Vérifie le webhook et le brouillon." :
            "Réponse Discord ambiguë. Vérifie le salon.", id]);
      if (safeFailure) await query("UPDATE discord_changelog_settings SET sending_id=NULL WHERE id='main' AND sending_id=$1", [id]);
      throw new Error("Publication Discord non confirmée. Consulte l’historique.");
    }
    const result = z.object({ id: z.string().regex(/^\d+$/) }).parse(await response.json());
    await markPublished(draft, result.id);
    return result.id;
  } catch {
    await query(
      `UPDATE discord_changelog_drafts SET status='uncertain',error='Résultat incertain. Vérifie le salon et rattache le message déjà publié.'
       WHERE id=$1 AND status='sending'`, [id],
    );
    throw new Error("Publication Discord non confirmée. Consulte l’historique.");
  }
}

export async function reconcileMessage(id: string, messageId: string, transport: Fetcher = fetch) {
  const draft = await getDraft(id);
  if (!draft || draft.status !== "uncertain" || (await settings())?.sending_id !== id)
    throw new Error("Aucun envoi incertain à rapprocher.");
  const url = webhookUrl();
  url.pathname += `/messages/${z.string().regex(/^\d+$/).parse(messageId)}`;
  const response = await transport(url, { signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error("Message Discord introuvable sur ce webhook.");
  const message = await response.json();
  if (message.embeds?.[0]?.footer?.text !== `Mentora · Annonce ${draft.id}`)
    throw new Error("Ce message ne correspond pas au brouillon.");
  await markPublished(draft, messageId);
}
