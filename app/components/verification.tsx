"use client";
import { t as translateUi, locale } from "@/app/components/language";
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
  try {
    const r = await fetch(path, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Une erreur est survenue.");
    return d;
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw Error(
        "Le serveur met trop de temps à répondre. Actualise les dossiers pour vérifier si la décision a été enregistrée avant de réessayer.",
      );
    throw error;
  }
}
type FileInfo = {
  id: string;
  name: string;
  size: number;
  mime: string;
};
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
        {translateUi(
          "Parrain non v\u00E9rifi\u00E9 \u00B7 exp\u00E9rience d\u00E9clar\u00E9e",
        )}
      </p>
    );
  const v = profile.verification;
  return (
    <div className="verification-badge">
      <span>
        <ShieldCheck size={17} />
        {translateUi(" Parrain v\u00E9rifi\u00E9")}
      </span>
      <small>
        {v.sales !== null && (
          <>
            {v.sales}
            {translateUi(" ventes document\u00E9es \u00B7 ")}
          </>
        )}
        {translateUi(v.specialties.join(", "))}
        <br />
        {translateUi("Examin\u00E9 le ")}
        {translateUi(new Date(v.reviewedAt).toLocaleDateString(locale()))}
        {translateUi(
          ". Ce badge ne garantit ni les r\u00E9sultats ni l\u2019authenticit\u00E9 d\u2019un article.",
        )}
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
      <span className="eyebrow">{translateUi("FAISONS CONNAISSANCE")}</span>
      <h2>{translateUi("V\u00E9rifier mon profil parrain")}</h2>
      <p>
        {translateUi(
          "Pr\u00E9sente ton parcours et les domaines dans lesquels tu peux aider. Tes r\u00E9ponses et tes justificatifs sont r\u00E9serv\u00E9s \u00E0 toi et \u00E0 l\u2019administration. Le badge est attribu\u00E9 apr\u00E8s un examen humain.",
        )}
      </p>
      {loading ? (
        <p>{translateUi("Chargement\u2026")}</p>
      ) : !open ? (
        <p>
          {translateUi(
            "L\u2019examen des dossiers sera disponible d\u00E8s que l\u2019administration sera configur\u00E9e.",
          )}
        </p>
      ) : (
        <>
          {record && (
            <p className="badge">
              {translateUi(
                record.status === "approved"
                  ? "Dossier vérifié"
                  : record.status === "changes"
                    ? "Compléments demandés"
                    : "En attente d’examen",
              )}
            </p>
          )}
          {record?.feedback && (
            <p className="info-box">
              {translateUi("Retour de l\u2019administration : ")}
              {record.feedback}
            </p>
          )}
          {record && !isNew(record.dossier) && (
            <p>
              {translateUi(
                "L\u2019ancien dossier reste conserv\u00E9 pour l\u2019administration. Remplis ce nouveau questionnaire pour le remplacer.",
              )}
            </p>
          )}
          <form className="verification-form" onSubmit={submit}>
            <fieldset
              disabled={busy || uploading}
              className="proof-questionnaire"
            >
              <fieldset>
                <legend>
                  {translateUi(
                    "1. Depuis combien de temps fais-tu de la revente ?",
                  )}
                </legend>
                <p className="small-text">
                  {translateUi("Une seule r\u00E9ponse.")}
                </p>
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
                    {translateUi(v)}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  {translateUi("2. Sur quelles plateformes vends-tu ?")}
                </legend>
                <p className="small-text">
                  {translateUi("Plusieurs r\u00E9ponses possibles.")}
                </p>
                {platformOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="checkbox"
                      checked={draft.platforms.includes(v)}
                      onChange={() => toggle("platforms", v)}
                    />
                    {translateUi(v)}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  {translateUi(
                    "3. Combien de ventes as-tu r\u00E9alis\u00E9es environ ?",
                  )}
                </legend>
                <p className="small-text">
                  {translateUi("Une seule r\u00E9ponse.")}
                </p>
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
                    {translateUi(v)}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  {translateUi(
                    "4. Dans quels domaines peux-tu aider un d\u00E9butant ?",
                  )}
                </legend>
                <p className="small-text">
                  {translateUi("Plusieurs r\u00E9ponses possibles.")}
                </p>
                {helpOptions.map((v) => (
                  <label className="verification-check" key={v}>
                    <input
                      type="checkbox"
                      checked={draft.helpAreas.includes(v)}
                      onChange={() => toggle("helpAreas", v)}
                    />
                    {translateUi(v)}
                  </label>
                ))}
                {draft.helpAreas.includes("Autre") && (
                  <label>
                    {translateUi("Pr\u00E9cise ton autre domaine")}
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
                {translateUi("5. Pourquoi souhaites-tu devenir parrain ?")}
                <textarea
                  required
                  value={draft.motivation}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, motivation: e.target.value }))
                  }
                  placeholder={translateUi(
                    "Par exemple : j’aurais aimé être accompagné à mes débuts et j’ai envie de partager ce que j’ai appris.",
                  )}
                />
              </label>
              <fieldset>
                <legend>
                  {translateUi("6. Quelles preuves peux-tu fournir ?")}
                </legend>
                <p>
                  {translateUi(
                    "S\u00E9lectionne au moins deux justificatifs diff\u00E9rents si possible. Une seule cat\u00E9gorie reste accept\u00E9e si tu n\u2019en as pas d\u2019autre.",
                  )}
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
                        {translateUi(type)}
                      </label>
                      {proof && (
                        <div className="proof-inputs">
                          <label>
                            {translateUi(
                              "Lien(s) vers ce justificatif \u2014 un par ligne",
                            )}
                            <textarea
                              value={proof.links.join("\n")}
                              onChange={(e) =>
                                updateProof(type, {
                                  links: e.target.value.split("\n"),
                                })
                              }
                              placeholder={translateUi("https://…")}
                            />
                          </label>
                          <label className="proof-upload">
                            <Upload size={18} />
                            {translateUi(
                              " Importer des photos ou des fichiers",
                            )}
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
                            {translateUi(
                              "Phototh\u00E8que ou fichiers de ton appareil. JPEG, PNG, WebP, GIF, HEIC ou PDF \u00B7 4 Mo par fichier \u00B7 12 fichiers maximum.",
                            )}
                          </p>
                          {files.length > 0 && (
                            <fieldset>
                              <legend>
                                {translateUi(
                                  "Fichiers import\u00E9s \u00E0 joindre \u00E0 cette preuve",
                                )}
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
                                    {f.name} · {Math.ceil(f.size / 1024)}
                                    {translateUi(" Ko")}{" "}
                                    <a
                                      href={`/api/verification-files?id=${f.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {translateUi("T\u00E9l\u00E9charger")}
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
                {translateUi(
                  "Masque les coordonn\u00E9es de tes acheteurs avant l\u2019envoi. Tes fichiers ne sont jamais affich\u00E9s dans l\u2019annuaire. Pour un lien externe, tu gardes le contr\u00F4le de son partage.",
                )}
              </p>
              <label className="verification-check">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                {translateUi(
                  "J\u2019autorise l\u2019administration \u00E0 examiner ces \u00E9l\u00E9ments confidentiellement et \u00E0 publier les domaines valid\u00E9s avec mon badge.",
                )}
              </label>
              {record?.status === "approved" && (
                <p>
                  {translateUi(
                    "Renvoyer le dossier retire le badge jusqu\u2019au prochain examen.",
                  )}
                </p>
              )}
              <button className="btn" type="submit">
                {translateUi(
                  busy
                    ? "Envoi…"
                    : uploading
                      ? "Import en cours…"
                      : record
                        ? "Renvoyer mon dossier"
                        : "Envoyer mon dossier",
                )}
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
              {translateUi("Retirer mon dossier et tous mes fichiers")}
            </button>
          )}
          {files.length > 0 && (
            <details className="proof-cleanup">
              <summary>
                {translateUi("G\u00E9rer mes fichiers import\u00E9s")}
              </summary>
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
                    {translateUi("Supprimer")}
                  </button>
                </div>
              ))}
            </details>
          )}
        </>
      )}
      {translateUi(
        error && (
          <p className="error" role="alert">
            {translateUi(error)}
          </p>
        ),
      )}
      {translateUi(message && <p role="status">{translateUi(message)}</p>)}
    </section>
  );
}
export function Moderation() {
  const [items, setItems] = useState<Review[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
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
      <h1>{translateUi("V\u00E9rification des parrains")}</h1>
      <p>
        {translateUi(
          "Examine le parcours, les plateformes, les domaines d\u2019aide et la motivation en regard des justificatifs. Deux types de preuves sont conseill\u00E9s, sans \u00EAtre obligatoires. Les liens externes viennent des membres : n\u2019y saisis aucun identifiant.",
        )}
      </p>
      <button className="text-btn" onClick={() => void load()}>
        {translateUi("Actualiser les dossiers")}
      </button>
      {translateUi(
        message && (
          <p className="info-box" role="status">
            {translateUi(message)}
          </p>
        ),
      )}
      {loading ? (
        <p>{translateUi("Chargement\u2026")}</p>
      ) : items.length ? (
        items.map((item) => (
          <ReviewCard
            key={item.user_id + item.revision}
            item={item}
            onReviewed={(verification) => {
              setItems((current) =>
                current.map((entry) =>
                  entry.user_id === item.user_id
                    ? { ...entry, ...verification }
                    : entry,
                ),
              );
              setMessage(
                verification.status === "approved"
                  ? `${item.name} : dossier validé, le badge vérifié est actif.`
                  : `${item.name} : demande de compléments enregistrée.`,
              );
            }}
          />
        ))
      ) : (
        <p>{translateUi("Aucun dossier \u00E0 examiner.")}</p>
      )}
      {translateUi(
        error && (
          <p className="error" role="alert">
            {translateUi(error)}
          </p>
        ),
      )}
    </section>
  );
}
function ReviewCard({
  item,
  onReviewed,
}: {
  item: Review;
  onReviewed: (verification: Partial<Review>) => void;
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
    if (action === "approve" && !skills.length) {
      setError(
        "Sélectionne au moins un domaine examiné pour attribuer le badge.",
      );
      return;
    }
    if (action === "changes" && feedback.trim().length < 15) {
      setError("Explique les compléments attendus en au moins 15 caractères.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await call("/api/moderation", "PATCH", {
        userId: item.user_id,
        revision: item.revision,
        action,
        sales: newD ? 0 : Number(sales),
        specialties: skills,
        feedback,
        checked,
      });
      onReviewed(result.verification);
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
        {translateUi(
          item.status === "approved"
            ? "Vérifié"
            : item.status === "changes"
              ? "Compléments demandés"
              : "À examiner",
        )}
      </p>
      {newD ? (
        <>
          <dl className="review-answers">
            <dt>{translateUi("Anciennet\u00E9")}</dt>
            <dd>{translateUi(newD.experience)}</dd>
            <dt>{translateUi("Plateformes")}</dt>
            <dd>{translateUi(newD.platforms.join(" · "))}</dd>
            <dt>{translateUi("Ventes estim\u00E9es")}</dt>
            <dd>{translateUi(newD.salesRange)}</dd>
            <dt>{translateUi("Domaines d\u2019aide")}</dt>
            <dd>{translateUi(areas.join(" · "))}</dd>
            <dt>{translateUi("Motivation")}</dt>
            <dd className="free-answer">{newD.motivation}</dd>
          </dl>
          {newD.proofs.map((p) => (
            <section className="proof-category" key={p.type}>
              <h3>{translateUi(p.type)}</h3>
              <ul>
                {p.links.map((url, i) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {translateUi("Lien ")}
                      {i + 1} · {translateUi(new URL(url).hostname)}
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
                      {translateUi("T\u00E9l\u00E9charger le justificatif ")}
                      {i + 1}
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
              {translateUi("Ancienne version du questionnaire \u00B7 ")}
              {old.sales}
              {translateUi(" ventes d\u00E9clar\u00E9es")}
            </p>
            <p>{translateUi(old.experience)}</p>
            <p>{translateUi(old.example)}</p>
            <ul>
              {old.evidence.map((url, i) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {translateUi("Justificatif ")}
                    {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )
      )}
      {item.feedback && (
        <p>
          {translateUi("Dernier retour : ")}
          {item.feedback}
        </p>
      )}
      <div className="verification-form">
        {old && (
          <label>
            {translateUi("Ventes effectivement document\u00E9es")}
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
          <legend>
            {translateUi("Domaines examin\u00E9s \u00E0 publier avec le badge")}
          </legend>
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
              {translateUi(s)}
            </label>
          ))}
        </fieldset>
        <label>
          {translateUi(
            "Retour priv\u00E9 au parrain (facultatif pour une validation)",
          )}
          <textarea
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
          {translateUi(
            "J\u2019ai examin\u00E9 les r\u00E9ponses et les justificatifs. Mon avis ne repose pas uniquement sur l\u2019anciennet\u00E9 d\u00E9clar\u00E9e.",
          )}
        </label>
        {item.status === "approved" && (
          <p className="info-box" role="status">
            {translateUi(
              "Dossier valid\u00E9 : le badge \u00AB Parrain v\u00E9rifi\u00E9 \u00BB est actif sur le profil.",
            )}
          </p>
        )}
        <div className="hero-buttons">
          <button
            className="btn"
            disabled={busy || !checked}
            onClick={() => void decide("approve")}
          >
            {translateUi(busy ? "Enregistrement…" : "Valider le dossier")}
          </button>
          <button
            className="btn secondary"
            disabled={busy || !checked}
            onClick={() => void decide("changes")}
          >
            {translateUi("Demander des compl\u00E9ments / retirer le badge")}
          </button>
        </div>
      </div>
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
