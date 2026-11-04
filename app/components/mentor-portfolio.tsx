"use client";
import { useState, useEffect, useCallback } from "react";
type Data = {
  bio: string;
  complete: boolean;
  images: { id: string; url: string }[];
};
async function request(path = "", method = "GET", body?: unknown) {
  const r = await fetch("/api/mentor-portfolio" + path, {
    method,
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
export function MentorCompletionBanner({ onOpen }: { onOpen: () => void }) {
  const [needed, setNeeded] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      request()
        .then((d) => {
          if (active) setNeeded(!d.complete);
        })
        .catch(() => {});
    void load();
    window.addEventListener("mentor-portfolio-updated", load);
    return () => {
      active = false;
      window.removeEventListener("mentor-portfolio-updated", load);
    };
  }, []);
  return needed ? (
    <aside className="mentor-completion-banner">
      <span>Finalise ton profil parrain pour inspirer confiance.</span>
      <button onClick={onOpen}>Finaliser mon profil</button>
    </aside>
  ) : null;
}
export function MentorPortfolio({
  editing = false,
  profileId,
}: {
  editing?: boolean;
  profileId?: string;
}) {
  const [data, setData] = useState<Data | null>(null),
    [bio, setBio] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(
    async (resetBio = true) => {
      const d = await request(
        profileId ? "?profile=" + encodeURIComponent(profileId) : "",
      );
      setData(d);
      if (resetBio) setBio(d.bio);
    },
    [profileId],
  );
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  const changed = async () => {
    await load(false);
    window.dispatchEvent(new Event("mentor-portfolio-updated"));
  };
  if (!editing && (!data || (!data.bio && !data.images.length))) return null;
  return (
    <section className="mentor-portfolio">
      <h2>{editing ? "Finaliser mon profil" : "Son parcours en images"}</h2>
      {error && <p role="alert">{error}</p>}
      {editing ? (
        <>
          <p>
            Présente ton parcours et publie jusqu’à dix images : chiffres
            d’affaires, dashboard, porte-monnaie Vinted, colis…
          </p>
          <p className="field-hint">
            Ces éléments seront publics sur ton profil. Masque les noms,
            adresses et autres informations personnelles avant de publier. Les
            anciennes pièces de vérification restent confidentielles.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request("", "PUT", { bio });
                await changed();
                setNotice("Biographie enregistrée.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Ta courte biographie
              <textarea
                maxLength={1000}
                value={bio}
                rows={4}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <small>
              30 caractères et une image minimum pour finaliser ton profil ·{" "}
              {bio.length}/1 000
            </small>
            <button className="btn" disabled={busy}>
              Enregistrer la biographie
            </button>
          </form>
          <label className="portfolio-upload">
            Ajouter des images ({data?.images.length || 0}/10)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || (data?.images.length || 0) >= 10}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                if (files.length + (data?.images.length || 0) > 10) {
                  setError("Dix images maximum au total.");
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  for (const file of files) {
                    const form = new FormData();
                    form.set("file", file);
                    await request("", "POST", form);
                  }
                  setNotice("Images publiées.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  try {
                    await changed();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }
              }}
            />
          </label>
          <p role="status">
            {notice}
            {data?.complete ? " Ton profil est finalisé." : ""}
          </p>
        </>
      ) : (
        <p className="portfolio-bio">{data?.bio}</p>
      )}
      <div className="portfolio-grid">
        {data?.images.map((image, i) => (
          <figure key={image.id}>
            <a href={image.url} target="_blank" rel="noopener noreferrer">
              <img
                src={image.url}
                alt={`Image du parcours ${i + 1}`}
                loading="lazy"
              />
            </a>
            {editing && (
              <button
                className="text-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await request("", "DELETE", { id: image.id });
                    await changed();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Retirer l’image {i + 1}
              </button>
            )}
          </figure>
        ))}
      </div>
      {!editing && (
        <small>Éléments publiés par le membre, non vérifiés par Mentora.</small>
      )}
    </section>
  );
}
