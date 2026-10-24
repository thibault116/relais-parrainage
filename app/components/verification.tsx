"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { PublicProfile } from "@/lib/profile";
import {
  experienceOptions,
  platformOptions,
  salesOptions,
  helpOptions,
  proofOptions,
  type Dossier,
} from "@/lib/verification-form";
import { ShieldCheck, Upload } from "lucide-react";
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Une erreur est survenue.");
  return d;
}
type FileInfo = { id: string; name: string; size: number; mime: string };
type Legacy = {
  version?: 1;
  sales: number;
  specialties: string[];
  experience: string;
  example: string;
  evidence: string[];
};
type Review = {
  user_id: string;
  name: string;
  revision: string;
  status: string;
  dossier: Dossier | Legacy;
  feedback: string;
  verified_sales: number | null;
  verified_specialties: string | null;
  submitted_at: string;
};
function isNew(d: Dossier | Legacy): d is Dossier {
  return d.version === 2;
}
const empty = (): Dossier => ({
  version: 2,
  experience: "" as Dossier["experience"],
  platforms: [],
  salesRange: "" as Dossier["salesRange"],
  helpAreas: [],
  otherHelp: "",
  motivation: "",
  proofs: [],
  consent: true,
});
export function VerificationBadge({ profile }: { profile: PublicProfile }) {
  if (profile.role !== "mentor") return null;
  if (!profile.verification)
    return (
      <p className="verification-unchecked">
        Parrain non vérifié · expérience déclarée
      </p>
    );
  const v = profile.verification;
  return (
    <div className="verification-badge">
      <span>
        <ShieldCheck size={17} /> Parrain vérifié
      </span>
      <small>
        {v.sales !== null && <>{v.sales} ventes documentées · </>}
        {v.specialties.join(", ")}
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
  const [record, setRecord] = useState<Review | null>(null),
    [draft, setDraft] = useState<Dossier>(empty),
    [files, setFiles] = useState<FileInfo[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [consent, setConsent] = useState(false);
  const load = useCallback(async () => {
    try {
      const [d, f] = await Promise.all([
        call("/api/verification"),
        call("/api/verification-files"),
      ]);
      setRecord(d.verification);
      setOpen(d.moderationOpen);
      setFiles(f.files);
      if (d.verification && isNew(d.verification.dossier))
        setDraft(d.verification.dossier);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function toggle<K extends "platforms" | "helpAreas">(
    key: K,
    value: Dossier[K][number],
  ) {
    setDraft((d) => ({
      ...d,
      [key]: (d[key] as string[]).includes(value)
        ? d[key].filter((v) => v !== value)
        : [...d[key], value],
    }));
  }
  function updateProof(
    type: Dossier["proofs"][number]["type"],
    change: Partial<Dossier["proofs"][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      proofs: d.proofs.map((p) => (p.type === type ? { ...p, ...change } : p)),
    }));
  }
  async function upload(
    type: Dossier["proofs"][number]["type"],
    list: FileList | null,
  ) {
    if (!list) return;
    setUploading(true);
    setError("");
    for (const file of Array.from(list)) {
      try {
        if (file.size > 4 * 1024 * 1024)
          throw Error(`${file.name} : limite de 4 Mo par fichier.`);
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/verification-files", {
          method: "POST",
          body: form,
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Import impossible.");
        setFiles((f) => [...f, d.file]);
        setDraft((old) => ({
          ...old,
          proofs: old.proofs.map((p) =>
            p.type === type ? { ...p, files: [...p.files, d.file.id] } : p,
          ),
        }));
      } catch (e) {
        setError((e as Error).message);
        break;
      }
    }
    setUploading(false);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await call("/api/verification", "POST", {
        ...draft,
        proofs: draft.proofs.map((p) => ({
          ...p,
          links: p.links.map((v) => v.trim()).filter(Boolean),
        })),
        consent,
      });
      await load();
      await onChange();
      setMessage(
        "Ton dossier a été envoyé. L’équipe examinera tes réponses et tes justificatifs de façon confidentielle.",
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
        "Retirer ton dossier, tous les fichiers importés et ton badge éventuel ?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await call("/api/verification", "DELETE");
      setRecord(null);
      setFiles([]);
      setDraft(empty());
      setConsent(false);
      await onChange();
      setMessage("Dossier et fichiers retirés.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel">
      <span className="eyebrow">FAISONS CONNAISSANCE</span>
      <h2>Vérifier mon profil parrain</h2>
      <p>
        Présente ton parcours et les domaines dans lesquels tu peux aider. Tes
        réponses et tes justificatifs sont réservés à toi et à l’administration.
        Le badge est attribué après un examen humain.
      </p>
      {loading ? (
        <p>Chargement…</p>
      ) : !open ? (
        <p>
          L’examen des dossiers sera disponible dès que l’administration sera
          configurée.
        </p>
      ) : (
        <>
          {record && (
            <p className="badge">
              {record.status === "approved"
                ? "Dossier vérifié"
                : record.status === "changes"
                  ? "Compléments demandés"
                  : "En attente d’examen"}
            </p>
          )}
          {record?.feedback && (
            <p className="info-box">
              Retour de l’administration : {record.feedback}
            </p>
          )}
          {record && !isNew(record.dossier) && (
            <p>
              L’ancien dossier reste conservé pour l’administration. Remplis ce
              nouveau questionnaire pour le remplacer.
            </p>
          )}
          <form className="verification-form" onSubmit={submit}>
            <fieldset
              disabled={busy || uploading}
              className="proof-questionnaire"
            >
              <fieldset>
                <legend>
                  1. Depuis combien de temps fais-tu de la revente ?
                </legend>
                <p className="small-text">Une seule réponse.</p>
                {experienceOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="radio"
                      name="verification-experience"
                      required
                      checked={draft.experience === v}
                      onChange={() =>
                        setDraft((d) => ({ ...d, experience: v }))
                      }
                    />
                    {v}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>2. Sur quelles plateformes vends-tu ?</legend>
                <p className="small-text">Plusieurs réponses possibles.</p>
                {platformOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="checkbox"
                      checked={draft.platforms.includes(v)}
                      onChange={() => toggle("platforms", v)}
                    />
                    {v}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>3. Combien de ventes as-tu réalisées environ ?</legend>
                <p className="small-text">Une seule réponse.</p>
                {salesOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="radio"
                      name="verification-sales"
                      required
                      checked={draft.salesRange === v}
                      onChange={() =>
                        setDraft((d) => ({ ...d, salesRange: v }))
                      }
                    />
                    {v}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  4. Dans quels domaines peux-tu aider un débutant ?
                </legend>
                <p className="small-text">Plusieurs réponses possibles.</p>
                {helpOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="checkbox"
                      checked={draft.helpAreas.includes(v)}
                      onChange={() => toggle("helpAreas", v)}
                    />
                    {v}
                  </label>
                ))}
                {draft.helpAreas.includes("Autre") && (
                  <label>
                    Précise ton autre domaine
                    <input
                      required
                      value={draft.otherHelp}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, otherHelp: e.target.value }))
                      }
                    />
                  </label>
                )}
              </fieldset>
              <label>
                5. Pourquoi souhaites-tu devenir parrain ?
                <textarea
                  required
                  value={draft.motivation}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, motivation: e.target.value }))
                  }
                  placeholder="Par exemple : j’aurais aimé être accompagné à mes débuts et j’ai envie de partager ce que j’ai appris."
                />
              </label>
              <fieldset>
                <legend>6. Quelles preuves peux-tu fournir ?</legend>
                <p>
                  Sélectionne au moins deux justificatifs différents si
                  possible. Une seule catégorie reste acceptée si tu n’en as pas
                  d’autre.
                </p>
                {proofOptions.map((type) => {
                  const proof = draft.proofs.find((p) => p.type === type);
                  return (
                    <div className="proof-category" key={type}>
                      <label className="verification-check">
                        <input
                          type="checkbox"
                          checked={!!proof}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              proofs: e.target.checked
                                ? [...d.proofs, { type, links: [], files: [] }]
                                : d.proofs.filter((p) => p.type !== type),
                            }))
                          }
                        />
                        {type}
                      </label>
                      {proof && (
                        <div className="proof-inputs">
                          <label>
                            Lien(s) vers ce justificatif — un par ligne
                            <textarea
                              value={proof.links.join("\n")}
                              onChange={(e) =>
                                updateProof(type, {
                                  links: e.target.value.split("\n"),
                                })
                              }
                              placeholder="https://…"
                            />
                          </label>
                          <label className="proof-upload">
                            <Upload size={18} /> Importer des photos ou des
                            fichiers
                            <input
                              type="file"
                              multiple
                              accept="image/*,.pdf,application/pdf"
                              onChange={(e) => {
                                void upload(type, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="small-text">
                            Photothèque ou fichiers de ton appareil. JPEG, PNG,
                            WebP, GIF, HEIC ou PDF · 4 Mo par fichier · 12
                            fichiers maximum.
                          </p>
                          {files.length > 0 && (
                            <fieldset>
                              <legend>
                                Fichiers importés à joindre à cette preuve
                              </legend>
                              {files.map((f) => (
                                <label
                                  className="verification-check"
                                  key={f.id}
                                >
                                  <input
                                    type="checkbox"
                                    checked={proof.files.includes(f.id)}
                                    onChange={(e) =>
                                      updateProof(type, {
                                        files: e.target.checked
                                          ? [...proof.files, f.id]
                                          : proof.files.filter(
                                              (id) => id !== f.id,
                                            ),
                                      })
                                    }
                                  />
                                  <span>
                                    {f.name} · {Math.ceil(f.size / 1024)} Ko{" "}
                                    <a
                                      href={`/api/verification-files?id=${f.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Télécharger
                                    </a>
                                  </span>
                                </label>
                              ))}
                            </fieldset>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <p className="small-text">
                Masque les coordonnées de tes acheteurs avant l’envoi. Tes
                fichiers ne sont jamais affichés dans l’annuaire. Pour un lien
                externe, tu gardes le contrôle de son partage.
              </p>
              <label className="verification-check">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                J’autorise l’administration à examiner ces éléments
                confidentiellement et à publier les domaines validés avec mon
                badge.
              </label>
              {record?.status === "approved" && (
                <p>
                  Renvoyer le dossier retire le badge jusqu’au prochain examen.
                </p>
              )}
              <button className="btn" type="submit">
                {busy
                  ? "Envoi…"
                  : uploading
                    ? "Import en cours…"
                    : record
                      ? "Renvoyer mon dossier"
                      : "Envoyer mon dossier"}
              </button>
            </fieldset>
          </form>
          {(record || files.length > 0) && (
            <button
              type="button"
              className="text-btn"
              disabled={busy || uploading}
              onClick={() => void withdraw()}
            >
              Retirer mon dossier et tous mes fichiers
            </button>
          )}
          {files.length > 0 && (
            <details className="proof-cleanup">
              <summary>Gérer mes fichiers importés</summary>
              {files.map((f) => (
                <div key={f.id}>
                  {f.name}{" "}
                  <button
                    type="button"
                    className="text-btn"
                    disabled={busy || uploading}
                    onClick={async () => {
                      setError("");
                      try {
                        await call("/api/verification-files", "DELETE", {
                          id: f.id,
                        });
                        setFiles((old) => old.filter((x) => x.id !== f.id));
                        setDraft((d) => ({
                          ...d,
                          proofs: d.proofs.map((p) => ({
                            ...p,
                            files: p.files.filter((id) => id !== f.id),
                          })),
                        }));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </details>
          )}
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
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
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
        Examine le parcours, les plateformes, les domaines d’aide et la
        motivation en regard des justificatifs. Deux types de preuves sont
        conseillés, sans être obligatoires. Les liens externes viennent des
        membres : n’y saisis aucun identifiant.
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
  const d = item.dossier,
    newD = isNew(d) ? d : null,
    old = !isNew(d) ? d : null,
    areas = newD
      ? newD.helpAreas.map((s) => (s === "Autre" ? newD.otherHelp : s))
      : old?.specialties || [];
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
        sales: newD ? 0 : Number(sales),
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
            : "À examiner"}
      </p>
      {newD ? (
        <>
          <dl className="review-answers">
            <dt>Ancienneté</dt>
            <dd>{newD.experience}</dd>
            <dt>Plateformes</dt>
            <dd>{newD.platforms.join(" · ")}</dd>
            <dt>Ventes estimées</dt>
            <dd>{newD.salesRange}</dd>
            <dt>Domaines d’aide</dt>
            <dd>{areas.join(" · ")}</dd>
            <dt>Motivation</dt>
            <dd className="free-answer">{newD.motivation}</dd>
          </dl>
          {newD.proofs.map((p) => (
            <section className="proof-category" key={p.type}>
              <h3>{p.type}</h3>
              <ul>
                {p.links.map((url, i) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Lien {i + 1} · {new URL(url).hostname}
                    </a>
                  </li>
                ))}
                {p.files.map((id, i) => (
                  <li key={id}>
                    <a
                      href={`/api/verification-files?id=${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Télécharger le justificatif {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        old && (
          <>
            <p>
              Ancienne version du questionnaire · {old.sales} ventes déclarées
            </p>
            <p>{old.experience}</p>
            <p>{old.example}</p>
            <ul>
              {old.evidence.map((url, i) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Justificatif {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )
      )}
      {item.feedback && <p>Dernier retour : {item.feedback}</p>}
      <div className="verification-form">
        {old && (
          <label>
            Ventes effectivement documentées
            <input
              type="number"
              min="0"
              max={old.sales}
              value={sales}
              onChange={(e) => setSales(e.target.value)}
            />
          </label>
        )}
        <fieldset>
          <legend>Domaines examinés à publier avec le badge</legend>
          {areas.map((s) => (
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
          Retour privé au parrain
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
          J’ai examiné les réponses et les justificatifs. Mon avis ne repose pas
          uniquement sur l’ancienneté déclarée.
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
