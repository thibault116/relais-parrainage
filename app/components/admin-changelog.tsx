"use client";

import { useCallback, useEffect, useState } from "react";
import type { Draft, Settings } from "@/lib/changelog/store";
import { announcementSchema, applicationUrl, description, type Sections } from "@/lib/changelog/shared";

type Dashboard = {
  settings: Settings | null;
  drafts: Draft[];
  webhookConfigured: boolean;
  production: boolean;
  currentSha: string | null;
};
const statusLabels: Record<Draft["status"], string> = {
  draft: "Brouillon",
  sending: "Envoi en cours",
  published: "Publié",
  failed: "Envoi refusé",
  uncertain: "À vérifier dans Discord",
};
const groups = [
  ["nouveautés", "Nouveautés"],
  ["améliorations", "Améliorations"],
  ["corrections", "Corrections"],
] as const;

async function api(body?: Record<string, unknown>) {
  const response = await fetch("/api/admin/changelog", {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Action indisponible.");
  return data;
}

export function AdminChangelog() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState<Record<keyof Sections, string>>({ nouveautés: "", améliorations: "", corrections: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [baseline, setBaseline] = useState("");
  const [reconciliationId, setReconciliationId] = useState("");
  const [confirm, setConfirm] = useState(false);

  function select(draft: Draft | null) {
    setSelected(draft);
    setConfirm(false);
    setReconciliationId("");
    setTitle(draft?.title || "");
    setText({
      nouveautés: draft?.sections.nouveautés.join("\n") || "",
      améliorations: draft?.sections.améliorations.join("\n") || "",
      corrections: draft?.sections.corrections.join("\n") || "",
    });
  }
  const load = useCallback(async () => {
    const next: Dashboard = await api();
    setData(next);
    return next;
  }, []);
  useEffect(() => { void load().catch((failure) => setError(failure.message)); }, [load]);

  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(body);
      const next = await load();
      if (result.draft) select(result.draft);
      else if (selected) select(next.drafts.find((draft) => draft.id === selected.id) || null);
      setMessage(result.analysis || (body.action === "preview"
        ? "Simulation validée. Aucun message n’a été envoyé sur Discord."
        : body.action === "publish" ? "Annonce publiée sur Discord."
          : "Enregistré."));
    } catch (failure) {
      setError((failure as Error).message);
      const next = await load().catch(() => null);
      if (next && selected) select(next.drafts.find((draft) => draft.id === selected.id) || null);
    } finally {
      setBusy(false);
    }
  }

  const sections = Object.fromEntries(groups.map(([key]) =>
    [key, text[key].split("\n").map((note) => note.trim()).filter(Boolean)])) as Sections;
  const content = description(sections);
  const valid = announcementSchema.safeParse({ title, sections }).success;
  const editable = selected && ["draft", "failed"].includes(selected.status);
  const dirty = selected && (title !== selected.title || JSON.stringify(sections) !== JSON.stringify(selected.sections));
  const current = data?.currentSha;
  const publishable = selected && selected.target_sha === current && valid && !dirty && data?.production && data.webhookConfigured;
  const formKey = selected?.id || "none";

  return (
    <section className="changelog-admin">
      <p>Prépare les annonces membres, vérifie l’aperçu puis publie dans le salon Discord configuré.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!data ? <p>Chargement…</p> : <>
        <section className="commerce-card">
          <h2>Publication automatique</h2>
          <label className="legal-check">
            <input type="checkbox" checked={!!data.settings?.auto_enabled} disabled={busy || !data.production || !data.webhookConfigured}
              onChange={(event) => {
                const enabled = event.target.checked;
                if (!enabled || window.confirm("Autoriser l’envoi automatique des prochaines notes membres après vérification de la production active ?"))
                  void act({ action: "automatic", enabled });
              }} />
            Publier automatiquement les prochaines versions destinées aux membres
          </label>
          <p>Désactivé par défaut. L’analyse démarre après l’ouverture d’une production, avec un contrôle de secours quotidien. Les changements admin, bêta, preview et techniques sont exclus. Chaque annonce mentionne @everyone.</p>
          <p>Webhook {data.webhookConfigured ? "configuré" : "à configurer"} · {data.production ? "Production" : "Environnement de test, envoi bloqué"}</p>
          {data.settings?.last_error && <p role="alert">{data.settings.last_error}</p>}
          <p>Point de suivi <code>{(data.settings?.last_published_sha || data.settings?.baseline_sha || current || "").slice(0, 10)}</code></p>
          <div className="legal-actions">
            <button className="btn" disabled={busy || !data.production} onClick={() => void act({ action: "generate" })}>Analyser GitHub</button>
            <button className="btn secondary" disabled={busy || !data.production} onClick={() => void act({ action: "manual" })}>Créer un brouillon manuel</button>
          </div>
          {!data.settings?.last_published_sha && <details>
            <summary>Définir le point de départ de la première annonce</summary>
            <p>Au premier lancement, le suivi commence avec la production actuelle. Tu peux choisir un commit antérieur avant la première publication.</p>
            <label>SHA complet du commit
              <input value={baseline} onChange={(event) => setBaseline(event.target.value)} pattern="[a-f0-9]{40}" maxLength={40} />
            </label>
            <button className="btn secondary" disabled={busy || !/^[a-f0-9]{40}$/.test(baseline)} onClick={() => void act({ action: "baseline", sha: baseline })}>Enregistrer ce point de départ</button>
          </details>}
        </section>
        <div className="changelog-layout">
          <section>
            <h2>Brouillons et historique</h2>
            {!data.drafts.length && <p>Aucune annonce préparée pour le moment.</p>}
            {data.drafts.map((draft) => (
              <button key={draft.id} className="commerce-row" onClick={() => select(draft)}>
                <span>{draft.title}<small>{statusLabels[draft.status]} · {draft.target_sha.slice(0, 8)}</small></span>
              </button>
            ))}
          </section>
          {selected && <section key={formKey}>
            <h2>{statusLabels[selected.status]}</h2>
            {selected.error && <p role="alert">{selected.error}</p>}
            {selected.message_id && <p>Message Discord <code>{selected.message_id}</code></p>}
            {selected.published_at && <p>Publié le {new Date(selected.published_at).toLocaleString("fr-FR")}</p>}
            <label>Titre
              <input value={title} maxLength={150} disabled={!editable || busy} onChange={(event) => setTitle(event.target.value)} />
            </label>
            {groups.map(([key, label]) => <label key={key}>{label} · une ligne par point
              <textarea rows={3} value={text[key]} disabled={!editable || busy}
                onChange={(event) => setText({ ...text, [key]: event.target.value })} />
            </label>)}
            <p aria-live="polite">{content.length} / 2 000 caractères, rappel compris</p>
            <div className="legal-actions">
              <button className="btn secondary" disabled={busy || !editable || !valid} onClick={() => void act({ action: "edit", id: selected.id, revision: selected.revision, title, sections })}>Enregistrer le brouillon</button>
              <button className="btn secondary" disabled={busy || !valid || !!dirty} onClick={() => void act({ action: "preview", id: selected.id })}>Tester sans envoyer</button>
            </div>
            <p>L’annonce mentionnera <strong>@everyone</strong> dans Discord.</p>
            <article className="discord-preview" aria-label="Prévisualisation Discord">
              <img className="discord-banner" src="/changelog-banner.png" alt="Mentora · Les nouveautés de la communauté" />
              <a href={applicationUrl} target="_blank" rel="noreferrer"><strong>{title || "Les nouveautés de Mentora"}</strong></a>
              {groups.map(([key, label]) => sections[key].length > 0 && <div key={key}>
                <h3>{label}</h3>
                <ul>{sections[key].map((note, index) => <li key={index}>{note}</li>)}</ul>
              </div>)}
              <p>Pense à actualiser Mentora pour profiter de la dernière version.</p>
              <small>Mentora · {new Date(selected.created_at).toLocaleDateString("fr-FR")}</small>
            </article>
            <a href={`https://github.com/thibault116/relais-parrainage/compare/${selected.base_sha}...${selected.target_sha}`} target="_blank" rel="noreferrer">Voir les modifications GitHub examinées</a>
            {editable && <>
              <label className="legal-check">
                <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                J’ai vérifié que chaque point est visible par tous et je confirme la publication dans le salon Discord.
              </label>
              <button className="btn" disabled={busy || !publishable || !confirm} onClick={() => void act({ action: "publish", id: selected.id, revision: selected.revision, confirm: true })}>Publier sur Discord</button>
            </>}
            {selected.status === "uncertain" && <>
              <p>Pour éviter un doublon, l’envoi reste bloqué. Si le message existe dans Discord, copie son identifiant ici pour le rattacher à l’historique.</p>
              <label>Identifiant du message Discord
                <input value={reconciliationId} onChange={(event) => setReconciliationId(event.target.value)} />
              </label>
              <button className="btn secondary" disabled={busy || !/^\d+$/.test(reconciliationId)} onClick={() => void act({ action: "reconcile", id: selected.id, messageId: reconciliationId })}>Vérifier le message publié</button>
            </>}
          </section>}
        </div>
      </>}
    </section>
  );
}
