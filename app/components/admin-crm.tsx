"use client";
import { useCallback, useEffect, useState } from "react";
const euros = (n: unknown) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Number(n || 0) / 100,
  );
type Data = {
  connection: null | {
    account_key: string;
    last_sync_at: string | null;
    last_status: string;
    last_message: string;
    expires_at: string;
  };
  stats: {
    total: number;
    day_cents: number;
    month_cents: number;
    quarter_cents: number;
    year_cents: number;
    pending_cents: number;
    undated: number;
    oldest: string | null;
  };
  sales: {
    account_key: string;
    order_id: string;
    title: string;
    photo_url: string;
    order_url: string;
    amount_cents: number;
    status: string;
    sold_on: string | null;
  }[];
  page: number;
  today: string;
};
const statuses: Record<string, string> = {
  completed: "Terminée",
  pending: "En cours",
  cancelled: "Annulée",
  refunded: "Remboursée",
  waiting: "En attente de connexion",
  syncing: "Synchronisation en cours",
  complete: "Lecture terminée",
  paused: "En pause",
  login_required: "Connexion Vinted nécessaire",
  unsupported: "Lecture à adapter",
  error: "Synchronisation interrompue",
};
async function call(method = "GET", page = 0) {
  const r = await fetch(`/api/admin/crm?page=${page}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Impossible de charger le CRM.");
  return d;
}
export function AdminCrm({ extension = false }: { extension?: boolean }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [key, setKey] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await call("GET", page));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page]);
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => clearInterval(interval);
  }, [load]);
  async function connect() {
    if (
      data?.connection &&
      !window.confirm(
        "Remplacer la clé ? L’ancienne extension devra être reconnectée.",
      )
    )
      return;
    setBusy(true);
    try {
      const d = await call("POST");
      setKey(d.token);
      setNotice(
        "Cette clé ne sera affichée qu’ici. Copie-la dans les paramètres de l’extension.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (
      !window.confirm(
        "Déconnecter l’extension ? Les ventes déjà importées seront conservées.",
      )
    )
      return;
    setBusy(true);
    try {
      await call("DELETE");
      setKey("");
      setNotice("Connexion révoquée. Les ventes sont conservées.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const c = data?.connection,
    stale =
      c?.last_sync_at &&
      Date.now() - new Date(c.last_sync_at).getTime() > 20 * 60000;
  return (
    <div className="crm-admin">
      <div className="crm-heading">
        <div>
          <span className="eyebrow">ESPACE PERSONNEL ADMINISTRATEUR</span>
          <h2>{extension ? "Extension Vinted" : "Mon CRM Vinted"}</h2>
        </div>
        <button className="btn secondary" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="verification-panel">
        <h3>Connexion Vinted</h3>
        <p>
          {c
            ? statuses[c.last_status] || c.last_status
            : "Aucune extension connectée."}
          {c?.account_key ? ` · Compte : ${c.account_key}` : ""}
        </p>
        <p>
          {c?.last_sync_at
            ? `Dernier contact : ${new Date(c.last_sync_at).toLocaleString("fr-FR")}`
            : "Aucune synchronisation reçue."}
        </p>
        {stale && (
          <p className="info-box">
            Aucun contact récent. Vérifie que le navigateur est ouvert et que
            l’extension est active.
          </p>
        )}
        {c?.last_message && <p>{c.last_message}</p>}
        {c && new Date(c.expires_at).getTime() < Date.now() && (
          <p className="error">La clé a expiré. Crée une nouvelle connexion.</p>
        )}
      </section>
      <p className="info-box">
        Extension en bêta : la lecture n’a pas encore été vérifiée sur tes
        commandes Vinted. Elle peut nécessiter une adaptation avant tout import.
        Les totaux portent uniquement sur les ventes reconnues et importées.
      </p>
      {extension ? (
        <>
          <section className="verification-panel">
            <h3>Installer l’extension sur ordinateur</h3>
            <ol className="crm-install">
              <li>
                <a className="btn" href="/api/admin/crm/extension" download>
                  Télécharger l’extension Mentora (.zip)
                </a>
                <p>
                  Décompresse le fichier et conserve le dossier. Compatible
                  Chrome, Edge et Brave sur ordinateur ; pas avec Safari ni
                  Vinted mobile.
                </p>
              </li>
              <li>
                Dans Chrome, ouvre <code>chrome://extensions</code> (Edge :{" "}
                <code>edge://extensions</code>, Brave :{" "}
                <code>brave://extensions</code>). Active{" "}
                <strong>Mode développeur</strong>, clique sur{" "}
                <strong>Charger l’extension non empaquetée</strong> et choisis
                le dossier décompressé.{" "}
                <a
                  href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Guide officiel Chrome
                </a>
                .
              </li>
              <li>
                Crée une clé ci-dessous, puis ouvre l’icône Mentora dans les
                extensions et colle la clé dans ses paramètres. Ne partage pas
                cette clé.
              </li>
              <li>
                Connecte-toi à Vinted, ouvre <strong>Commandes → Ventes</strong>{" "}
                et copie l’adresse de cette page dans l’extension. Renseigne
                également l’identifiant de ton profil pour éviter de mélanger
                deux comptes.
              </li>
              <li>
                Clique sur <strong>Démarrer</strong>. L’extension crée son
                unique onglet en arrière-plan. Laisse cet onglet réservé à
                Mentora. Utilise <strong>Pause</strong> pour reprendre la main.
              </li>
            </ol>
          </section>
          <section className="verification-panel">
            <h3>Associer mon extension</h3>
            <p>
              La clé autorise uniquement l’envoi de tes ventes vers ce CRM. Elle
              expire après 90 jours. Ton mot de passe et tes cookies Vinted ne
              sont jamais transmis à Mentora.
            </p>
            <div className="crm-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => void connect()}
              >
                {c ? "Renouveler la clé" : "Créer une clé de connexion"}
              </button>
              {c && (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void revoke()}
                >
                  Révoquer la connexion
                </button>
              )}
            </div>
            {key && (
              <label>
                Clé à coller dans l’extension
                <input
                  readOnly
                  type="password"
                  value={key}
                  autoComplete="off"
                />
                <button
                  className="text-btn"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(key)
                      .then(() => setNotice("Clé copiée."))
                      .catch(() =>
                        setError(
                          "Copie impossible. Sélectionne la clé manuellement.",
                        ),
                      )
                  }
                >
                  Copier la clé
                </button>
              </label>
            )}
          </section>
          <section className="verification-panel">
            <h3>Comprendre la synchronisation</h3>
            <p>
              Le navigateur doit rester ouvert et l’ordinateur éveillé. Après
              une veille, la synchronisation reprend au prochain réveil. Une
              connexion expirée ou un contrôle Vinted nécessite ton
              intervention.
            </p>
            <p>
              Mentora lit uniquement les données visibles des commandes. Si une
              information n’est pas identifiable, la lecture s’arrête ou la
              vente est signalée comme incomplète. Un historique partiel ne
              constitue pas un chiffre d’affaires complet.
            </p>
            <p>
              Pour une mise à jour : remplace les fichiers du dossier, puis
              clique sur Recharger dans la page des extensions. Aucun achat,
              message ou modification d’annonce n’est effectué.
            </p>
          </section>
        </>
      ) : (
        <>
          <div className="crm-stats">
            {[
              ["Aujourd’hui", data?.stats.day_cents],
              ["Ce mois", data?.stats.month_cents],
              ["Ce trimestre", data?.stats.quarter_cents],
              ["Cette année", data?.stats.year_cents],
            ].map(([label, value]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>{euros(value)}</strong>
                <small>Ventes terminées importées</small>
              </article>
            ))}
          </div>
          <p className="small-text">
            Périodes calendaires, fuseau Europe/Paris. Montants des articles,
            hors frais de port et protection acheteur. Ce chiffre représente les
            ventes importées, pas le bénéfice ni un relevé comptable certifié.
          </p>
          <section className="verification-panel">
            <h3>Historique des ventes</h3>
            <p>
              {Number(data?.stats.total || 0)} commande(s) importée(s) ·{" "}
              {euros(data?.stats.pending_cents)} en cours
              {data?.stats.oldest
                ? ` · Première date connue : ${data.stats.oldest}`
                : ""}
            </p>
            {Number(data?.stats.undated || 0) > 0 && (
              <p className="info-box">
                {data?.stats.undated} vente(s) sans date précise : exclues des
                totaux par période.
              </p>
            )}
            {!data ? (
              <p>Chargement…</p>
            ) : !data.sales.length ? (
              <p>
                Aucune vente importée pour le moment. Ouvre l’onglet Extension
                pour connecter Vinted.
              </p>
            ) : (
              <div className="crm-sales">
                {data.sales.map((s) => (
                  <article key={`${s.account_key}:${s.order_id}`}>
                    <div className="crm-photo">
                      {s.photo_url ? (
                        <img
                          src={s.photo_url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.hidden = true;
                          }}
                        />
                      ) : (
                        <span>Sans photo</span>
                      )}
                    </div>
                    <div>
                      <h4>{s.title}</h4>
                      <p>
                        {s.sold_on || "Date non disponible"} ·{" "}
                        {statuses[s.status]}
                      </p>
                      <small>Commande {s.order_id}</small>
                      <a
                        href={s.order_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Voir sur Vinted
                      </a>
                    </div>
                    <strong>{euros(s.amount_cents)}</strong>
                  </article>
                ))}
              </div>
            )}
            <div className="crm-actions">
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
                disabled={!data || (page + 1) * 30 >= Number(data.stats.total)}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
