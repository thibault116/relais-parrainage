"use client";
import { useEffect, useState } from "react";
import { useOwnerPreview } from "./owner-preview";
import { useFeature } from "./beta";
import { SITE_ORIGIN } from "@/lib/site";
type Data = {
  configured: boolean;
  linked: boolean;
  profileId: string | null;
  account: null | {
    id: string;
    username: string;
    avatar: string | null;
    status: string;
    snapshot: {
      status?: "mentor" | "beginner" | null;
      region?: string | null;
      notifications?: { updates: boolean; announcements: boolean };
      warnings?: string[];
    };
    syncedAt: string | null;
    error: string | null;
  };
};
const callbackMessages: Record<string, string> = {
  connected: "Compte Discord connecté.",
  cancelled: "Connexion Discord annulée.",
  expired: "La connexion a expiré. Recommence.",
  revoked: "Connexion révoquée. Reconnecte ton compte.",
  not_member: "Ce compte ne fait pas partie du serveur Mentora.",
  permissions: "Le bot ne peut pas lire les rôles du serveur.",
  unavailable: "Discord est temporairement indisponible.",
  already_linked: "Ce compte Discord est déjà lié à un autre compte Mentora.",
  disconnect_first: "Dissocie le compte actuel avant d’en connecter un autre.",
  invalid: "La connexion Discord n’a pas pu être vérifiée.",
  login: "Connecte-toi à Mentora sur ce domaine, puis reconnecte Discord.",
};
export function DiscordAccountSettings({showTitle=true}:{showTitle?:boolean}) {
  const owner = useOwnerPreview(),
    feature = useFeature("discordAccount");
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!owner || !feature) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/discord-account", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (r.status === 403) return;
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
        const u = new URL(window.location.href),
          result = u.searchParams.get("discord");
        if (result) {
          setNotice(
            callbackMessages[result] || "Recommence la connexion Discord.",
          );
          u.searchParams.delete("discord");
          window.history.replaceState(null, "", u);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [owner, feature]);
  if (!owner || !feature) return null;
  async function run(action: string) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (action === "connect") {
        window.location.assign(`${SITE_ORIGIN}/api/discord-account/connect`);
        return;
      }
      const r = await fetch("/api/discord-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(55000),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      setNotice(
        action === "unlink"
          ? "Compte Discord dissocié."
          : "Rôles synchronisés.",
      );
      window.dispatchEvent(new Event("mentora-discord-synced"));
    } catch (e) {
      setError((e as Error).message);
      const r = await fetch("/api/discord-account", {
        cache: "no-store",
      }).catch(() => null);
      if (r?.ok) setData(await r.json());
    } finally {
      setBusy(false);
    }
  }
  const a = data?.account,
    s = a?.snapshot;
  return (
    <section className="verification-panel discord-account-panel">
      {showTitle&&<h2>Compte Discord</h2>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p role="status">Chargement…</p>}
      {data && (
        <>
          {a ? (
            <>
              <div className="discord-account-identity">
                {a.avatar && (
                  <img
                    src={a.avatar}
                    alt=""
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <strong>{a.username}</strong>
                  <p>
                    {a.status === "revoked"
                      ? "À reconnecter"
                      : a.status === "error"
                        ? "Synchronisation à vérifier"
                        : "Connecté"}
                  </p>
                </div>
              </div>
              {a.error && <p role="alert">{a.error}</p>}
              <dl className="discord-account-roles">
                <div>
                  <dt>Statut Discord</dt>
                  <dd>
                    {s?.status === "mentor"
                      ? "Parrain"
                      : s?.status === "beginner"
                        ? "Débutant"
                        : "Non renseigné"}
                  </dd>
                </div>
                <div>
                  <dt>Région</dt>
                  <dd>{s?.region || "Non renseignée"}</dd>
                </div>
                <div>
                  <dt>Notifications Discord</dt>
                  <dd>
                    {[
                      s?.notifications?.updates ? "Mises à jour" : null,
                      s?.notifications?.announcements ? "Annonces" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Aucune"}
                  </dd>
                </div>
              </dl>
              {s?.warnings?.map((w) => (
                <p key={w} className="small-text">
                  {w}
                </p>
              ))}
              {a.syncedAt && (
                <p className="small-text">
                  Dernière synchronisation :{" "}
                  {new Date(a.syncedAt).toLocaleString("fr-FR")}
                </p>
              )}
              <div className="discord-account-actions">
                {a.status === "revoked" ? (
                  <button
                    className="btn primary"
                    disabled={busy || !data.configured}
                    onClick={() => run("connect")}
                  >
                    Reconnecter Discord
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => run("sync")}
                  >
                    {busy ? "Synchronisation…" : "Synchroniser mes rôles"}
                  </button>
                )}
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => run("unlink")}
                >
                  Dissocier mon compte Discord
                </button>
              </div>
              <p className="small-text">
                Le statut Discord ne change pas tes accès Mentora.
              </p>
            </>
          ) : (
            <>
              <p>Retrouve tes rôles et ta région Discord dans Mentora.</p>
              <button
                className="btn primary"
                disabled={busy || !data.configured}
                onClick={() => run("connect")}
              >
                Connecter mon compte Discord
              </button>
            </>
          )}
          {!data.configured && (
            <p className="small-text">
              Configuration OAuth2 à terminer dans Discord et Vercel.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function DiscordProfileRegion({ profileId }: { profileId: string }) {
  const owner = useOwnerPreview(),
    feature = useFeature("discordAccount"),
    [region, setRegion] = useState<string | null>(null);
  useEffect(() => {
    if (!owner || !feature) {
      setRegion(null);
      return;
    }
    const c = new AbortController();
    const load = () =>
      fetch("/api/discord-account", { cache: "no-store", signal: c.signal })
        .then(async (r) => {
          if (!r.ok) {
            setRegion(null);
            return;
          }
          const d: Data = await r.json();
          setRegion(
            d.profileId === profileId && d.account?.status === "linked"
              ? d.account.snapshot.region || null
              : null,
          );
        })
        .catch(() => {});
    void load();
    window.addEventListener("mentora-discord-synced", load);
    return () => {
      c.abort();
      window.removeEventListener("mentora-discord-synced", load);
    };
  }, [owner, feature, profileId]);
  return region ? (
    <span className="discord-profile-region">📍 {region}</span>
  ) : null;
}
