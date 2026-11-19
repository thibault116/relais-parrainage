import { z } from "zod";
import type { Onboarding } from "./onboarding-schema";

export type IntakeRole = "beginner" | "mentor";
export type Choice = { id: string; label: string; icon?: string };
export type IntakeQuestion = {
  id: string;
  title: string;
  kind: "single" | "multiple" | "money";
  options?: Choice[];
  max?: number;
  hint?: string;
};
const options = (items: [string, string][]): Choice[] =>
  items.map(([id, label]) => ({ id, label }));
const other: Choice = { id: "other", label: "Autre" };
export const platforms = options([
  ["vinted", "Vinted"],
  ["leboncoin", "Leboncoin"],
  ["ebay", "eBay"],
  ["whatnot", "Whatnot"],
  ["depop", "Depop"],
]).concat(other);
export const methods = options([
  ["manual", "Vinted — achat à la main"],
  ["bot", "Vinted — achat avec un bot"],
  ["mainstream", "Grossistes / fournisseurs"],
  ["niches", "Les niches"],
  ["luxury", "Le luxe"],
  ["flea", "Les brocantes"],
]).concat(other);
export const levels = options([
  ["never", "Je n’ai jamais commencé"],
  ["starting", "Je débute à peine"],
  ["sales", "J’ai déjà fait quelques ventes"],
  ["regular", "Je revends régulièrement"],
]);
export const mentorExperience = options([
  ["under6", "Moins de 6 mois"],
  ["6to12", "6 mois à 1 an"],
  ["1to2", "1 à 2 ans"],
  ["2to5", "2 à 5 ans"],
  ["over5", "Plus de 5 ans"],
]);
const noviceGoals = options([
  ["first_sales", "Faire mes premières ventes"],
  ["find_items", "Apprendre à trouver des articles rentables"],
  ["pricing", "Comprendre comment fixer mes prix"],
  ["launch", "Lancer mon activité d’achat-revente"],
]).concat(other);
const experiencedGoals = options([
  ["better_items", "Trouver de meilleurs articles"],
  ["more_sales", "Augmenter mes ventes"],
  ["profitability", "Améliorer ma rentabilité"],
  ["develop", "Développer une vraie activité"],
]).concat(other);
const budgets = options([
  ["under50", "Moins de 50 €"],
  ["50to100", "50 à 100 €"],
  ["100to200", "100 à 200 €"],
  ["200to500", "200 à 500 €"],
  ["500to1000", "500 à 1 000 €"],
  ["over1000", "Plus de 1 000 €"],
]);
const availability = options([
  ["weekdays", "En semaine"],
  ["weekend", "Le week-end"],
  ["morning", "Le matin"],
  ["afternoon", "L’après-midi"],
  ["evening", "Le soir"],
]);
export const intakeDraftSchema = z.object({
  version: z.literal(2),
  role: z.enum(["beginner", "mentor"]),
  selections: z.record(z.string().max(40), z.array(z.string().max(40)).max(12)),
  other: z.record(z.string().max(40), z.string().trim().max(160)),
  financialGoal: z.number().finite().min(0).max(1_000_000_000).optional(),
  capacityExact: z.number().int().min(1).max(10).optional(),
});
export type IntakeAnswers = z.infer<typeof intakeDraftSchema> & {
  legacy?: Onboarding;
};
export const freshIntake = (role: IntakeRole): IntakeAnswers => ({
  version: 2,
  role,
  selections: {},
  other: {},
});
export function isNovice(d: IntakeAnswers) {
  return ["never", "starting"].includes(d.selections.level?.[0] || "never");
}
export function intakeQuestions(d: IntakeAnswers): IntakeQuestion[] {
  const beginner = d.role === "beginner",
    novice = isNovice(d);
  const financial: IntakeQuestion = {
    id: "financialGoal",
    kind: "money",
    title: beginner
      ? "Quel est ton objectif de bénéfice mensuel ?"
      : "Combien aimerais-tu gagner par mois en aidant des débutants ?",
    max: beginner ? 10000 : 5000,
    hint: beginner
      ? "Un objectif personnel, pas une promesse de résultat."
      : "Un souhait personnel, sans revenu garanti. Le prix de tes prestations reste libre.",
  };
  const when: IntakeQuestion = {
    id: "availability",
    kind: "multiple",
    title: beginner
      ? "Quand es-tu disponible pour échanger ?"
      : "Quand es-tu disponible ?",
    options: [
      ...availability,
      { id: "variable", label: beginner ? "Ça dépend" : "Horaires variables" },
      other,
    ],
  };
  if (!beginner)
    return [
      {
        id: "experience",
        kind: "single",
        title: "Depuis combien de temps fais-tu de l’achat-revente ?",
        options: mentorExperience,
      },
      {
        id: "platforms",
        kind: "multiple",
        title: "Sur quelles plateformes es-tu expérimenté ?",
        options: platforms,
      },
      {
        id: "help",
        kind: "multiple",
        title: "Dans quels domaines peux-tu aider ?",
        options: options([
          ["sourcing", "Sourcing / Fournisseurs"],
          ["pricing", "Prix et estimations"],
          ["photos", "Photos et annonces"],
          ["stock", "Organisation et gestion du stock"],
          ["growth", "Développement de l’activité"],
          ["strategy", "Stratégies de vente"],
        ]).concat(other),
      },
      {
        id: "methods",
        kind: "multiple",
        title: "Quelles méthodes d’achat maîtrises-tu le mieux ?",
        options: methods,
      },
      {
        id: "capacity",
        kind: "single",
        title: "Combien de débutants souhaites-tu accompagner ?",
        options: options([
          ["1", "1 personne"],
          ["2", "2 personnes"],
          ["3", "3 personnes"],
          ["4to5", "4 à 5 personnes"],
          ["over5", "Plus de 5 personnes"],
        ]).concat(other),
        hint: "La capacité actuelle de Mentora est de 10 places maximum.",
      },
      when,
      {
        id: "support",
        kind: "multiple",
        title: "Comment souhaites-tu accompagner les débutants ?",
        options: options([
          ["messages", "Messages privés"],
          ["calls", "Appels vocaux"],
          ["occasional", "Conseils ponctuels"],
          ["regular", "Accompagnement régulier"],
        ]).concat(other),
      },
      financial,
    ];
  return [
    {
      id: "level",
      kind: "single",
      title: "Tu en es où dans l’achat-revente ?",
      options: levels,
    },
    {
      id: "platforms",
      kind: "multiple",
      title: novice
        ? "Sur quelles plateformes aimerais-tu vendre ?"
        : "Sur quelles plateformes revends-tu ?",
      options: platforms,
    },
    {
      id: "goal",
      kind: "single",
      title: "Quel est ton objectif principal ?",
      options: novice ? noviceGoals : experiencedGoals,
    },
    {
      id: "help",
      kind: "multiple",
      title: "Sur quels sujets as-tu besoin d’aide ?",
      options: options([
        ["sourcing", "Trouver des fournisseurs"],
        ["pricing", "Estimer les prix"],
        ["photos", "Photos et annonces"],
        ["stock", "Organisation du stock"],
        ["growth", "Développer mes ventes"],
      ]).concat(other),
    },
    {
      id: "methods",
      kind: "multiple",
      title: novice
        ? "Quelles méthodes d’achat t’intéressent ?"
        : "Quelles méthodes d’achat souhaites-tu développer ?",
      options: methods,
    },
    {
      id: "budget",
      kind: "single",
      title: novice
        ? "Avec quel budget comptes-tu commencer ?"
        : "Quel est ton budget ?",
      options: [
        ...(novice
          ? [
              {
                id: "own_items",
                label: "0 € — je revends mes propres affaires",
              },
            ]
          : []),
        ...budgets,
        other,
      ],
    },
    ...(novice
      ? [
          {
            id: "deadline",
            kind: "single" as const,
            title:
              "Dans combien de temps aimerais-tu réaliser tes premières ventes ?",
            options: options([
              ["week", "Dès cette semaine"],
              ["2weeks", "Dans les 2 prochaines semaines"],
              ["month", "Dans le mois"],
              ["3months", "Dans les 3 prochains mois"],
              ["own_pace", "Je préfère avancer à mon rythme"],
            ]).concat(other),
          },
        ]
      : []),
    financial,
    when,
    {
      id: "support",
      kind: "single",
      title: "Comment préfères-tu être accompagné ?",
      options: options([
        ["messages", "Par messages"],
        ["calls", "Par appel vocal"],
        ["both", "Les deux me conviennent"],
        ["community", "Je veux surtout découvrir la communauté"],
      ]).concat(other),
    },
  ];
}
export function questionError(d: IntakeAnswers, q: IntakeQuestion): string {
  if (q.kind === "money")
    return typeof d.financialGoal === "number" &&
      Number.isFinite(d.financialGoal) &&
      d.financialGoal >= 0 &&
      d.financialGoal <= 1e9
      ? ""
      : "Indique un montant valide, de 0 à 1 milliard d’euros.";
  const selected = d.selections[q.id] || [],
    allowed = q.options!.map((o) => o.id);
  if (
    !selected.length ||
    selected.some((id) => !allowed.includes(id)) ||
    new Set(selected).size !== selected.length
  )
    return "Choisis une réponse parmi les options proposées.";
  if (q.kind === "single" && selected.length !== 1)
    return "Choisis une seule réponse.";
  if (
    q.id !== "capacity" &&
    selected.includes("other") &&
    (d.other[q.id] || "").trim().length < 2
  )
    return "Précise ton choix en quelques mots.";
  if (
    q.id === "availability" &&
    selected.includes("variable") &&
    selected.length > 1
  )
    return "Choisis des horaires précis ou des horaires variables.";
  if (q.id === "experience" && selected[0] === "under6")
    return "Il faut au moins six mois d’expérience pour devenir parrain. Tu peux rejoindre Mentora comme débutant.";
  if (q.id === "capacity") {
    const value = selected[0],
      n = d.capacityExact;
    if (
      ["4to5", "over5", "other"].includes(value) &&
      (!Number.isInteger(n) ||
        (n || 0) < (value === "over5" ? 6 : value === "4to5" ? 4 : 1) ||
        (n || 0) > (value === "4to5" ? 5 : 10))
    )
      return "Précise le nombre exact de places (10 maximum).";
  }
  return "";
}
export function reconcileIntake(
  d: IntakeAnswers,
  previous?: IntakeAnswers,
): IntakeAnswers {
  const active = intakeQuestions(d),
    keys = new Set(active.map((q) => q.id)),
    selections: Record<string, string[]> = {},
    custom: Record<string, string> = {};
  for (const q of active) {
    if (!q.options) continue;
    const allowed = new Set(q.options.map((o) => o.id));
    const values = (d.selections[q.id] || []).filter((v) => allowed.has(v));
    if (values.length) selections[q.id] = [...new Set(values)];
    if (values.includes("other") && d.other[q.id]) custom[q.id] = d.other[q.id];
  }
  if (
    previous?.role === "beginner" &&
    d.role === "beginner" &&
    isNovice(previous) !== isNovice(d)
  ) {
    delete selections.goal;
    delete custom.goal;
  }
  return {
    ...d,
    selections,
    other: custom,
    ...(!keys.has("capacity") ||
    ["1", "2", "3"].includes(selections.capacity?.[0])
      ? { capacityExact: undefined }
      : {}),
  };
}
export const intakeSchema = intakeDraftSchema
  .superRefine((d, ctx) => {
    const questions = intakeQuestions(d);
    for (const q of questions) {
      const message = questionError(d, q);
      if (message) ctx.addIssue({ code: "custom", path: [q.id], message });
    }
    const clean = reconcileIntake(d);
    if (
      Object.keys(d.selections).some(
        (k) =>
          JSON.stringify(d.selections[k]) !==
          JSON.stringify(clean.selections[k] || []),
      ) ||
      Object.keys(d.other).some((k) => !clean.other[k])
    )
      ctx.addIssue({
        code: "custom",
        path: ["selections"],
        message:
          "Certaines réponses ne correspondent plus à ton parcours. Vérifie-les.",
      });
  })
  .transform((d) => reconcileIntake(d));
export function answerLabels(
  d: Pick<IntakeAnswers, "selections" | "other">,
  q: IntakeQuestion,
) {
  return (d.selections[q.id] || []).map((id) =>
    id === "other"
      ? d.other[q.id] || "Autre"
      : q.options?.find((o) => o.id === id)?.label || id,
  );
}
export function intakeExperience(d: IntakeAnswers) {
  return d.role === "mentor"
    ? { "6to12": 6, "1to2": 12, "2to5": 24, over5: 60 }[
        d.selections.experience?.[0] || ""
      ] || 0
    : 0;
}
export function intakeCapacity(d: IntakeAnswers) {
  return ["1", "2", "3"].includes(d.selections.capacity?.[0])
    ? Number(d.selections.capacity[0])
    : d.capacityExact || 1;
}
export function publicIntake(d: IntakeAnswers) {
  const { budget, ...selections } = d.selections;
  const { budget: budgetText, ...custom } = d.other;
  void budget;
  void budgetText;
  return { version: 2 as const, role: d.role, selections, other: custom };
}
export type PublicIntake = ReturnType<typeof publicIntake>;
export function publicIntakeText(d: PublicIntake) {
  return intakeQuestions(d as IntakeAnswers)
    .filter((q) => q.id !== "budget" && q.kind !== "money")
    .flatMap((q) => answerLabels(d, q))
    .join(" ");
}
