"use client";
import { t as translateUi, locale } from "@/app/components/language";
import { useEffect, useState } from "react";
type Member = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  last_active_at: string;
  email_enabled: number;
  blocked: number;
  last_reminder: string | null;
  reminder_status: string | null;
};
type Data = {
  total: number;
  unknown: number;
  accounts: Member[];
  canSend: boolean;
};
const date = (s: string) => new Date(s).toLocaleString(locale());
const statuses: Record<string, string> = {
  pending: "En attente",
  sending: "En cours",
  sent: "Envoyée",
  failed: "Échec",
  skipped: "Non envoyée",
};
export function AdminRetention() {
  const [days, setDays] = useState(30),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [target, setTarget] = useState<Member | null>(null),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`/api/admin/inactive?days=${days}&page=${page}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [days, page, revision]);
  function compose(a: Member) {
    setTarget(a);
    setError("");
    setNotice("");
    setSubject("Comment avance ton projet d’achat-revente ?");
    setMessage(
      `Bonjour ${a.name},\n\nNous n’avons pas eu de tes nouvelles sur Mentora depuis quelque temps. Comment avance ton activité d’achat-revente ?\n\n${a.role === "mentor" ? "Ton expérience peut aider des débutants : retrouve tes demandes et mets à jour tes disponibilités." : "Retrouve les parrains disponibles et échange avec la communauté pour avancer à ton rythme."}\n\nÀ bientôt,\nL’équipe Mentora`,
    );
  }
  async function send() {
    if (!target) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/inactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id, days, subject, message }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNotice(
        `Relance de ${target.name} mise en attente d’envoi. Son statut est visible ci-dessous et dans E-mails.`,
      );
      setTarget(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel retention-panel">
      <h2>{translateUi("Comptes inactifs et relances")}</h2>
      <div className="retention-filters">
        <label>
          {translateUi("Sans activit\u00E9 depuis au moins")}{" "}
          <select
            value={days}
            disabled={busy}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(0);
              setTarget(null);
            }}
          >
            {[7, 14, 30, 60, 90].map((n) => (
              <option value={n} key={n}>
                {n}
                {translateUi(" jours")}
              </option>
            ))}
          </select>
        </label>
        <button
          className="text-btn"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          {translateUi("Actualiser")}
        </button>
      </div>
      {translateUi(
        error && (
          <p role="alert" className="error">
            {translateUi(error)}
          </p>
        ),
      )}
      {translateUi(notice && <p role="status">{translateUi(notice)}</p>)}
      {!data && !error && <p>{translateUi("Chargement\u2026")}</p>}
      {data && (
        <>
          <p>
            <strong>
              {data.total}
              {translateUi(" compte")}
              {translateUi(data.total !== 1 ? "s" : "")}
              {translateUi(" inactif")}
              {translateUi(data.total !== 1 ? "s" : "")}
              {translateUi(" depuis au moins ")}
              {days}
              {translateUi(" jours.")}
            </strong>
          </p>
          <p className="small-text">
            {data.unknown}
            {translateUi(
              " compte(s) sans activit\u00E9 enregistr\u00E9e : leur dur\u00E9e d\u2019inactivit\u00E9 est inconnue et ils ne sont pas inclus. La dur\u00E9e se base sur la derni\u00E8re utilisation enregistr\u00E9e de Mentora.",
            )}
          </p>
          {!data.canSend && (
            <p>
              {translateUi(
                "Les envois d\u2019e-mails sont d\u00E9sactiv\u00E9s ou non configur\u00E9s.",
              )}
            </p>
          )}
          {data.accounts.length === 0 ? (
            <p>{translateUi("Aucun compte \u00E0 afficher pour ce filtre.")}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{translateUi("Membre")}</th>
                    <th>{translateUi("R\u00F4le")}</th>
                    <th>{translateUi("Derni\u00E8re activit\u00E9")}</th>
                    <th>{translateUi("Inactivit\u00E9")}</th>
                    <th>{translateUi("Derni\u00E8re relance")}</th>
                    <th>{translateUi("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => {
                    const recent =
                      !!a.last_reminder &&
                      (Date.now() - new Date(a.last_reminder).getTime() <
                        7 * 86400000 ||
                        ["pending", "sending"].includes(
                          a.reminder_status || "",
                        ));
                    const disabled =
                      busy ||
                      !data.canSend ||
                      !Number(a.email_enabled) ||
                      !!Number(a.blocked) ||
                      recent;
                    return (
                      <tr key={a.id}>
                        <td>
                          {a.name}
                          <br />
                          <small>{a.email}</small>
                        </td>
                        <td>
                          {translateUi(
                            a.role === "mentor"
                              ? "Parrain"
                              : a.role === "beginner"
                                ? "Débutant"
                                : "Profil à compléter",
                          )}
                        </td>
                        <td>{translateUi(date(a.last_active_at))}</td>
                        <td>
                          {Math.floor(
                            (Date.now() -
                              new Date(a.last_active_at).getTime()) /
                              86400000,
                          )}{" "}
                          {translateUi("jours")}
                        </td>
                        <td>
                          {translateUi(
                            a.last_reminder ? (
                              <>
                                {translateUi(date(a.last_reminder))}
                                <br />
                                {translateUi(
                                  statuses[a.reminder_status || ""] ||
                                    a.reminder_status,
                                )}
                              </>
                            ) : (
                              "Aucune"
                            ),
                          )}
                        </td>
                        <td>
                          <button
                            className="btn secondary small-btn"
                            disabled={disabled}
                            onClick={() => compose(a)}
                          >
                            {translateUi("Pr\u00E9parer une relance")}
                          </button>
                          {!Number(a.email_enabled) ? (
                            <small>
                              {translateUi(
                                "Notifications d\u00E9sactiv\u00E9es",
                              )}
                            </small>
                          ) : Number(a.blocked) ? (
                            <small>
                              {translateUi("Compte mod\u00E9r\u00E9")}
                            </small>
                          ) : recent ? (
                            <small>
                              {translateUi(
                                "Une relance maximum tous les 7 jours",
                              )}
                            </small>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="email-actions">
            <button
              className="btn secondary"
              disabled={page === 0 || busy}
              onClick={() => {
                setPage((p) => p - 1);
                setTarget(null);
              }}
            >
              {translateUi("Pr\u00E9c\u00E9dent")}
            </button>
            <span>
              {translateUi("Page ")}
              {page + 1} / {Math.max(1, Math.ceil(data.total / 30))}
            </span>
            <button
              className="btn secondary"
              disabled={(page + 1) * 30 >= data.total || busy}
              onClick={() => {
                setPage((p) => p + 1);
                setTarget(null);
              }}
            >
              {translateUi("Suivant")}
            </button>
          </div>
        </>
      )}
      {target && (
        <form
          className="reminder-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h3>
            {translateUi("Relance personnalis\u00E9e pour ")}
            {target.name}
          </h3>
          <p>
            {translateUi("Destinataire : ")}
            {target.email}
            <br />
            {translateUi("Exp\u00E9diteur : mentora.officiel@gmail.com")}
          </p>
          <label>
            {translateUi("Objet")}
            <input
              required
              minLength={3}
              maxLength={150}
              value={subject}
              disabled={busy}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            {translateUi("Message")}
            <textarea
              required
              minLength={10}
              maxLength={5000}
              rows={10}
              value={message}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <p className="small-text">
            {translateUi(
              "Le texte ci-dessus sera envoy\u00E9 avec le logo Mentora, un bouton \u00AB Ouvrir Mentora \u00BB et un lien pour g\u00E9rer ses notifications. Les pr\u00E9f\u00E9rences du membre sont respect\u00E9es. Aucun envoi automatique de relance.",
            )}
          </p>
          <div className="email-actions">
            <button className="btn" disabled={busy} type="submit">
              {translateUi(busy ? "Programmation…" : "Envoyer cette relance")}
            </button>
            <button
              className="btn secondary"
              disabled={busy}
              type="button"
              onClick={() => setTarget(null)}
            >
              {translateUi("Annuler")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
