"use client";
import { useEffect, useState } from "react";
import type { PublicProfile } from "@/lib/profile";
import { Avatar } from "./profile-photo";
export function FollowCounts({ profile }: { profile: PublicProfile }) {
  return (
    <p className="follow-counts">
      <span>
        <strong>{profile.followerCount ?? 0}</strong> abonné
        {profile.followerCount === 1 ? "" : "s"}
      </span>
      <span>
        <strong>{profile.followingCount ?? 0}</strong> abonnement
        {profile.followingCount === 1 ? "" : "s"}
      </span>
    </p>
  );
}
export function FollowButton({
  profile,
  onChange,
}: {
  profile: PublicProfile;
  onChange: (count: number) => void;
}) {
  const [following, setFollowing] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/follows?profile=" + profile.id, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setFollowing(d.following);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [profile.id]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/follows", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setFollowing(d.following);
      onChange(d.followerCount);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="follow-action">
      <button
        className={`btn ${following ? "secondary" : ""}`}
        disabled={busy || loading}
        onClick={() => void toggle()}
      >
        {loading
          ? "Chargement…"
          : busy
            ? "Enregistrement…"
            : following
              ? "Se désabonner"
              : "S’abonner au profil"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
type Item = {
  id: string;
  profile: PublicProfile | null;
  updatedAt: string | null;
};
export function FollowNetwork({
  onOpen,
  onChange,
}: {
  onOpen: (p: PublicProfile) => void;
  onChange: () => Promise<void>;
}) {
  const [type, setType] = useState<"following" | "followers">("following"),
    [items, setItems] = useState<Item[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    fetch(`/api/follows?type=${type}&page=${page}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) {
          setItems(d.items);
          setTotal(d.total);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [type, page, reload]);
  async function remove(id: string) {
    setBusy(id);
    try {
      const r = await fetch("/api/follows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setPage(0);
      setReload((v) => v + 1);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="follow-network">
      <span className="eyebrow">MON RÉSEAU DE REVENDEURS</span>
      <h2>Abonnés et abonnements</h2>
      <p>
        Retrouve les membres que tu suis et ceux qui te suivent. Les profils
        actualisés le plus récemment apparaissent en premier.
      </p>
      <div className="follow-tabs">
        {(["following", "followers"] as const).map((t) => (
          <button
            key={t}
            className={`btn ${type === t ? "" : "secondary"}`}
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setPage(0);
            }}
          >
            {t === "following" ? "Mes abonnements" : "Mes abonnés"}
          </button>
        ))}
        <button className="text-btn" onClick={() => setReload((v) => v + 1)}>
          Actualiser
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Chargement…</p>
      ) : (
        <>
          <p>
            {total} {type === "following" ? "abonnement" : "abonné"}
            {total === 1 ? "" : "s"}
          </p>
          {!items.length && (
            <p>
              {type === "following"
                ? "Tu ne suis encore personne. Ouvre un profil et clique sur « S’abonner au profil »."
                : "Tes futurs abonnés apparaîtront ici."}
            </p>
          )}
          <div className="follow-list">
            {items.map((item) => (
              <article key={item.id}>
                {item.profile ? (
                  <>
                    <Avatar profile={item.profile} />
                    <div>
                      <strong>{item.profile.name}</strong>
                      <p>
                        {item.profile.role === "mentor"
                          ? "Parrain"
                          : "Débutant"}{" "}
                        · {item.profile.specialty.join(" · ")}
                      </p>
                      {item.updatedAt && (
                        <small>
                          Profil actualisé le{" "}
                          {new Date(item.updatedAt).toLocaleDateString("fr-FR")}
                        </small>
                      )}
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => onOpen(item.profile!)}
                    >
                      Voir le profil
                    </button>
                  </>
                ) : (
                  <p>Profil masqué ou indisponible</p>
                )}
                {type === "following" && (
                  <button
                    className="text-btn"
                    disabled={!!busy}
                    onClick={() => void remove(item.id)}
                  >
                    {busy === item.id ? "…" : "Se désabonner"}
                  </button>
                )}
              </article>
            ))}
          </div>
          {total > 30 && (
            <div className="pagination">
              <button
                className="btn secondary"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédent
              </button>
              <span>Page {page + 1}</span>
              <button
                className="btn secondary"
                disabled={(page + 1) * 30 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
