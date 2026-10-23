"use client";
import { useCallback, useEffect, useState } from "react";
import { Star, HeartHandshake, CheckCircle2 } from "lucide-react";
type Accompaniment = {
  id: string;
  status: "pending" | "active" | "completed" | "declined" | "cancelled";
  side: "beginner" | "mentor";
  partner_name: string;
  rating: number | null;
};
async function request(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}
export function RatingSummary({
  average = 0,
  count = 0,
}: {
  average?: number;
  count?: number;
}) {
  return (
    <p className="rating-summary">
      <Star size={15} fill={count ? "currentColor" : "none"} />
      {count ? (
        <>
          <strong>
            {average.toLocaleString("fr-FR", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}
            /5
          </strong>
          <span>
            · {count} avis{" "}
            {count === 1 ? "après accompagnement" : "après accompagnements"}
          </span>
        </>
      ) : (
        <span>Pas encore de note</span>
      )}
    </p>
  );
}
export function RequestAccompaniment({
  mentorProfileId,
}: {
  mentorProfileId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="pair-request">
      <h3>Vous avez décidé d’avancer ensemble ?</h3>
      <p>
        Envoie une demande à ce parrain. Il pourra confirmer votre binôme dans «
        Mon profil ». Tu pourras le noter une fois l’accompagnement terminé.
      </p>
      <button
        className="btn secondary full"
        disabled={busy || sent}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await request("/api/accompaniments", "POST", { mentorProfileId });
            setSent(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {sent ? (
          <>
            <CheckCircle2 size={17} /> Demande envoyée
          </>
        ) : busy ? (
          "Envoi…"
        ) : (
          "Choisir ce parrain"
        )}
      </button>
      {sent && (
        <p role="status">
          Préviens ton parrain sur Discord pour qu’il accepte ta demande.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Accompaniments() {
  const [items, setItems] = useState<Accompaniment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setItems((await request("/api/accompaniments")).accompaniments);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="accompaniments">
      <div className="section-top">
        <div>
          <span className="eyebrow">DU PREMIER MESSAGE AU DERNIER CONSEIL</span>
          <h2>Mes accompagnements</h2>
        </div>
        <button className="text-btn" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      <p>
        Le parrain accepte la demande pour confirmer le binôme. Ensuite, chacun
        peut signaler la fin de l’accompagnement. Le débutant peut alors laisser
        une seule note, de 1 à 5 étoiles.
      </p>
      {loading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : items.length ? (
        <div className="pair-list">
          {items.map((item) => (
            <Pair key={item.id} item={item} reload={load} />
          ))}
        </div>
      ) : (
        <div className="info-box">
          <HeartHandshake />
          <p>
            Aucun accompagnement pour le moment. Côté débutant, ouvre la fiche
            de ton parrain dans l’annuaire et clique sur « Choisir ce parrain ».
          </p>
        </div>
      )}
    </section>
  );
}
function Pair({
  item,
  reload,
}: {
  item: Accompaniment;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const labels = {
    pending: "En attente de confirmation",
    active: "En cours",
    completed: "Terminé",
    declined: "Demande refusée",
    cancelled: "Demande annulée",
  };
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      await request("/api/accompaniments", "PATCH", { id: item.id, action });
      setConfirm(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="pair-card">
      <div className="pair-heading">
        <div>
          <span className="eyebrow">
            {item.side === "beginner" ? "MON PARRAIN" : "MON DÉBUTANT"}
          </span>
          <h3>{item.partner_name}</h3>
        </div>
        <span className="badge">{labels[item.status]}</span>
      </div>
      {item.status === "pending" &&
        (item.side === "mentor" ? (
          <div className="pair-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void act("accept")}
            >
              Accepter le binôme
            </button>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => void act("decline")}
            >
              Refuser
            </button>
          </div>
        ) : (
          <div>
            <p>Ton parrain doit accepter la demande depuis son profil.</p>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => void act("cancel")}
            >
              Annuler la demande
            </button>
          </div>
        ))}
      {item.status === "active" &&
        (confirm ? (
          <div>
            <p>
              Confirmer que l’accompagnement est terminé ? Cette action ouvre la
              notation au débutant et ne peut pas être annulée.
            </p>
            <div className="pair-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => void act("complete")}
              >
                Confirmer la fin
              </button>
              <button className="text-btn" onClick={() => setConfirm(false)}>
                Continuer l’accompagnement
              </button>
            </div>
          </div>
        ) : (
          <button className="btn secondary" onClick={() => setConfirm(true)}>
            Terminer l’accompagnement
          </button>
        ))}
      {item.status === "completed" &&
        (item.rating !== null ? (
          <p className="rating-summary">
            <Star size={17} fill="currentColor" />
            <strong>{item.rating}/5</strong>
            <span>
              {item.side === "beginner"
                ? "Ta note a bien été enregistrée."
                : "Note reçue après cet accompagnement."}
            </span>
          </p>
        ) : item.side === "beginner" ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!score) return;
              setBusy(true);
              setError("");
              try {
                await request("/api/ratings", "POST", {
                  accompanimentId: item.id,
                  rating: score,
                });
                await reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h4>Comment s’est passé ton accompagnement ?</h4>
            <div
              className="stars-input"
              role="group"
              aria-label="Note de l’accompagnement"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  aria-pressed={score === n}
                  disabled={busy}
                  onClick={() => setScore(n)}
                >
                  <Star size={28} fill={n <= score ? "currentColor" : "none"} />
                </button>
              ))}
              <span>{score ? `${score}/5` : "Choisis ta note"}</span>
            </div>
            <p className="small-text">
              Ta note contribuera à la moyenne publique du parrain. Un seul avis
              par binôme, non modifiable après envoi.
            </p>
            <button className="btn" disabled={!score || busy}>
              {busy ? "Enregistrement…" : "Publier ma note"}
            </button>
          </form>
        ) : (
          <p>Le débutant peut maintenant laisser sa note.</p>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
