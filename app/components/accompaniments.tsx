"use client";
import { usePlatformSettings } from "./platform-settings";
import { useCallback, useEffect, useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
type Accompaniment = {
  id: string;
  status: "pending" | "active" | "completed" | "declined" | "cancelled";
  side: "beginner" | "mentor";
  partner_name: string;
  rating: number | null;
  objective: string;
  created_at: string;
};
async function request(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
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
  verified = false,
  compact = false,
}: {
  compact?: boolean;
  mentorProfileId: string;
  verified?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const settings = usePlatformSettings();
  const [objective, setObjective] = useState("");
  const [error, setError] = useState("");
  if (!settings.requestsEnabled)
    return (
      <p className="small-text">
        Les nouvelles demandes sont temporairement en pause.
      </p>
    );
  if (settings.verifiedMentorsOnly && !verified)
    return (
      <p className="small-text">
        Ce parrain doit faire vérifier son compte avant de recevoir de nouvelles
        demandes.
      </p>
    );
  return (
    <div className="pair-request">
      {!compact && (
        <>
          <h3>Vous avez décidé d’avancer ensemble ?</h3>
          <p>
            Envoie une demande à ce parrain. Il pourra confirmer votre binôme
            dans « Mon profil ». Tu pourras le noter une fois l’accompagnement
            terminé.
          </p>
        </>
      )}
      {!sent && (
        <label className="request-objective">
          Ton objectif pour cet accompagnement
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            minLength={10}
            maxLength={2000}
            disabled={busy}
            placeholder="Ex. Je débute sur Vinted et je voudrais choisir mes premières pièces avec un budget de 150 €."
          />
          <small>
            Explique où tu en es et l’aide que tu recherches. Le message est
            réservé à ton binôme. Une place sera occupée seulement après
            acceptation.
          </small>
        </label>
      )}
      <button
        className="btn secondary full"
        disabled={busy || sent || objective.trim().length < 10}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await request("/api/accompaniments", "POST", {
              mentorProfileId,
              objective,
            });
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
        ) : compact ? (
          "Envoyer une demande de parrainage"
        ) : (
          "Choisir ce parrain"
        )}
      </button>
      {sent && (
        <p role="status">
          Ta demande est dans la boîte de réception du parrain. Retrouve son
          statut dans Mon profil → Demandes.
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
export function Accompaniments({
  onChange,
  mode = "accompaniments",
}: {
  mode?: "accompaniments" | "requests";
  onChange: () => Promise<void>;
}) {
  const [items, setItems] = useState<Accompaniment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setItems((await request("/api/accompaniments")).accompaniments);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onChange]);
  useEffect(() => {
    void load();
  }, [load]);
  const groups =
    mode === "requests"
      ? [
          {
            label: "Demandes reçues",
            rows: items.filter((i) => i.side === "mentor"),
          },
          {
            label: "Demandes envoyées",
            rows: items.filter((i) => i.side === "beginner"),
          },
        ]
      : [
          {
            label: "Accompagnements actifs",
            rows: items.filter((i) => i.status === "active"),
          },
          {
            label: "Historique des accompagnements",
            rows: items.filter((i) => i.status === "completed"),
          },
        ];
  return (
    <section className="accompaniments">
      <div className="section-top">
        <div>
          <span className="eyebrow">MON BINÔME, ÉTAPE PAR ÉTAPE</span>
          <h2>
            {mode === "requests" ? "Mes demandes" : "Mes accompagnements"}
          </h2>
        </div>
        <button className="text-btn" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      <p>
        {mode === "requests"
          ? "Retrouve tes demandes envoyées et reçues. Une demande acceptée devient un accompagnement actif."
          : "Retrouve tes binômes en cours et terminés. À la fin, le débutant peut laisser une note à son parrain."}
      </p>
      {loading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="pair-group">
            <h3>
              {group.label} <span className="badge">{group.rows.length}</span>
            </h3>
            {group.rows.length ? (
              <div className="pair-list">
                {group.rows.map((item) => (
                  <Pair
                    key={item.id}
                    item={item}
                    reload={load}
                    requestsOnly={mode === "requests"}
                  />
                ))}
              </div>
            ) : (
              <p className="small-text">Rien à afficher pour le moment.</p>
            )}
          </section>
        ))
      )}
    </section>
  );
}

function Pair({
  item,
  reload,
  requestsOnly = false,
}: {
  requestsOnly?: boolean;
  item: Accompaniment;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const labels = {
    pending: "En attente de confirmation",
    active: requestsOnly ? "Demande acceptée · en cours" : "En cours",
    completed: requestsOnly ? "Demande acceptée · terminé" : "Terminé",
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
      <p className="small-text">
        Demande du {new Date(item.created_at).toLocaleDateString("fr-FR")}
      </p>
      <div className="request-message">
        <strong>Objectif du débutant</strong>
        <p>
          {item.objective ||
            "Ancienne demande : aucun message d’objectif n’avait été renseigné."}
        </p>
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
      {!requestsOnly &&
        item.status === "active" &&
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
      {!requestsOnly &&
        item.status === "completed" &&
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
