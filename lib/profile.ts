import { z } from "zod";
export const specialties = [
  "Vintage",
  "Streetwear",
  "Sportswear",
  "Luxe",
  "Sneakers",
  "Généraliste",
] as const;
export const times = [
  "En journée",
  "En soirée",
  "Le week-end",
  "Flexible",
] as const;
export const profileSchema = z
  .object({
    role: z.enum(["mentor", "beginner"]),
    name: z.string().trim().min(2).max(40),
    discord: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(32)
      .regex(
        /^[a-z0-9_.]+$/,
        "Utilise ton nom d’utilisateur Discord, sans @ ni espaces.",
      )
      .refine(
        (v) => !v.includes(".."),
        "Deux points consécutifs ne sont pas autorisés.",
      ),
    discordId: z
      .string()
      .regex(/^\d{17,20}$/)
      .or(z.literal(""))
      .default(""),
    age: z.enum([
      "Non précisé",
      "Moins de 18 ans",
      "18–24 ans",
      "25–34 ans",
      "35 ans et plus",
    ]),
    joined: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .refine(
        (v) => v <= new Date().toISOString().slice(0, 7),
        "La date ne peut pas être dans le futur.",
      ),
    specialty: z.enum(specialties),
    availability: z.enum(times),
    bio: z
      .string()
      .trim()
      .min(20, "Présente-toi en au moins 20 caractères.")
      .max(800),
    goals: z
      .string()
      .trim()
      .min(10, "Précise ton objectif en au moins 10 caractères.")
      .max(500),
    experience: z.coerce.number().int().min(0).max(600),
    revenue: z.enum([
      "Je préfère ne pas préciser",
      "Moins de 1 000 €",
      "1 000–2 000 €",
      "2 000–3 000 €",
      "3 000–5 000 €",
      "5 000 € et plus",
    ]),
    capacity: z.coerce.number().int().min(0).max(10),
    duration: z.enum([
      "2 semaines",
      "1 mois",
      "3 mois",
      "6 mois",
      "Sans durée définie",
    ]),
    references: z.string().trim().max(300),
    budget: z.enum([
      "Non précisé",
      "Moins de 100 €",
      "100–300 €",
      "300–500 €",
      "500 € et plus",
    ]),
    responseTime: z.enum([
      "Sous 24 h",
      "Sous 48 h",
      "Sous 72 h",
      "À convenir ensemble",
    ]),
    visible: z.boolean(),
    consent: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (data.role === "mentor" && data.experience < 6)
      ctx.addIssue({
        code: "custom",
        path: ["experience"],
        message: "Il faut au moins 6 mois d’expérience pour devenir parrain.",
      });
  });
export type ProfileInput = z.infer<typeof profileSchema>;
export type Profile = Omit<ProfileInput, "consent"> & {
  id: string;
  ratingAverage?: number;
  ratingCount?: number;
};
export type PublicProfile = Omit<Profile, "discord" | "discordId">;
export const initialProfile: ProfileInput = {
  role: "beginner",
  name: "",
  discord: "",
  discordId: "",
  age: "Non précisé",
  joined: new Date().toISOString().slice(0, 7),
  specialty: "Généraliste",
  availability: "En soirée",
  bio: "",
  goals: "",
  experience: 0,
  revenue: "Je préfère ne pas préciser",
  capacity: 1,
  duration: "1 mois",
  references: "",
  budget: "Non précisé",
  responseTime: "Sous 48 h",
  visible: true,
  consent: true,
};
export function decode(row: Record<string, unknown>): Profile {
  const details = JSON.parse(String(row.details));
  return {
    ...details,
    id: String(row.id),
    name: String(row.name),
    role: row.role,
    discord: String(row.discord),
    visible: row.visible === 1,
  };
}
export function publicProfile(p: Profile): PublicProfile {
  const { discord, discordId, ...safe } = p;
  void discord;
  void discordId;
  return safe;
}
