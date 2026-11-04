import { z } from "zod";
export const categories = [
  "Luxe",
  "Sneakers",
  "Vintage",
  "Streetwear",
  "Workwear",
  "Autre",
] as const;
export const supportTypes = [
  "Conseils ponctuels",
  "Suivi régulier",
  "Un objectif avec des tâches",
  "Autre",
] as const;
const text = z.string().trim();
const money = z.number().finite().min(0).max(1_000_000_000);
const common = {
  version: z.literal(1),
  categories: z
    .array(z.enum(categories))
    .min(1, "Choisis au moins une catégorie.")
    .max(6),
  categoryOther: text.max(150).default(""),
};
export const onboardingSchema = z
  .discriminatedUnion("role", [
    z.object({
      ...common,
      role: z.literal("mentor"),
      started: text.regex(/^\d{4}-\d{2}$/, "Indique ton mois de début."),
      record: money,
      specialtyOther: text.max(150).default(""),
      platforms: text.min(3, "Indique tes plateformes de vente.").max(300),
      brands: text
        .min(
          10,
          "Décris les marques et références testées (10 caractères minimum).",
        )
        .max(1500),
      model: z.enum(["Niche", "Gros", "Les deux", "Autre"]),
      modelOther: text.max(150).default(""),
      audience: z
        .array(z.enum(["Débutants", "Revendeurs confirmés"]))
        .min(1, "Choisis les profils que tu souhaites accompagner.")
        .max(2),
      calls: z.boolean(),
      flexText: text.max(2000).default(""),
      flexFile: z.string().uuid().or(z.literal("")).default(""),
      months: z
        .array(
          z.object({
            month: text.regex(/^\d{4}-\d{2}$/),
            revenue: money,
            profit: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
            basket: money,
            roi: z.number().finite().min(-100).max(1_000_000),
            files: z
              .array(z.string().uuid())
              .min(1, "Ajoute une capture pour chaque mois.")
              .max(3),
          }),
        )
        .max(6)
        .default([]),
    }),
    z.object({
      ...common,
      role: z.literal("beginner"),
      experienceText: text
        .min(30, "Décris ton niveau en au moins 30 caractères.")
        .max(1500),
      objectives: text
        .min(30, "Décris tes objectifs en au moins 30 caractères.")
        .max(1500),
      support: z
        .array(z.enum(supportTypes))
        .min(1, "Choisis ton accompagnement.")
        .max(4),
      supportOther: text.max(200).default(""),
      blocker: text
        .min(30, "Décris ton principal blocage en au moins 30 caractères.")
        .max(1500),
      exchange: z.enum(["Appel", "Message vocal"]),
      cash: money,
    }),
  ])
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (d.categories.includes("Autre") && d.categoryOther.length < 3)
      issue("categoryOther", "Précise l’autre catégorie.");
    if (d.role === "mentor") {
      if (d.model === "Autre" && d.modelOther.length < 3)
        issue("modelOther", "Précise ton activité.");
      if (!d.flexFile && d.flexText.length < 10)
        issue(
          "flexText",
          "Décris ta plus belle réussite (10 caractères minimum) ou ajoute une image.",
        );
    } else if (d.support.includes("Autre") && d.supportOther.length < 3)
      issue("supportOther", "Précise le type d’accompagnement souhaité.");
  });
export type Onboarding = z.infer<typeof onboardingSchema>;
export function completedMonths(now = new Date()) {
  return Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6 + i, 1))
      .toISOString()
      .slice(0, 7),
  );
}
export function monthLabel(month: string) {
  return new Date(month + "-01T12:00:00Z").toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function experienceMonths(start: string, now = new Date()) {
  const [y, m] = start.split("-").map(Number);
  if (m < 1 || m > 12 || y < 1970 || y > now.getUTCFullYear()) return -1;
  return (now.getUTCFullYear() - y) * 12 + now.getUTCMonth() - (m - 1);
}
export function proofIds(d: Onboarding) {
  return d.role === "mentor"
    ? [...d.months.flatMap((m) => m.files), ...(d.flexFile ? [d.flexFile] : [])]
    : [];
}
export function publicAnswers(d: Onboarding) {
  if (d.role === "beginner") return d;
  const { flexFile, months, ...rest } = d;
  return {
    ...rest,
    hasFlexImage: !!flexFile,
    months: months.map(({ files, ...numbers }) => {
      void files;
      return numbers;
    }),
  };
}
export type PublicOnboarding = ReturnType<typeof publicAnswers>;
