"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  LockKeyhole,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { termsVersion } from "@/lib/legal-versions";
import { initialProfile, type Profile, type ProfileInput } from "@/lib/profile";
import { intakeProfile } from "@/lib/intake-profile";
import {
  answerLabels,
  freshIntake,
  intakeDraftSchema,
  intakeQuestions,
  intakeSchema,
  questionError,
  reconcileIntake,
  type IntakeAnswers,
  type IntakeQuestion,
  type IntakeRole,
} from "@/lib/intake";
import {
  experienceMonths,
  type ProfileQuestionnaire,
} from "@/lib/onboarding-schema";
import { BrandLogo } from "./brand-logo";
import "../intake.css";
import {MentorComplement} from "./mentor-complement";

type Existing = Partial<ProfileInput> & {
  id?: string;
  questionnaire?: ProfileQuestionnaire | null;
};
function seed(initial: Existing, role: IntakeRole): IntakeAnswers {
  if (initial.questionnaire?.version === 2) return initial.questionnaire;
  const d = freshIntake(role);
  d.financialGoal = 0;
  const old = initial.questionnaire;
  if (old?.version === 1 && old.role === "mentor") {
    d.selections.platforms = [
      ...new Set([
        ...["vinted", "ebay", "whatnot", "depop"].filter((s) =>
          old.platforms.toLowerCase().includes(s),
        ),
        ...(/le\s*bon\s*coin/i.test(old.platforms) ? ["leboncoin"] : []),
      ]),
    ];
    const months = experienceMonths(old.started);
    if (months >= 6)
      d.selections.experience = [
        months < 12
          ? "6to12"
          : months < 24
            ? "1to2"
            : months <= 60
              ? "2to5"
              : "over5",
      ];
    if (old.model === "Niche") d.selections.methods = ["niches"];
    else if (old.model === "Gros") d.selections.methods = ["mainstream"];
    else if (old.model === "Les deux")
      d.selections.methods = ["niches", "mainstream"];
    if (old.calls) d.selections.support = ["calls"];
  } else if (old?.version === 1 && old.role === "beginner") {
    d.selections.goal = ["other"];
    d.other.goal = old.objectives.slice(0, 160);
    d.selections.support = [old.exchange === "Appel" ? "calls" : "messages"];
    const cash = old.cash;
    d.selections.budget = [
      cash === 0
        ? "own_items"
        : cash < 50
          ? "under50"
          : cash <= 100
            ? "50to100"
            : cash <= 200
              ? "100to200"
              : cash <= 500
                ? "200to500"
                : cash <= 1000
                  ? "500to1000"
                  : "over1000",
    ];
  }
  const times: Record<string, string> = {
    "En soirée": "evening",
    "Le week-end": "weekend",
    Flexible: "variable",
  };
  if (initial.availability && times[initial.availability])
    d.selections.availability = [times[initial.availability]];
  if (role === "mentor" && initial.capacity && initial.capacity > 0) {
    const n = initial.capacity;
    d.selections.capacity = [n <= 3 ? String(n) : n <= 5 ? "4to5" : "over5"];
    if (n > 3) d.capacityExact = n;
  }
  return d;
}
function MoneyQuestion({
  value,
  onChange,
  max,
}: {
  value?: number;
  onChange: (n: number | undefined) => void;
  max: number;
}) {
  const haptic = useRef({ amount: value, time: 0 });
  const [display, setDisplay] = useState(value || 0),
    displayed = useRef(value || 0);
  useEffect(() => {
    const end = value || 0,
      start = displayed.current;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true"
    ) {
      displayed.current = end;
      setDisplay(end);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - began) / 140, 1);
      const n = start + (end - start) * (1 - Math.pow(1 - t, 3));
      displayed.current = n;
      setDisplay(n);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  function update(n: number | undefined) {
    onChange(n);
    if (n === undefined) return;
    const now = performance.now();
    if (
      Math.abs(n - (haptic.current.amount || 0)) >= 250 &&
      now - haptic.current.time >= 300
    ) {
      haptic.current = { amount: n, time: now };
      try {
        navigator.vibrate?.(5);
      } catch {}
    }
  }
  return (
    <div className="intake-money">
      <div className="intake-amount" aria-hidden="true">
        <span>
          {display.toLocaleString("fr-FR", {
            maximumFractionDigits: Number.isInteger(value || 0) ? 0 : 2,
          })}
        </span>
        <small>€ / mois</small>
      </div>
      <label className="intake-slider-label">
        Ajuster mon objectif
        <input
          aria-label="Ajuster mon objectif mensuel"
          type="range"
          min={0}
          max={max}
          step={50}
          value={Math.min(value || 0, max)}
          onChange={(e) => update(Number(e.target.value))}
        />
      </label>
      <div className="intake-range-ends">
        <span>0 €</span>
        <span>{max.toLocaleString("fr-FR")} €</span>
      </div>
      <label className="intake-custom-amount">
        Ou saisir mon montant
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={1e9}
          step="any"
          value={value ?? ""}
          onChange={(e) =>
            update(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
        <span>€ / mois</span>
      </label>
      <p className="intake-private">
        <LockKeyhole size={15} />
        Cette réponse reste privée.
      </p>
    </div>
  );
}
export function IntakeJourney({
  initial = {},
  role: initialRole = "beginner",
  registration = false,
  onSave,
  onCancel,
}: {
  initial?: Existing;
  role?: IntakeRole;
  registration?: boolean;
  onSave?: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [answers, setAnswers] = useState(() =>
    seed(initial, initial.role || initialRole),
  );
  const [index, setIndex] = useState(0),
    [ready, setReady] = useState(false),
    [review, setReview] = useState(
      !registration && initial.questionnaire?.version === 2,
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false),
    [accepted, setAccepted] = useState(false),
    [saved, setSaved] = useState(false);
  const [identity, setIdentity] = useState({
    name: initial.name || "",
    discord: initial.discord || "",
    bio: initial.bio || "",
  });
  useEffect(()=>{setIdentity(v=>({...v,bio:initial.bio||""}))},[initial.bio]);
  const heading = useRef<HTMLHeadingElement>(null),
    pending = useRef<ReturnType<typeof setTimeout> | null>(null),
    roleChanged = useRef(false);
  const questions = intakeQuestions(answers),
    question = questions[index],
    final = index >= questions.length;
  const key = `mentora:intake:2:${initial.id || "anonymous"}:${answers.role}`,
    base = useRef(JSON.stringify(seed(initial, initial.role || initialRole)));
  useEffect(() => {
    if (roleChanged.current) roleChanged.current = false;
    else
      try {
        const stored = JSON.parse(sessionStorage.getItem(key) || "null");
        if (
          stored &&
          Date.now() - stored.at < 86400000 &&
          stored.base === base.current
        ) {
          const parsed = intakeDraftSchema.safeParse(stored.answers);
          if (parsed.success && parsed.data.role === answers.role) {
            setAnswers({
              ...parsed.data,
              ...(initial.questionnaire?.version === 2 &&
              initial.questionnaire.legacy
                ? { legacy: initial.questionnaire.legacy }
                : {}),
            });
            setIndex(
              Math.min(
                Math.max(0, Number(stored.index) || 0),
                intakeQuestions(parsed.data).length,
              ),
            );
          }
        }
      } catch {}
    setReady(true);
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [key, initial.role, initialRole]);
  useEffect(() => {
    if (ready)
      try {
        const { legacy, ...draft } = answers;
        void legacy;
        sessionStorage.setItem(
          key,
          JSON.stringify({
            at: Date.now(),
            base: base.current,
            answers: draft,
            index,
          }),
        );
      } catch {}
  }, [answers, index, key, ready]);
  useEffect(() => {
    if (ready) {
      heading.current?.focus({ preventScroll: true });
      if (!review)
        heading.current?.scrollIntoView({
          block: "nearest",
          behavior: "instant",
        });
    }
  }, [index, review, ready]);
  function stop() {
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
  }
  function goNext(next = answers) {
    stop();
    setError("");
    if (question) {
      const problem = questionError(next, question);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (!registration && initial.questionnaire?.version === 2) {
      setReview(true);
      return;
    }
    setIndex((i) => Math.min(i + 1, intakeQuestions(next).length));
  }
  function select(id: string) {
    if (!question || busy) return;
    stop();
    setError("");
    const before = answers.selections[question.id] || [];
    setSaved(false);
    const selected =
      question.kind === "single"
        ? [id]
        : id === "variable"
          ? before.includes(id)
            ? []
            : ["variable"]
          : before.includes(id)
            ? before.filter((x) => x !== id)
            : [...before.filter((x) => x !== "variable"), id];
    const next = reconcileIntake(
      {
        ...answers,
        selections: { ...answers.selections, [question.id]: selected },
        ...(question.id === "capacity" ? { capacityExact: undefined } : {}),
      },
      answers,
    );
    setAnswers(next);
    const precise =
      question.id === "capacity" && ["4to5", "over5", "other"].includes(id);
    if (
      question.kind === "single" &&
      id !== "other" &&
      !precise &&
      !questionError(next, question)
    )
      pending.current = setTimeout(() => goNext(next), 220);
    else if (question.id === "experience" && id === "under6")
      setError(questionError(next, question));
  }
  function switchRole(role: IntakeRole) {
    if (initial.id || role === answers.role) return;
    stop();
    const next = freshIntake(role);
    next.financialGoal = 0;
    for (const field of ["platforms", "methods", "availability"]) {
      if (answers.selections[field])
        next.selections[field] = answers.selections[field];
      if (answers.other[field]) next.other[field] = answers.other[field];
    }
    roleChanged.current = true;
    base.current = JSON.stringify(seed(initial, role));
    if (registration) {
      const url = new URL(window.location.href);
      url.searchParams.set("role", role);
      window.history.replaceState({}, "", url);
    }
    setAnswers(reconcileIntake(next));
    setIndex(0);
    setReview(false);
    setError("");
  }
  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    stop();
    setError("");
    const checked = intakeSchema.safeParse(answers);
    if (!checked.success) {
      const first = questions.findIndex((q) => questionError(answers, q));
      setReview(false);
      setIndex(Math.max(0, first));
      setError(checked.error.issues[0].message);
      return;
    }
    const form = event ? new FormData(event.currentTarget) : null;
    if (registration && !session && !accepted) {
      setError("Accepte les conditions d’utilisation pour créer ton compte.");
      return;
    }
    setBusy(true);
    try {
      let signed = await authClient.getSession();
      if (registration && !signed.data) {
        const email = String(form?.get("email") || "").trim(),
          password = String(form?.get("password") || "");
        const result = login
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(form?.get("name") || "").trim(),
            });
        if (result.error)
          throw Error(
            result.error.status === 429
              ? "Trop de tentatives. Patiente une minute."
              : login
                ? "Connexion impossible. Vérifie ton e-mail et ton mot de passe."
                : "Création impossible. Vérifie tes informations ou connecte-toi si tu as déjà un compte.",
          );
        signed = await authClient.getSession();
      }
      if (!signed.data)
        throw Error("Connecte-toi pour enregistrer tes réponses.");
      const response = await fetch("/api/me", { cache: "no-store" }),
        own = await response.json();
      if (!response.ok)
        throw Error(
          own.error ||
            "Ton compte est connecté. Réessaie pour enregistrer ton profil.",
        );
      const previous = own.profile as Profile | null;
      if (previous && previous.role !== answers.role) {
        switchRole(previous.role);
        setError(
          "Tu es connecté à un compte d’un autre type. Choisis le parcours correspondant à ton profil ; tes plateformes, méthodes et disponibilités sont conservées.",
        );
        throw Error(
          "Le parcours doit correspondre au type de ton compte. Tes réponses sont conservées dans ce navigateur.",
        );
      }
      const p = intakeProfile(
        checked.data,
        previous,
        identity.name ||
          previous?.name ||
          String(form?.get("name") || signed.data.user.name),
      );
      const edits = !registration
        ? { ...identity, bio: answers.role==="mentor"||initial.id?identity.bio.trim():identity.bio.trim() || p.bio }
        : {};
      const r = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...p,
          ...edits,
          questionnaire: checked.data,
          termsAccepted: accepted,
          termsVersion,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      if (onSave) {
        setAnswers(data.profile.questionnaire);
        setReview(true);
        setSaved(true);
        onSave(data.profile);
      } else window.location.assign("/?mobile=profile#profile");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Préparation de ton parcours…</p>;
  return (
    <section
      className={`intake-shell ${registration ? "intake-registration" : "intake-editor"}`}
      aria-busy={busy}
    >
      <header className="intake-header">
        {registration && (
          <a href="/" className="intake-brand" aria-label="Mentora, accueil">
            <BrandLogo />
            <span>Mentora</span>
          </a>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel}>
            Fermer
          </button>
        ) : (
          <a href={`/?connexion=1&reprendreInscription=${answers.role}`}>
            Déjà membre ?
          </a>
        )}
      </header>
      {!review && (
        <div className="intake-progress">
          <div className="intake-progress-meta">
            <span>
              {final
                ? "Dernière étape"
                : `Étape ${index + 1} sur ${questions.length}${registration ? " · puis ton compte" : ""}`}
            </span>
            <span>
              {Math.round(
                Math.min(
                  (index + 1) / (questions.length + (registration ? 1 : 0)),
                  1,
                ) * 100,
              )}{" "}
              %
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progression du questionnaire"
            aria-valuemin={0}
            aria-valuemax={questions.length + (registration ? 1 : 0)}
            aria-valuenow={Math.min(
              index + 1,
              questions.length + (registration ? 1 : 0),
            )}
          >
            <span
              style={{
                width: `${((index + 1) / (questions.length + (registration ? 1 : 0))) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      <div
        className="intake-content"
        key={review ? "review" : final ? "account" : question.id}
      >
        <span className="intake-eyebrow">
          {review
            ? "MON ESPACE PERSONNEL"
            : final
              ? "LA DERNIÈRE ÉTAPE"
              : "FAISONS CONNAISSANCE"}
        </span>
        <h1 ref={heading} tabIndex={-1}>
          {review
            ? "Mes informations et préférences"
            : final
              ? registration
                ? "Ton profil est presque prêt !"
                : "Tes réponses sont prêtes"
              : question.title}
        </h1>
        {review ? (
          <>
            <p>
              Toutes tes réponses sont conservées dans ton profil. Le budget et
              les objectifs financiers restent privés.
            </p>
            {saved && (
              <p role="status">
                Tes informations et préférences sont enregistrées.
              </p>
            )}
            <div className="intake-review">
              {questions.map((q, i) => (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => {
                    setIndex(i);
                    setReview(false);
                    setError("");
                  }}
                >
                  <span>
                    <strong>{q.title}</strong>
                    <small>
                      {q.kind === "money"
                        ? `${answers.financialGoal?.toLocaleString("fr-FR") ?? "À compléter"} € / mois`
                        : answerLabels(answers, q).join(" · ") || "À compléter"}
                      {q.id === "capacity" && answers.capacityExact
                        ? ` · ${answers.capacityExact} places`
                        : ""}
                    </small>
                    {(q.id === "budget" || q.kind === "money") && (
                      <em>
                        <LockKeyhole size={12} />
                        Privé
                      </em>
                    )}
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
            <details className="intake-identity">
              <summary>Mon profil public</summary>
              <label>
                Pseudo
                <input
                  minLength={2}
                  maxLength={40}
                  value={identity.name}
                  onChange={(e) =>
                    setIdentity({ ...identity, name: e.target.value })
                  }
                />
              </label>
              <label>
                Pseudo Discord (facultatif)
                <input
                  maxLength={32}
                  value={identity.discord}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      discord: e.target.value.toLowerCase(),
                    })
                  }
                />
              </label>
              <label>
                Courte biographie (facultatif)
                <textarea
                  maxLength={1000}
                  value={identity.bio}
                  onChange={(e) =>
                    setIdentity({ ...identity, bio: e.target.value })
                  }
                />
              </label>
            </details>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn full"
              disabled={busy}
              type="button"
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle className="spin" /> : <Check />}Enregistrer
              mes modifications
            </button>
          </>
        ) : final ? (
          <form onSubmit={save} className="intake-account">
            <p>
              {registration
                ? session
                  ? "Enregistre tes réponses dans ton espace personnel."
                  : "Tes réponses sont prêtes. Crée ton compte pour les retrouver et les modifier à tout moment."
                : "Enregistre ces réponses pour actualiser ton profil."}
            </p>
            {registration && !session && !sessionPending && (
              <>
                {!login && (
                  <label>
                    Pseudo
                    <input
                      name="name"
                      autoComplete="nickname"
                      minLength={2}
                      maxLength={40}
                      required
                      defaultValue={identity.name}
                    />
                  </label>
                )}
                <label>
                  Adresse e-mail
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    name="password"
                    autoComplete={login ? "current-password" : "new-password"}
                    required
                    minLength={login ? 1 : 12}
                    maxLength={128}
                  />
                </label>
                {!login && <small>Au moins 12 caractères.</small>}
              </>
            )}
            {(registration || !initial.id) && (
              <label className="intake-consent">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  J’accepte les{" "}
                  <a
                    href="/juridique/cgu"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    conditions d’utilisation
                  </a>{" "}
                  et j’ai lu la{" "}
                  <a
                    href="/juridique/confidentialite"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn full"
              disabled={busy || sessionPending}
              type="submit"
            >
              {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
              {busy
                ? "Enregistrement…"
                : registration && !session
                  ? login
                    ? "Me connecter et enregistrer mes réponses"
                    : "Créer mon compte Mentora"
                  : "Enregistrer mes réponses"}
            </button>
            {registration && !session && (
              <button
                type="button"
                className="intake-login"
                onClick={() => {
                  setLogin(!login);
                  setError("");
                }}
              >
                {login
                  ? "Créer un nouveau compte"
                  : "J’ai déjà un compte — conserver mes réponses"}
              </button>
            )}
            {!registration && (
              <button
                type="button"
                className="intake-login"
                onClick={() => setReview(true)}
              >
                Consulter toutes mes réponses
              </button>
            )}
          </form>
        ) : (
          <>
            {question.kind === "multiple" && (
              <p>Tu peux choisir plusieurs réponses.</p>
            )}
            {question.hint && <p className="intake-hint">{question.hint}</p>}
            {question.kind === "money" ? (
              <MoneyQuestion
                max={question.max!}
                value={answers.financialGoal}
                onChange={(financialGoal) => {
                  setError("");
                  setAnswers({ ...answers, financialGoal });
                }}
              />
            ) : (
              <div
                className="intake-choices"
                role="group"
                aria-label={question.title}
              >
                {question.options!.map((choice, i) => {
                  const chosen = answers.selections[question.id]?.includes(
                    choice.id,
                  );
                  return (
                    <button
                      type="button"
                      key={choice.id}
                      disabled={busy}
                      aria-pressed={!!chosen}
                      className={chosen ? "selected" : ""}
                      onClick={() => select(choice.id)}
                    >
                      <span className="intake-choice-icon">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{choice.label}</span>
                      <span
                        className={`intake-check ${question.kind === "single" ? "round" : ""}`}
                      >
                        {chosen && <Check size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {question.id !== "capacity" &&
              answers.selections[question.id]?.includes("other") && (
                <label className="intake-other">
                  Précise ton choix
                  <input
                    autoFocus
                    maxLength={160}
                    value={answers.other[question.id] || ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        other: {
                          ...answers.other,
                          [question.id]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              )}
            {question.id === "capacity" &&
              ["4to5", "over5", "other"].includes(
                answers.selections.capacity?.[0],
              ) && (
                <label className="intake-other">
                  Combien de places exactement ?
                  <input
                    type="number"
                    inputMode="numeric"
                    min={
                      answers.selections.capacity[0] === "over5"
                        ? 6
                        : answers.selections.capacity[0] === "4to5"
                          ? 4
                          : 1
                    }
                    max={answers.selections.capacity[0] === "4to5" ? 5 : 10}
                    step={1}
                    value={answers.capacityExact ?? ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        capacityExact:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
            {question.id === "budget" && (
              <p className="intake-private">
                <LockKeyhole size={15} />
                Ton budget reste privé.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {question.id === "experience" &&
            answers.selections.experience?.[0] === "under6" ? (
              <button
                className="btn full"
                type="button"
                onClick={() => window.location.assign("/inscription")}
                disabled={!!initial.id}
              >
                Revenir au choix du profil
              </button>
            ) : (
              <button
                className="btn full intake-continue"
                type="button"
                disabled={busy}
                onClick={() => goNext()}
              >
                {!registration && initial.questionnaire?.version === 2
                  ? "Valider cette modification"
                  : "Continuer"}
                <ArrowRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
      {!review && (
        <footer className="intake-navigation">
          {index > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                stop();
                setError("");
                setIndex((i) => i - 1);
              }}
            >
              <ArrowLeft size={16} />
              Retour
            </button>
          ) : (
            <span />
          )}
          {!registration && initial.questionnaire?.version === 2 && (
            <button
              type="button"
              onClick={() => {
                stop();
                setReview(true);
              }}
            >
              Toutes mes réponses
            </button>
          )}
          <span>
            <LockKeyhole size={13} />{" "}
            {final ? "Connexion sécurisée" : "Modifiable depuis ton profil"}
          </span>
        </footer>
      )}
    </section>
  );
}
export function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ProfileInput & { id?:string; questionnaire?: ProfileQuestionnaire | null };
  onSave: (p: Profile) => void;
  onCancel?: () => void;
  onLogin: () => void;
  requiredRefresh?: boolean;
}) {
  const [complementOpen,setComplementOpen]=useState(false);
  return (
    <>
    {initial.id&&initial.role==="mentor"&&<MentorComplement bioVersion={initial.bio} onOpenChange={setComplementOpen} onChanged={async()=>{const r=await fetch("/api/me",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);onSave(d.profile)}}/>}
    <div hidden={complementOpen} style={complementOpen?{display:"none"}:undefined}><IntakeJourney
      initial={initial}
      role={initial.role}
      onSave={onSave}
      onCancel={onCancel}
    /></div>
    </>
  );
}
