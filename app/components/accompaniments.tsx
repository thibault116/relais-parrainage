"use client";
import { t as translateUi, locale } from "@/app/components/language";
import { usePlatformSettings } from "./platform-settings";
import { useCallback, useEffect, useState } from "react";
import { Star, CheckCircle2, RefreshCw } from "lucide-react";
type Accompaniment = {
  id: string;
  status: "pending" | "active" | "completed" | "declined" | "cancelled";
  side: "beginner" | "mentor";
  direction: "sent" | "received";
  decline_reason: string;
  partner_discord: string | null;
  partner_profile_id: string | null;
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
            {translateUi(
              average.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              }),
            )}
            /5
          </strong>
          <span>
            · {count}
            {translateUi(" avis")}{" "}
            {translateUi(
              count === 1 ? "après accompagnement" : "après accompagnements",
            )}
          </span>
        </>
      ) : (
        <span>{translateUi("Pas encore de note")}</span>
      )}
    </p>
  );
}
export function RequestAccompaniment({
  targetProfileId,
  senderRole,
  verified = false,
}: {
  targetProfileId: string;
  senderRole: "mentor" | "beginner";
  verified?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [objective, setObjective] = useState(""),
    [error, setError] = useState("");
  const settings = usePlatformSettings();
  if (!settings.requestsEnabled)
    return (
      <p>
        {translateUi("Les nouvelles demandes sont temporairement en pause.")}
      </p>
    );
  if (settings.verifiedMentorsOnly && !verified)
    return (
      <p>
        {translateUi(
          "Le compte parrain doit \u00EAtre v\u00E9rifi\u00E9 pour envoyer ou recevoir une demande.",
        )}
      </p>
    );
  if (sent)
    return (
      <p role="status">
        <CheckCircle2 size={17} />
        {translateUi(
          " Demande envoy\u00E9e. Retrouve sa r\u00E9ponse dans Mon profil \u2192 Demandes.",
        )}
      </p>
    );
  if (!open)
    return (
      <button className="btn full" onClick={() => setOpen(true)}>
        {translateUi("Envoyer une demande")}
      </button>
    );
  return (
    <form
      className="pair-request"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await request("/api/accompaniments", "POST", {
            targetProfileId,
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
      <label className="request-objective">
        {translateUi(
          senderRole === "mentor"
            ? "Ce que tu peux apporter à ce débutant"
            : "Ce que tu aimerais que ce parrain t’apporte",
        )}
        <textarea
          required
          minLength={10}
          maxLength={2000}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          disabled={busy}
          placeholder={translateUi(
            senderRole === "mentor"
              ? "Présente ton expérience et explique comment tu pourrais l’aider."
              : "Présente tes objectifs et l’aide que tu recherches.",
          )}
        />
      </label>
      <p className="small-text">
        {translateUi(
          "La demande arrive dans son onglet Demandes. Une place est occup\u00E9e et vos contacts Discord sont partag\u00E9s uniquement apr\u00E8s acceptation.",
        )}
      </p>
      <div className="pair-actions">
        <button className="btn" disabled={busy || objective.trim().length < 10}>
          {translateUi(busy ? "Envoi…" : "Envoyer ma demande")}
        </button>
        <button
          type="button"
          className="text-btn"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          {translateUi("Annuler")}
        </button>
      </div>
      {translateUi(
        error && (
          <p className="error" role="alert">
            {translateUi(error)}
          </p>
        ),
      )}
    </form>
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
            rows: items.filter((i) => i.direction === "received"),
          },
          {
            label: "Demandes envoyées",
            rows: items.filter((i) => i.direction === "sent"),
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
          <span className="eyebrow">
            {translateUi("MON BIN\u00D4ME, \u00C9TAPE PAR \u00C9TAPE")}
          </span>
          <h2>
            {translateUi(
              mode === "requests" ? "Mes demandes" : "Mes accompagnements",
            )}
          </h2>
        </div>
        <button className="refresh-icon" aria-label={translateUi("Actualiser")} title={translateUi("Actualiser")} disabled={loading} onClick={() => void load()}>
          <RefreshCw size={18} className={loading ? "spin" : undefined} />
        </button>
      </div>
      <p>
        {mode === "requests"
          ? "Retrouve tes demandes envoyées et reçues. Une demande acceptée devient un accompagnement actif."
          : "Retrouve tes binômes en cours et terminés. À la fin, le débutant peut laisser une note à son parrain."}
      </p>
      {loading ? (
        <p>{translateUi("Chargement\u2026")}</p>
      ) : error ? (
        <p className="error" role="alert">
          {translateUi(error)}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="pair-group">
            <h3>
              {translateUi(group.label)}{" "}
              <span className="badge">{group.rows.length}</span>
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
              <p className="small-text">
                {translateUi("Rien \u00E0 afficher pour le moment.")}
              </p>
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
  const [declining, setDeclining] = useState(false),
    [reason, setReason] = useState("");
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
      await request("/api/accompaniments", "PATCH", {
        id: item.id,
        action,
        ...(action === "decline" ? { reason } : {}),
      });
      setConfirm(false);
      setDeclining(false);
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
            {translateUi(
              item.side === "beginner" ? "MON PARRAIN" : "MON DÉBUTANT",
            )}
          </span>
          <h3>{item.partner_name}</h3>
        </div>
        <span className="badge">{translateUi(labels[item.status])}</span>
      </div>
      <p className="small-text">
        {translateUi("Demande du ")}
        {translateUi(new Date(item.created_at).toLocaleDateString(locale()))}
      </p>
      <div className="request-message">
        <strong>{translateUi("Message de la demande")}</strong>
        <p>
          {item.objective ||
            "Ancienne demande : aucun message d’objectif n’avait été renseigné."}
        </p>
      </div>
      {item.status === "declined" && (
        <div className="request-message">
          <strong>{translateUi("Motif du refus")}</strong>
          <p>
            {item.decline_reason ||
              "Ancienne demande : aucun motif n’avait été enregistré."}
          </p>
        </div>
      )}
      {translateUi(
        item.partner_discord && (
          <div className="contact-panel">
            <strong>
              {translateUi("Discord de ton bin\u00F4me : @")}
              {translateUi(item.partner_discord)}
            </strong>
            <p>
              {translateUi(
                "Sur Discord, ouvre Amis \u2192 Ajouter un ami et saisis ce pseudo.",
              )}
            </p>
          </div>
        ),
      )}
      {item.status === "pending" &&
        (item.direction === "received" ? (
          <div className="pair-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void act("accept")}
            >
              {translateUi("Accepter le bin\u00F4me")}
            </button>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => setDeclining(true)}
            >
              {translateUi("Refuser")}
            </button>
          </div>
        ) : (
          <div>
            <p>
              {translateUi(
                "Le destinataire doit r\u00E9pondre depuis son onglet Demandes.",
              )}
            </p>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => void act("cancel")}
            >
              {translateUi("Annuler la demande")}
            </button>
          </div>
        ))}
      {declining && item.status === "pending" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act("decline");
          }}
        >
          <label className="request-objective">
            {translateUi("Pourquoi refuses-tu cette demande ?")}
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </label>
          <p className="small-text">
            {translateUi(
              "Ce motif sera transmis \u00E0 la personne dans Mentora et par email.",
            )}
          </p>
          <div className="pair-actions">
            <button
              className="btn"
              disabled={busy || reason.trim().length < 10}
            >
              {translateUi("Confirmer le refus")}
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setDeclining(false)}
              disabled={busy}
            >
              {translateUi("Annuler")}
            </button>
          </div>
        </form>
      )}
      {!requestsOnly &&
        item.status === "active" &&
        (confirm ? (
          <div>
            <p>
              {translateUi(
                "Confirmer que l\u2019accompagnement est termin\u00E9 ? Cette action ouvre la notation au d\u00E9butant et ne peut pas \u00EAtre annul\u00E9e.",
              )}
            </p>
            <div className="pair-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => void act("complete")}
              >
                {translateUi("Confirmer la fin")}
              </button>
              <button className="text-btn" onClick={() => setConfirm(false)}>
                {translateUi("Continuer l\u2019accompagnement")}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn secondary" onClick={() => setConfirm(true)}>
            {translateUi("Terminer l\u2019accompagnement")}
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
            <h4>
              {translateUi(
                "Comment s\u2019est pass\u00E9 ton accompagnement ?",
              )}
            </h4>
            <div
              className="stars-input"
              role="group"
              aria-label={translateUi("Note de l’accompagnement")}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-label={translateUi(`${n} étoile${n > 1 ? "s" : ""}`)}
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
              {translateUi(
                "Ta note contribuera \u00E0 la moyenne publique du parrain. Un seul avis par bin\u00F4me, non modifiable apr\u00E8s envoi.",
              )}
            </p>
            <button className="btn" disabled={!score || busy}>
              {busy ? "Enregistrement…" : "Publier ma note"}
            </button>
          </form>
        ) : (
          <p>
            {translateUi("Le d\u00E9butant peut maintenant laisser sa note.")}
          </p>
        ))}
      {translateUi(
        error && (
          <p className="error" role="alert">
            {translateUi(error)}
          </p>
        ),
      )}
    </article>
  );
}
