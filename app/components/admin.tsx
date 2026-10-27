"use client";
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
const date = (v: string) => new Date(v).toLocaleDateString("fr-FR");
export function AdminDashboard({
  tab,
  setTab,
  onPreview,
}: {
  tab: string;
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
        <span className="eyebrow">ESPACE PRIVÉ</span>
        <h1>
          Administration<span>.</span>
        </h1>
        <p>Pilote Mentora et garde une communauté bienveillante.</p>
      </div>
      <nav className="admin-tabs" aria-label="Rubriques administrateur">
        {[
          ["overview", "Vue d’ensemble"],
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
            {label}
          </button>
        ))}
      </nav>
      <button className="text-btn" onClick={() => void load()}>
        Actualiser les données
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "settings" ? (
        <AdminSettings />
      ) : tab === "emails" ? (
        <AdminEmails />
      ) : tab === "suggestions" ? (
        <AdminSuggestions />
      ) : tab === "verification" ? (
        <Moderation />
      ) : !data || !s ? (
        <p>Chargement…</p>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <section className="admin-role-preview">
                <div>
                  <h2>Voir Mentora comme un membre</h2>
                  <p>
                    Explore les menus parrain et débutant sans changer ton
                    compte administrateur.
                  </p>
                </div>
                <div className="role-preview-actions">
                  <button className="btn" onClick={() => onPreview("mentor")}>
                    Voir comme un parrain
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => onPreview("beginner")}
                  >
                    Voir comme un débutant
                  </button>
                </div>
              </section>
              <div className="admin-stats">
                {[
                  ["Comptes créés", s.accounts],
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
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <div className="verification-panel">
                <h2>Comprendre les chiffres</h2>
                <p>
                  {s.mentors} profils parrains au total · {s.profiles} profils
                  renseignés.
                </p>
                <p>
                  Un parrain actif a au moins un accompagnement en cours. Le
                  taux d’acceptation correspond aux demandes acceptées (y
                  compris les binômes terminés) divisées par les demandes
                  acceptées ou refusées. Sans décision, il reste indéfini.
                </p>
                <p>
                  {s.pending} demandes en attente · {s.accepted} acceptées ·{" "}
                  {s.declined} refusées · {s.cancelled} annulées.
                </p>
                <p>
                  {s.reports} signalements reçus au total. Note moyenne publique
                  :{" "}
                  {s.average
                    ? `${Number(s.average).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5`
                    : "pas encore d’avis"}
                  .
                </p>
                <p>
                  Les chiffres portent sur les données actuellement conservées,
                  depuis l’ouverture de Mentora. Les comptes supprimés ne sont
                  plus comptés.
                </p>
              </div>
            </>
          )}
          {tab === "accounts" && (
            <>
              <h2>Comptes créés</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Membre</th>
                      <th>E-mail privé</th>
                      <th>Création</th>
                      <th>Profil</th>
                      <th>Modération</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.email}</td>
                        <td>{date(a.created_at)}</td>
                        <td>
                          {a.role === "mentor"
                            ? "Parrain"
                            : a.role === "beginner"
                              ? "Débutant"
                              : "Non renseigné"}
                        </td>
                        <td>
                          {a.profile_id && (
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
                              {a.blocked
                                ? "Lever le masquage"
                                : "Masquer le profil"}
                            </button>
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
                  Précédent
                </button>
                <span>Page {page + 1}</span>
                <button
                  className="btn secondary"
                  disabled={(page + 1) * 30 >= Number(s.accounts)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </>
          )}
          {tab === "reports" && (
            <>
              <h2>Signalements</h2>
              <p>
                Les 100 derniers signalements, avec les dossiers ouverts en
                premier. L’identité du déclarant reste réservée à la modération.
              </p>
              {!data.reports.length ? (
                <p>Aucun signalement.</p>
              ) : (
                data.reports.map((r) => (
                  <article className="verification-panel" key={r.id}>
                    <h3>
                      {r.target_name} · {r.reason}
                    </h3>
                    <p>
                      {date(r.created_at)} ·{" "}
                      {r.status === "open"
                        ? "Ouvert"
                        : r.status === "resolved"
                          ? "Traité"
                          : "Classé sans suite"}{" "}
                      · déclaré par {r.reporter_name}
                    </p>
                    <p>{r.details}</p>
                    {r.review_note && <p>Décision : {r.review_note}</p>}
                    <div className="hero-buttons">
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void action("hide-profile", r.target_id)}
                      >
                        Masquer le profil
                      </button>
                      {r.status === "open" && (
                        <>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => void action("resolve", r.id)}
                          >
                            Marquer comme traité
                          </button>
                          <button
                            className="text-btn"
                            disabled={busy}
                            onClick={() => void action("dismiss", r.id)}
                          >
                            Classer sans suite
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
              <h2>Avis des débutants</h2>
              <p>
                Les 100 dernières notes. Masquer un avis le retire de la moyenne
                publique, sans permettre à son auteur de voter à nouveau.
              </p>
              {!data.ratings.length ? (
                <p>Aucun avis pour le moment.</p>
              ) : (
                data.ratings.map((r) => (
                  <article className="verification-panel" key={r.id}>
                    <h3>
                      {r.rating}/5 · {r.mentor_name}
                    </h3>
                    <p>
                      Par {r.beginner_name}, le {date(r.rated_at)} ·{" "}
                      {r.hidden ? "Masqué" : "Public"}
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
                      {r.hidden ? "Rétablir cet avis" : "Masquer cet avis"}
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
        Signalement envoyé à l’administration. Ton identité ne sera pas
        communiquée au membre signalé.
      </p>
    );
  return (
    <div className="report-profile">
      <button className="text-btn muted" onClick={() => setOpen(!open)}>
        {open ? "Annuler le signalement" : "Signaler ce profil"}
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
            Motif
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                "Comportement inapproprié",
                "Demande d’argent",
                "Informations trompeuses",
                "Autre",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Décris les faits
            <textarea
              required
              minLength={20}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <p className="small-text">
            N’ajoute pas de données bancaires ni d’informations privées sur des
            tiers.
          </p>
          <button className="btn secondary" disabled={busy}>
            {busy ? "Envoi…" : "Envoyer le signalement"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
