"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { specialties, type PublicProfile } from "@/lib/profile";
import { ShieldCheck } from "lucide-react";
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Une erreur est survenue.");
  return data;
}
type Dossier = {
  sales: number;
  specialties: string[];
  experience: string;
  example: string;
  evidence: string[];
  consent: boolean;
};
type Review = {
  user_id: string;
  name: string;
  revision: string;
  status: string;
  dossier: Dossier;
  feedback: string;
  verified_sales: number | null;
  verified_specialties: string | null;
  submitted_at: string;
  profile: { experience: number };
};
export function VerificationBadge({ profile }: { profile: PublicProfile }) {
  if (profile.role !== "mentor") return null;
  if (!profile.verification)
    return (
      <p className="verification-unchecked">
        Expérience déclarée · non vérifiée
      </p>
    );
  const v = profile.verification;
  return (
    <div className="verification-badge">
      <span>
        <ShieldCheck size={17} /> Dossier vérifié
      </span>
      <small>
        {v.sales} ventes documentées · {v.specialties.join(", ")}
        <br />
        Examiné le {new Date(v.reviewedAt).toLocaleDateString("fr-FR")}. Ce
        badge ne garantit ni les résultats ni l’authenticité d’un article.
      </small>
    </div>
  );
}
export function VerificationForm({
  onChange,
}: {
  onChange: () => Promise<void>;
}) {
  const [moderationOpen, setModerationOpen] = useState(false);
  const [record, setRecord] = useState<Review | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [sales, setSales] = useState(""),
    [skills, setSkills] = useState<string[]>([]),
    [experience, setExperience] = useState(""),
    [example, setExample] = useState(""),
    [evidence, setEvidence] = useState(""),
    [consent, setConsent] = useState(false);
  const load = useCallback(async () => {
    try {
      const d = await call("/api/verification");
      setRecord(d.verification);
      setModerationOpen(d.moderationOpen);
      if (d.verification) {
        const v = d.verification.dossier;
        setSales(String(v.sales));
        setSkills(v.specialties);
        setExperience(v.experience);
        setExample(v.example);
        setEvidence(v.evidence.join("\n"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await call("/api/verification", "POST", {
        sales: Number(sales),
        specialties: skills,
        experience,
        example,
        evidence: evidence
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        consent,
      });
      await load();
      await onChange();
      setMessage(
        "Dossier envoyé. Aucun badge n’est attribué avant l’examen par la modération.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (
      !window.confirm(
        "Retirer le dossier et ses justificatifs ? Le badge éventuel sera supprimé.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await call("/api/verification", "DELETE");
      setRecord(null);
      setSales("");
      setSkills([]);
      setExperience("");
      setExample("");
      setEvidence("");
      setConsent(false);
      await onChange();
      setMessage("Ton dossier et ton badge ont été retirés.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel">
      <span className="eyebrow">AU-DELÀ DE L’ANCIENNETÉ</span>
      <h2>Faire vérifier mon expérience</h2>
      <p>
        Au moins 6 mois de pratique, 20 ventes documentées, une spécialité
        démontrée et un cas pratique examiné : le badge est attribué après
        validation humaine. L’ancienneté seule ne suffit pas.
      </p>
      <p>
        Ton dossier et tes liens restent accessibles uniquement à toi et aux
        modérateurs autorisés. Seuls le nombre de ventes documentées, les
        spécialités validées et la date d’examen sont publics. Tu peux retirer
        le dossier à tout moment.
      </p>
      {loading ? (
        <p>Chargement du dossier…</p>
      ) : !moderationOpen ? (
        <p className="info-box">
          L’examen des dossiers ouvrira dès que l’équipe de modération sera
          configurée. Aucun justificatif n’est collecté pour le moment.
        </p>
      ) : (
        <>
          <p className="badge">
            {record
              ? {
                  pending: "En attente d’examen",
                  approved: "Dossier vérifié",
                  changes: "Compléments demandés",
                }[record.status] || record.status
              : "Pas encore de dossier"}
          </p>
          {record?.feedback && (
            <p className="info-box">
              Retour de la modération : {record.feedback}
            </p>
          )}
          <form onSubmit={submit} className="verification-form">
            <label>
              Nombre total de ventes réalisées
              <input
                type="number"
                min="1"
                max="1000000"
                required
                value={sales}
                onChange={(e) => setSales(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Spécialités à faire examiner</legend>
              {specialties.map((s) => (
                <label className="verification-check" key={s}>
                  <input
                    type="checkbox"
                    checked={skills.includes(s)}
                    onChange={(e) =>
                      setSkills(
                        e.target.checked
                          ? [...skills, s]
                          : skills.filter((x) => x !== s),
                      )
                    }
                  />
                  {s}
                </label>
              ))}
            </fieldset>
            <label>
              Ton expérience concrète
              <textarea
                required
                minLength={50}
                maxLength={2000}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Plateformes, période d’activité, types de pièces, volumes, méthode de sourcing…"
              />
            </label>
            <label>
              Un cas pratique : comment aiderais-tu un débutant dont une pièce
              ne se vend pas ?
              <textarea
                required
                minLength={80}
                maxLength={2000}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="Explique ton diagnostic et les conseils que tu donnerais, sans promettre une vente."
              />
            </label>
            <label>
              Liens HTTPS vers tes justificatifs (1 à 5, un par ligne)
              <textarea
                required
                maxLength={5000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Historique de ventes, captures anonymisées, exemples de pièces…"
              />
            </label>
            <p className="small-text">
              Utilise des liens en lecture seule. Masque les noms, adresses et
              coordonnées des acheteurs. N’envoie ni pièce d’identité, ni mot de
              passe, ni coordonnées bancaires. Le partage sur le service qui
              héberge les fichiers reste sous ton contrôle.
            </p>
            <label className="verification-check">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              J’autorise l’examen confidentiel de ces éléments et la publication
              du résumé validé.
            </label>
            {record?.status === "approved" && (
              <p>
                Renvoyer le dossier retire le badge jusqu’au prochain examen.
              </p>
            )}
            <button className="btn" disabled={busy || !skills.length}>
              {busy
                ? "Enregistrement…"
                : record
                  ? "Renvoyer mon dossier"
                  : "Demander la vérification"}
            </button>
            {record && (
              <button
                className="text-btn"
                type="button"
                disabled={busy}
                onClick={() => void withdraw()}
              >
                Retirer mon dossier et mon badge
              </button>
            )}
          </form>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function Moderation() {
  const [items, setItems] = useState<Review[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setItems((await call("/api/moderation")).dossiers);
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
    <section className="wrap section">
      <h1>Vérification des parrains</h1>
      <p>
        Espace confidentiel. Vérifie le volume des ventes, la cohérence de
        l’activité et des spécialités, puis la pertinence du cas pratique. Ne
        valide pas un dossier sur la seule ancienneté. Les liens sont fournis
        par les membres : n’y saisis aucun identifiant.
      </p>
      <button className="text-btn" onClick={() => void load()}>
        Actualiser les dossiers
      </button>
      {loading ? (
        <p>Chargement…</p>
      ) : items.length ? (
        items.map((item) => (
          <ReviewCard
            key={item.user_id + item.revision}
            item={item}
            reload={load}
          />
        ))
      ) : (
        <p>Aucun dossier à examiner.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function ReviewCard({
  item,
  reload,
}: {
  item: Review;
  reload: () => Promise<void>;
}) {
  const [sales, setSales] = useState(String(item.verified_sales || "")),
    [skills, setSkills] = useState<string[]>(
      item.verified_specialties ? JSON.parse(item.verified_specialties) : [],
    ),
    [feedback, setFeedback] = useState(""),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(action: string) {
    setBusy(true);
    setError("");
    try {
      await call("/api/moderation", "PATCH", {
        userId: item.user_id,
        revision: item.revision,
        action,
        sales: Number(sales),
        specialties: skills,
        feedback,
        checked,
      });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="verification-panel">
      <h2>{item.name}</h2>
      <p>
        {item.status === "approved"
          ? "Vérifié"
          : item.status === "changes"
            ? "Compléments demandés"
            : "À examiner"}{" "}
        · {item.profile.experience} mois déclarés · {item.dossier.sales} ventes
        déclarées
      </p>
      <p>
        <strong>Expérience :</strong> {item.dossier.experience}
      </p>
      <p>
        <strong>Cas pratique :</strong> {item.dossier.example}
      </p>
      <ul>
        {item.dossier.evidence.map((url, i) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Justificatif {i + 1} · {new URL(url).hostname}
            </a>
          </li>
        ))}
      </ul>
      {item.feedback && <p>Dernier retour : {item.feedback}</p>}
      <div className="verification-form">
        <label>
          Ventes effectivement documentées
          <input
            type="number"
            min="0"
            max={item.dossier.sales}
            value={sales}
            onChange={(e) => setSales(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Spécialités effectivement examinées</legend>
          {item.dossier.specialties.map((s) => (
            <label className="verification-check" key={s}>
              <input
                type="checkbox"
                checked={skills.includes(s)}
                onChange={(e) =>
                  setSkills(
                    e.target.checked
                      ? [...skills, s]
                      : skills.filter((x) => x !== s),
                  )
                }
              />
              {s}
            </label>
          ))}
        </fieldset>
        <label>
          Retour privé au parrain (obligatoire)
          <textarea
            minLength={15}
            maxLength={1500}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
        <label className="verification-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          J’ai examiné les justificatifs et le cas pratique. Mon avis ne se
          fonde pas uniquement sur l’ancienneté.
        </label>
        <div className="hero-buttons">
          <button
            className="btn"
            disabled={busy || !checked}
            onClick={() => void decide("approve")}
          >
            Valider le dossier
          </button>
          <button
            className="btn secondary"
            disabled={busy || !checked}
            onClick={() => void decide("changes")}
          >
            Demander des compléments / retirer le badge
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
