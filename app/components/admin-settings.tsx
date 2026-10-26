"use client";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { type PlatformSettings } from "@/lib/platform-config";
type Data = {
  settings: PlatformSettings;
  revision: string;
  updatedAt: string | null;
};
export function AdminSettings() {
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/settings", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function change<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
  ) {
    setData((d) =>
      d ? { ...d, settings: { ...d.settings, [key]: value } } : d,
    );
    setMessage("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      setMessage("Les paramètres sont enregistrés.");
      window.dispatchEvent(new Event("mentora-settings"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const toggle = (
    key:
      | "announcementEnabled"
      | "requestsEnabled"
      | "verifiedMentorsOnly"
      | "suggestionsEnabled"
      | "emailsEnabled"
      | "vacancyEmailsEnabled",
    label: string,
    description: string,
  ) => (
    <label className="settings-toggle">
      <input
        type="checkbox"
        checked={!!data?.settings[key]}
        onChange={(e) => change(key, e.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
  return (
    <section className="verification-panel admin-settings">
      <h2>Paramètres de Mentora</h2>
      <p>
        Ces réglages s’appliquent à toute la plateforme après enregistrement.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!data ? (
        <button className="btn secondary" onClick={() => void load()}>
          Charger les paramètres
        </button>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <legend>Communauté et annonce</legend>
            <label>
              Lien du groupe Discord
              <input
                type="url"
                required
                value={data.settings.discordUrl}
                onChange={(e) => change("discordUrl", e.target.value)}
              />
            </label>
            {toggle(
              "announcementEnabled",
              "Afficher une annonce",
              "Un bandeau apparaît sur toutes les pages, sur ordinateur et téléphone.",
            )}
            <label>
              Texte de l’annonce
              <textarea
                maxLength={300}
                rows={3}
                value={data.settings.announcement}
                onChange={(e) => change("announcement", e.target.value)}
                placeholder="Une information à partager avec les membres…"
              />
            </label>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Demandes et suggestions</legend>
            {toggle(
              "requestsEnabled",
              "Autoriser les nouvelles demandes de parrainage",
              "La pause ne bloque pas les réponses aux demandes existantes ni les accompagnements en cours.",
            )}
            {toggle(
              "verifiedMentorsOnly",
              "Réserver les nouvelles demandes aux parrains vérifiés",
              "Les profils non vérifiés restent visibles. Les demandes déjà envoyées restent disponibles.",
            )}
            {toggle(
              "suggestionsEnabled",
              "Activer la boîte à suggestions",
              "Affiche l’ampoule et autorise l’envoi de nouvelles idées.",
            )}
          </fieldset>
          <fieldset disabled={busy}>
            <legend>E-mails automatiques</legend>
            {toggle(
              "emailsEnabled",
              "Activer les notifications par e-mail",
              "Les notifications traitées pendant la désactivation ne seront pas envoyées. Les tests administrateur restent possibles.",
            )}
            {toggle(
              "vacancyEmailsEnabled",
              "Activer les alertes de places disponibles",
              "Avertit les abonnés lorsqu’un parrain complet a de nouveau une place, selon leurs préférences.",
            )}
          </fieldset>
          <p className="small-text">
            Les identifiants Gmail et les droits administrateur restent gérés
            séparément.
          </p>
          <div className="email-actions">
            <button className="btn" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer les paramètres"}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Recharger les paramètres enregistrés
            </button>
          </div>
          {data.updatedAt && (
            <p className="small-text">
              Dernière modification :{" "}
              {new Date(data.updatedAt).toLocaleString("fr-FR")}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
