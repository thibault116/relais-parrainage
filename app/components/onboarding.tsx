"use client";
import { useState, type FormEvent } from "react";
import {
  initialProfile,
  specialties,
  times,
  type Profile,
  type ProfileInput,
} from "@/lib/profile";
import {
  categories,
  supportTypes,
  completedMonths,
  monthLabel,
  experienceMonths,
  onboardingSchema,
  type Onboarding,
} from "@/lib/onboarding-schema";
import { t } from "./language";
function fresh(role: "mentor" | "beginner"): Onboarding {
  const common = {
    version: 1 as const,
    categories: [] as Onboarding["categories"],
    categoryOther: "",
  };
  return role === "mentor"
    ? {
        ...common,
        role,
        started: "",
        record: NaN,
        specialtyOther: "",
        platforms: "",
        brands: "",
        model: "Niche",
        modelOther: "",
        audience: [],
        calls: false,
        flexText: "",
        flexFile: "",
        months: [],
      }
    : {
        ...common,
        role,
        experienceText: "",
        objectives: "",
        support: [],
        supportOther: "",
        blocker: "",
        exchange: "Message vocal",
        cash: NaN,
      };
}
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="specialty-options">
      <legend>{t(label)}</legend>
      {options.map((option) => (
        <label key={option}>
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, option]
                  : value.filter((v) => v !== option),
              )
            }
          />
          {t(option)}
        </label>
      ))}
    </fieldset>
  );
}
function Text({
  label,
  value,
  onChange,
  min = 3,
  max = 1500,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {t(label)}
      <textarea
        required
        minLength={min}
        maxLength={max}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <small>
        {min} {t("caractères minimum")} · {value.trim().length}/{max}
      </small>
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1e9,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {t(label)}
      <input
        required
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="0.01"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
}
function Screens({
  value,
  onChange,
  label,
  max = 3,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  max?: number;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="intake-screens">
      <label className="field">
        {t(label)}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple={max > 1}
          disabled={busy || value.length >= max}
          onChange={async (e) => {
            const input = e.currentTarget;
            const files = Array.from(input.files || []);
            if (files.length + value.length > max) {
              setError(`Maximum ${max} captures.`);
              return;
            }
            setBusy(true);
            setError("");
            const added = [...value];
            try {
              for (const file of files) {
                if (file.size > 4 * 1024 * 1024)
                  throw Error("Chaque capture doit faire 4 Mo maximum.");
                const data = new FormData();
                data.set("file", file);
                const r = await fetch("/api/verification-files", {
                  method: "POST",
                  body: data,
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                added.push(d.file.id);
                onChange([...added]);
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              input.value = "";
            }
          }}
        />
      </label>
      {busy && <p role="status">{t("Import en cours…")}</p>}
      {value.map((id, i) => (
        <div key={id}>
          <a
            href={"/api/verification-files?id=" + id}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Capture")} {i + 1}
          </a>{" "}
          <button
            type="button"
            disabled={busy}
            className="text-btn"
            onClick={() => {
              onChange(value.filter((v) => v !== id));
              void fetch("/api/verification-files", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });
            }}
          >
            {t("Retirer")}
          </button>
        </div>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function ProfileForm({
  initial,
  onSave,
  onCancel,
  onLogin,
  requiredRefresh = false,
}: {
  initial: ProfileInput & { questionnaire?: Onboarding | null };
  onSave: (p: Profile) => void;
  requiredRefresh?: boolean;
  onCancel?: () => void;
  onLogin: () => void;
}) {
  const [draft, setDraft] = useState({ ...initialProfile, ...initial });
  const [q, setQ] = useState<Onboarding>(
    initial.questionnaire?.role === "mentor"
      ? { ...initial.questionnaire, months: [] }
      : initial.questionnaire || fresh(initial.role),
  );
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false);
  const edit = (key: string, value: unknown) =>
    setQ((previous) => ({ ...previous, [key]: value }) as Onboarding);
  const mentor = q.role === "mentor";
  const steps = mentor
    ? ["Identité et parcours", "Expertise et réussite", "Accompagnement"]
    : [
        "Identité et expérience",
        "Objectifs et intérêts",
        "Accompagnement et trésorerie",
      ];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mentor && (!q.started || experienceMonths(q.started) < 6)) {
      setStep(0);
      setError(
        "Il faut au moins six mois complets d’achat-revente pour devenir parrain.",
      );
      return;
    }
    if (step < steps.length - 1) {
      if (
        step === 1 &&
        mentor &&
        (!draft.specialty.length ||
          (draft.specialty.includes("Autre") &&
            q.specialtyOther.trim().length < 3) ||
          (!q.flexFile && q.flexText.trim().length < 10))
      ) {
        setError(
          "Complète les spécialités et ta plus belle réussite (texte ou image).",
        );
        return;
      }
      setStep(step + 1);
      return;
    }
    const checked = onboardingSchema.safeParse(q);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    if (!consent) {
      setError("Confirme les informations et leur visibilité.");
      return;
    }
    setBusy(true);
    try {
      const p = {
        ...draft,
        role: q.role,
        experience: mentor ? experienceMonths(q.started) : draft.experience,
        bio: mentor
          ? q.flexText ||
            "Revendeur expérimenté souhaitant partager son expérience en achat-revente."
          : q.experienceText,
        goals: mentor
          ? `Accompagner : ${q.audience.join(", ")}.`
          : q.objectives.slice(0, 500),
        references: mentor ? q.brands.slice(0, 300) : "",
        teaching: mentor
          ? `${draft.specialty.join(", ")}${q.specialtyOther ? " · " + q.specialtyOther : ""}.`
          : "",
        consent: true,
        questionnaire: q,
      };
      if (p.bio.length < 20) p.bio = p.bio + " — Achat-revente sur Mentora.";
      p.bio = p.bio.slice(0, 800);
      const r = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      onSave(data.profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="onboarding">
      <aside>
        <span className="eyebrow">
          {t(onCancel ? "MON PROFIL" : "FAISONS CONNAISSANCE")}
        </span>
        <h2>
          {t(
            mentor
              ? "Partage ton expérience."
              : "Trouve l’accompagnement adapté.",
          )}
        </h2>
        <ol className="form-steps">
          {steps.map((s, i) => (
            <li
              key={s}
              className={step === i ? "current" : step > i ? "done" : ""}
            >
              <span>{i + 1}</span>
              {t(s)}
            </li>
          ))}
        </ol>
        <p>
          {t(
            "Les informations renseignées seront visibles dans le détail de ton profil. Tu pourras ensuite ajouter une biographie et des images dans « Finaliser mon profil ».",
          )}
        </p>
      </aside>
      <form className="form-panel" onSubmit={submit}>
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <span className="eyebrow">
            {t("Étape")} {step + 1}/{steps.length}
          </span>
          <h2>{t(steps[step])}</h2>
          {step === 0 && (
            <>
              <div className="role-switch">
                {(["beginner", "mentor"] as const).map((role) => (
                  <button
                    type="button"
                    key={role}
                    className={q.role === role ? "selected" : ""}
                    onClick={() => {
                      if (q.role !== role) {
                        setDraft((d) => ({ ...d, role }));
                        setQ(fresh(role));
                        setError("");
                      }
                    }}
                  >
                    {t(role === "mentor" ? "Parrain" : "Débutant")}
                  </button>
                ))}
              </div>
              <label className="field">
                {t("Prénom ou surnom")}
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field">
                {t("Pseudo Discord")}
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  pattern="[a-z0-9_.]+"
                  value={draft.discord}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      discord: e.target.value.toLowerCase(),
                    })
                  }
                />
                <small>
                  {t("Accessible uniquement après acceptation d’un binôme.")}
                </small>
              </label>
              {mentor ? (
                <>
                  <label className="field">
                    {t("Depuis quel mois fais-tu de l’achat-revente ?")}
                    <input
                      type="month"
                      required
                      max={completedMonths()[0]}
                      value={q.started}
                      onChange={(e) => edit("started", e.target.value)}
                    />
                    <small>
                      {t("Au moins six mois complets sont obligatoires.")}
                    </small>
                  </label>
                  <NumberField
                    label="Ton record de chiffre d’affaires sur un mois (€)"
                    value={q.record}
                    onChange={(v) => edit("record", v)}
                  />
                </>
              ) : (
                <Text
                  label="Ton niveau et ton expérience en achat-revente"
                  min={30}
                  value={q.experienceText}
                  onChange={(v) => edit("experienceText", v)}
                />
              )}
            </>
          )}
          {step === 1 && mentor && (
            <>
              <Choices
                label="Tes spécialités (plusieurs choix possibles)"
                options={specialties}
                value={draft.specialty}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    specialty: v as ProfileInput["specialty"],
                  })
                }
              />
              {draft.specialty.includes("Autre") && (
                <Text
                  label="Précise ton autre spécialité"
                  max={150}
                  value={q.specialtyOther}
                  onChange={(v) => edit("specialtyOther", v)}
                />
              )}
              <Text
                label="Marques et références déjà testées"
                min={10}
                value={q.brands}
                onChange={(v) => edit("brands", v)}
              />
              <Text
                label="Sur quelles plateformes vends-tu ?"
                max={300}
                value={q.platforms}
                onChange={(v) => edit("platforms", v)}
              />
              <Choices
                label="Les catégories que tu maîtrises"
                options={categories}
                value={q.categories}
                onChange={(v) => edit("categories", v)}
              />
              {q.categories.includes("Autre") && (
                <Text
                  label="Précise l’autre catégorie"
                  max={150}
                  value={q.categoryOther}
                  onChange={(v) => edit("categoryOther", v)}
                />
              )}
              <label className="field">
                {t("Ton type d’activité")}
                <select
                  value={q.model}
                  onChange={(e) => edit("model", e.target.value)}
                >
                  {["Niche", "Gros", "Les deux", "Autre"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {q.model === "Autre" && (
                <Text
                  label="Précise ton activité"
                  max={150}
                  value={q.modelOther}
                  onChange={(v) => edit("modelOther", v)}
                />
              )}
              <label className="field">
                {t("Ton plus gros flex : ta plus belle réussite")}
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={q.flexText}
                  onChange={(e) => edit("flexText", e.target.value)}
                />
                <small>
                  {t(
                    "Un texte de 10 caractères minimum ou une image. Évite les données personnelles sur l’image : elle sera visible sur ton profil.",
                  )}
                </small>
              </label>
              <Screens
                label="Image de ta réussite (facultative si tu écris un texte)"
                max={1}
                value={q.flexFile ? [q.flexFile] : []}
                onChange={(v) => edit("flexFile", v[0] || "")}
              />
            </>
          )}
          {step === 1 && !mentor && (
            <>
              <Text
                label="Quels sont tes objectifs ?"
                min={30}
                value={q.objectives}
                onChange={(v) => edit("objectives", v)}
              />
              <Choices
                label="Les catégories de produits qui t’intéressent"
                options={categories}
                value={q.categories}
                onChange={(v) => edit("categories", v)}
              />
              {q.categories.includes("Autre") && (
                <Text
                  label="Précise l’autre catégorie"
                  max={150}
                  value={q.categoryOther}
                  onChange={(v) => edit("categoryOther", v)}
                />
              )}
              <Text
                label="Quel est ton principal blocage aujourd’hui ?"
                min={30}
                value={q.blocker}
                onChange={(v) => edit("blocker", v)}
              />
            </>
          )}
          {step === steps.length - 1 && (
            <>
              {mentor ? (
                <>
                  <Choices
                    label="Quels profils veux-tu accompagner ?"
                    options={["Débutants", "Revendeurs confirmés"]}
                    value={q.audience}
                    onChange={(v) => edit("audience", v)}
                  />
                  <label className="field">
                    {t("Acceptes-tu de participer à des appels ?")}
                    <select
                      value={q.calls ? "yes" : "no"}
                      onChange={(e) => edit("calls", e.target.value === "yes")}
                    >
                      <option value="no">Non</option>
                      <option value="yes">Oui</option>
                    </select>
                  </label>
                  <label className="field">
                    {t("Nombre de personnes que tu peux accompagner")}
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      value={draft.capacity}
                      onChange={(e) =>
                        setDraft({ ...draft, capacity: Number(e.target.value) })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <Choices
                    label="Quel accompagnement souhaites-tu ?"
                    options={supportTypes}
                    value={q.support}
                    onChange={(v) => edit("support", v)}
                  />
                  {q.support.includes("Autre") && (
                    <Text
                      label="Précise ton accompagnement"
                      max={200}
                      value={q.supportOther}
                      onChange={(v) => edit("supportOther", v)}
                    />
                  )}
                  <label className="field">
                    {t("Quel échange préfères-tu ?")}
                    <select
                      value={q.exchange}
                      onChange={(e) => edit("exchange", e.target.value)}
                    >
                      <option>Appel</option>
                      <option>Message vocal</option>
                    </select>
                  </label>
                  <NumberField
                    label="Ta trésorerie disponible maintenant (€)"
                    value={q.cash}
                    onChange={(v) => edit("cash", v)}
                  />
                  <small>
                    {t(
                      "Ce montant sera visible dans le détail de ton profil. Mets 0 si tu n’as pas encore de trésorerie.",
                    )}
                  </small>
                </>
              )}
              <label className="field">
                {t("Tes disponibilités")}
                <select
                  value={draft.availability}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      availability: e.target
                        .value as ProfileInput["availability"],
                    })
                  }
                >
                  {times.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t("Durée souhaitée")}
                <select
                  value={draft.duration}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      duration: e.target.value as ProfileInput["duration"],
                    })
                  }
                >
                  {[
                    "2 semaines",
                    "1 mois",
                    "3 mois",
                    "6 mois",
                    "Sans durée définie",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="email-choice">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                {t(
                  "Je confirme ces informations, leur visibilité indiquée et mon engagement à respecter les membres de Mentora.",
                )}
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions">
            {step > 0 && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                {t("Retour")}
              </button>
            )}
            {onCancel && (
              <button type="button" className="text-btn" onClick={onCancel}>
                {t("Annuler")}
              </button>
            )}
            <button className="btn" disabled={busy}>
              {t(
                busy
                  ? "Enregistrement…"
                  : step < steps.length - 1
                    ? "Continuer"
                    : "Enregistrer mon profil",
              )}
            </button>
          </div>
          {!onCancel && !requiredRefresh && (
            <button type="button" className="text-btn" onClick={onLogin}>
              {t("Déjà un compte ? Se connecter")}
            </button>
          )}
        </fieldset>
      </form>
    </div>
  );
}
