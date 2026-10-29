"use client";
import { t as translateUi, locale } from "@/app/components/language";
import { AdminCrm } from "./admin-crm";
import { AdminRetention } from "./admin-retention";
import { AdminSettings } from "./admin-settings";
import { useCallback, useEffect, useState } from "react";
import { AdminEmails } from "./emails";
import { AdminSuggestions } from "./suggestions";
import { Moderation } from "./verification";
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Erreur de chargement.");
  return d;
}
type Account = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  profile_id: string | null;
  role: string | null;
  blocked: number;
};
type Report = {
  id: string;
  target_id: string;
  target_name: string;
  reporter_name: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  review_note: string;
};
type Rating = {
  id: string;
  mentor_name: string;
  beginner_name: string;
  rating: number;
  hidden: number;
  rated_at: string;
};
type Data = {
  stats: Record<string, number | null>;
  accounts: Account[];
  reports: Report[];
  ratings: Rating[];
};
const date = (v: string) => new Date(v).toLocaleDateString(locale());
export function AdminDashboard({
  tab,
  setTab,
  onPreview,
  crmOwner = false,
}: {
  tab: string;
  crmOwner?: boolean;
  setTab: (tab: string) => void;
  onPreview: (role: "mentor" | "beginner") => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0);
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await call(`/api/admin?page=${page}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(action: string, id: string) {
    const reason = window.prompt(
      "Motif de la décision (au moins 10 caractères) :",
    );
    if (reason === null) return;
    setBusy(true);
    setError("");
    try {
      await call("/api/admin", "PATCH", { action, id, reason });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const s = data?.stats;
  return (
    <section className="wrap admin-page">
      <div className="page-heading">
        <span className="eyebrow">{translateUi("ESPACE PRIV\u00C9")}</span>
        <h1>
          {translateUi("Administration")}
          <span>.</span>
        </h1>
        <p>
          {translateUi(
            "Pilote Mentora et garde une communaut\u00E9 bienveillante.",
          )}
        </p>
      </div>
      <nav
        className="admin-tabs"
        aria-label={translateUi("Rubriques administrateur")}
      >
        {[
          ["overview", "Vue d’ensemble"],
          ...(crmOwner
            ? [
                ["crm", "Mon CRM Vinted"],
                ["extension", "Extension Vinted"],
              ]
            : []),
          ["suggestions", "Suggestions"],
          ["emails", "E-mails"],
          ["settings", "Paramètres"],
          ["accounts", "Comptes"],
          ["reports", "Signalements"],
          ["ratings", "Avis"],
          ["verification", "Vérification des parrains"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {translateUi(label)}
          </button>
        ))}
      </nav>
      <button className="text-btn" onClick={() => void load()}>
        {translateUi("Actualiser les donn\u00E9es")}
      </button>
      {translateUi(
        error && (
          <p className="error" role="alert">
            {translateUi(error)}
          </p>
        ),
      )}
      {(tab === "crm" || tab === "extension") && crmOwner ? (
        <AdminCrm extension={tab === "extension"} />
      ) : tab === "settings" ? (
        <AdminSettings />
      ) : tab === "emails" ? (
        <AdminEmails />
      ) : tab === "suggestions" ? (
        <AdminSuggestions />
      ) : tab === "verification" ? (
        <Moderation />
      ) : !data || !s ? (
        <p>{translateUi("Chargement\u2026")}</p>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <section className="admin-role-preview">
                <div>
                  <h2>{translateUi("Voir Mentora comme un membre")}</h2>
                  <p>
                    {translateUi(
                      "Explore les menus parrain et d\u00E9butant sans changer ton compte administrateur.",
                    )}
                  </p>
                </div>
                <div className="role-preview-actions">
                  <button className="btn" onClick={() => onPreview("mentor")}>
                    {translateUi("Voir comme un parrain")}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => onPreview("beginner")}
                  >
                    {translateUi("Voir comme un d\u00E9butant")}
                  </button>
                </div>
              </section>
              <div className="admin-stats">
                {[
                  ["Comptes créés", s.accounts],
                  ["Comptes parrains", s.mentors],
                  ["Comptes débutants", s.beginners],
                  ["Profils à compléter", s.incomplete],
                  ["Parrains actifs", s.activeMentors],
                  ["Demandes reçues", s.requests],
                  [
                    "Taux d’acceptation",
                    s.acceptanceRate === null ? "—" : `${s.acceptanceRate} %`,
                  ],
                  ["Signalements ouverts", s.openReports],
                  ["Avis publics", s.ratings],
                  ["Binômes en cours", s.active],
                  ["Binômes terminés", s.completed],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{translateUi(label)}</span>
                    <strong>{translateUi(value)}</strong>
                  </article>
                ))}
              </div>
              <AdminRetention />
              <div className="verification-panel">
                <h2>{translateUi("Comprendre les chiffres")}</h2>
                <p>
                  {s.mentors}
                  {translateUi(" profils parrains au total \u00B7 ")}
                  {s.profiles}
                  {translateUi(" profils renseign\u00E9s.")}
                </p>
                <p>
                  {translateUi(
                    "Un parrain actif a au moins un accompagnement en cours. Le taux d\u2019acceptation correspond aux demandes accept\u00E9es (y compris les bin\u00F4mes termin\u00E9s) divis\u00E9es par les demandes accept\u00E9es ou refus\u00E9es. Sans d\u00E9cision, il reste ind\u00E9fini.",
                  )}
                </p>
                <p>
                  {s.pending}
                  {translateUi(" demandes en attente \u00B7 ")}
                  {s.accepted}
                  {translateUi(" accept\u00E9es \u00B7")} {s.declined}
                  {translateUi(" refus\u00E9es \u00B7 ")}
                  {s.cancelled}
                  {translateUi(" annul\u00E9es.")}
                </p>
                <p>
                  {s.reports}
                  {translateUi(
                    " signalements re\u00E7us au total. Note moyenne publique :",
                  )}{" "}
                  {translateUi(
                    s.average
                      ? `${Number(s.average).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5`
                      : "pas encore d’avis",
                  )}
                  .
                </p>
                <p>
                  {translateUi(
                    "Les chiffres portent sur les donn\u00E9es actuellement conserv\u00E9es, depuis l\u2019ouverture de Mentora. Les comptes supprim\u00E9s ne sont plus compt\u00E9s.",
                  )}
                </p>
              </div>
            </>
          )}
          {tab === "accounts" && (
            <>
              <h2>{translateUi("Comptes cr\u00E9\u00E9s")}</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{translateUi("Membre")}</th>
                      <th>{translateUi("E-mail priv\u00E9")}</th>
                      <th>{translateUi("Cr\u00E9ation")}</th>
                      <th>{translateUi("Profil")}</th>
                      <th>{translateUi("Mod\u00E9ration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.email}</td>
                        <td>{translateUi(date(a.created_at))}</td>
                        <td>
                          {translateUi(
                            a.role === "mentor"
                              ? "Parrain"
                              : a.role === "beginner"
                                ? "Débutant"
                                : "Non renseigné",
                          )}
                        </td>
                        <td>
                          {translateUi(
                            a.profile_id && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void action(
                                    a.blocked
                                      ? "restore-profile"
                                      : "hide-profile",
                                    a.id,
                                  )
                                }
                              >
                                {translateUi(
                                  a.blocked
                                    ? "Lever le masquage"
                                    : "Masquer le profil",
                                )}
                              </button>
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hero-buttons">
                <button
                  className="btn secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {translateUi("Pr\u00E9c\u00E9dent")}
                </button>
                <span>
                  {translateUi("Page ")}
                  {page + 1}
                </span>
                <button
                  className="btn secondary"
                  disabled={(page + 1) * 30 >= Number(s.accounts)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {translateUi("Suivant")}
                </button>
              </div>
            </>
          )}
          {tab === "reports" && (
            <>
              <h2>{translateUi("Signalements")}</h2>
              <p>
                {translateUi(
                  "Les 100 derniers signalements, avec les dossiers ouverts en premier. L\u2019identit\u00E9 du d\u00E9clarant reste r\u00E9serv\u00E9e \u00E0 la mod\u00E9ration.",
                )}
              </p>
              {!data.reports.length ? (
                <p>{translateUi("Aucun signalement.")}</p>
              ) : (
                data.reports.map((r) => (
                  <article className="verification-panel" key={r.id}>
                    <h3>
                      {translateUi(r.target_name)} · {r.reason}
                    </h3>
                    <p>
                      {translateUi(date(r.created_at))} ·{" "}
                      {translateUi(
                        r.status === "open"
                          ? "Ouvert"
                          : r.status === "resolved"
                            ? "Traité"
                            : "Classé sans suite",
                      )}{" "}
                      {translateUi("\u00B7 d\u00E9clar\u00E9 par ")}
                      {translateUi(r.reporter_name)}
                    </p>
                    <p>{translateUi(r.details)}</p>
                    {translateUi(
                      r.review_note && (
                        <p>
                          {translateUi("D\u00E9cision : ")}
                          {translateUi(r.review_note)}
                        </p>
                      ),
                    )}
                    <div className="hero-buttons">
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void action("hide-profile", r.target_id)}
                      >
                        {translateUi("Masquer le profil")}
                      </button>
                      {r.status === "open" && (
                        <>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => void action("resolve", r.id)}
                          >
                            {translateUi("Marquer comme trait\u00E9")}
                          </button>
                          <button
                            className="text-btn"
                            disabled={busy}
                            onClick={() => void action("dismiss", r.id)}
                          >
                            {translateUi("Classer sans suite")}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </>
          )}
          {tab === "ratings" && (
            <>
              <h2>{translateUi("Avis des d\u00E9butants")}</h2>
              <p>
                {translateUi(
                  "Les 100 derni\u00E8res notes. Masquer un avis le retire de la moyenne publique, sans permettre \u00E0 son auteur de voter \u00E0 nouveau.",
                )}
              </p>
              {!data.ratings.length ? (
                <p>{translateUi("Aucun avis pour le moment.")}</p>
              ) : (
                data.ratings.map((r) => (
                  <article className="verification-panel" key={r.id}>
                    <h3>
                      {r.rating}/5 · {r.mentor_name}
                    </h3>
                    <p>
                      {translateUi("Par ")}
                      {r.beginner_name}
                      {translateUi(", le ")}
                      {translateUi(date(r.rated_at))} ·{" "}
                      {translateUi(r.hidden ? "Masqué" : "Public")}
                    </p>
                    <button
                      className="btn secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(
                          r.hidden ? "restore-rating" : "hide-rating",
                          r.id,
                        )
                      }
                    >
                      {translateUi(
                        r.hidden ? "Rétablir cet avis" : "Masquer cet avis",
                      )}
                    </button>
                  </article>
                ))
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
export function ReportProfile({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState("Comportement inapproprié"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  if (sent)
    return (
      <p role="status">
        {translateUi(
          "Signalement envoy\u00E9 \u00E0 l\u2019administration. Ton identit\u00E9 ne sera pas communiqu\u00E9e au membre signal\u00E9.",
        )}
      </p>
    );
  return (
    <div className="report-profile">
      <button className="text-btn muted" onClick={() => setOpen(!open)}>
        {translateUi(open ? "Annuler le signalement" : "Signaler ce profil")}
      </button>
      {open && (
        <form
          className="verification-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await call("/api/reports", "POST", {
                profileId,
                reason,
                details,
              });
              setSent(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {translateUi("Motif")}
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                "Comportement inapproprié",
                "Demande d’argent",
                "Informations trompeuses",
                "Autre",
              ].map((v) => (
                <option key={v} value={v}>
                  {translateUi(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {translateUi("D\u00E9cris les faits")}
            <textarea
              required
              minLength={20}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <p className="small-text">
            {translateUi(
              "N\u2019ajoute pas de donn\u00E9es bancaires ni d\u2019informations priv\u00E9es sur des tiers.",
            )}
          </p>
          <button className="btn secondary" disabled={busy}>
            {translateUi(busy ? "Envoi…" : "Envoyer le signalement")}
          </button>
          {translateUi(
            error && (
              <p className="error" role="alert">
                {translateUi(error)}
              </p>
            ),
          )}
        </form>
      )}
    </div>
  );
}
