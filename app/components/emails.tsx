"use client";
import { useEffect, useState, useCallback } from "react";
import { mailLabels, type MailKind } from "@/lib/email-templates";
async function call(path: string, body?: unknown, method = "POST") {
  const r = await fetch(path, {
    method: body ? method : "GET",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Une erreur est survenue.");
  return d;
}
export function EmailPreferences() {
  const [prefs, setPrefs] = useState<{
    enabled: boolean;
    vacancies: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      setPrefs(await call("/api/email-preferences"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await call("/api/email-preferences", prefs, "PATCH");
      setMessage("Tes préférences sont enregistrées.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel email-panel">
      <h2>Mes notifications par e-mail</h2>
      <p>
        Les nouvelles demandes, les réponses et les fins d’accompagnement
        arrivent à l’adresse de ton compte.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button className="text-btn" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}
      {prefs ? (
        <>
          <label className="email-choice">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) =>
                setPrefs({ ...prefs, enabled: e.target.checked })
              }
            />
            Recevoir les notifications de Mentora
          </label>
          <label className="email-choice">
            <input
              type="checkbox"
              disabled={!prefs.enabled}
              checked={prefs.vacancies}
              onChange={(e) =>
                setPrefs({ ...prefs, vacancies: e.target.checked })
              }
            />
            M’avertir quand un parrain que je suis a de nouveau une place
          </label>
          <p className="small-text">
            Ces alertes concernent les parrains qui étaient complets. Une place
            reste disponible jusqu’à l’acceptation d’une demande.
          </p>
          <button className="btn" disabled={busy} onClick={() => void save()}>
            {busy ? "Enregistrement…" : "Enregistrer mes préférences"}
          </button>
        </>
      ) : (
        !error && <p>Chargement…</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
type MailRow = {
  id: string;
  kind: MailKind;
  status: string;
  test: number;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  error: string;
  name: string | null;
};
type Data = {
  configured: boolean;
  counts: { status: string; count: number }[];
  recent: MailRow[];
};
const statuses: Record<string, string> = {
  pending: "En attente",
  sending: "En cours",
  sent: "Accepté par Gmail",
  failed: "Échec",
  skipped: "Non envoyé (préférences ou changement de situation)",
};
export function AdminEmails() {
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await call("/api/admin/emails"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(action: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await call("/api/admin/emails", { action });
      setMessage(
        action === "test"
          ? "Les 10 exemples sont programmés pour thibault.cordiez@hotmail.com (un lot maximum par jour). Actualise dans un instant."
          : "Les envois en échec vont être réessayés.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel email-panel">
      <h2>Suivi des e-mails</h2>
      <p>
        Expéditeur : mentora.officiel@gmail.com. Les envois sont automatiques et
        les erreurs temporaires sont réessayées.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p>
            Configuration Gmail :{" "}
            {data.configured ? "enregistrée" : "manquante"}. « Accepté par Gmail
            » confirme l’envoi, pas l’arrivée dans la boîte principale du
            destinataire.
          </p>
          <div className="email-actions">
            <button
              className="btn secondary"
              disabled={busy || !data.configured}
              onClick={() => void action("test")}
            >
              Envoyer les 10 exemples
            </button>
            <button
              className="btn secondary"
              disabled={busy || !data.configured}
              onClick={() => void action("retry")}
            >
              Réessayer les échecs
            </button>
            <button className="text-btn" onClick={() => void load()}>
              Actualiser les envois
            </button>
          </div>
          <p>
            {data.counts
              .map((c) => `${statuses[c.status] || c.status} : ${c.count}`)
              .join(" · ") || "Aucun envoi pour le moment."}
          </p>
          <div className="email-history">
            {data.recent.map((r) => (
              <article key={r.id}>
                <strong>
                  {mailLabels[r.kind] || r.kind}
                  {Number(r.test) ? " · Test" : ""}
                </strong>
                <p>
                  {r.name || "Test administrateur"} ·{" "}
                  {statuses[r.status] || r.status}
                </p>
                <small>
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                  {r.error ? ` · ${r.error} · ${r.attempts} tentative(s)` : ""}
                </small>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
