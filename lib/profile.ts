import { normalizeDate } from "./profile-dates";
import { z } from "zod";
export const specialties = [
  "Vintage",
  "Bot",
  "Brocante",
  "Fournisseur",
  "Délégation",
  "Luxe",
  "Sneakers",
  "Généraliste",
  "Expert en photo",
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
    specialty: z
      .array(z.enum(specialties))
      .min(1, "Choisis au moins une spécialité.")
      .max(specialties.length)
      .transform((v) => [...new Set(v)]),
    teaching: z.string().trim().max(500).default(""),
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
      "5 000–7 000 €",
      "7 000–10 000 €",
      "10 000 € et plus",
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
  memberSince?: string | null;
  lastActiveAt?: string | null;
  availableSince?: string | null;
  photo?: string;
  followerCount?: number;
  followingCount?: number;
  verification?: {
    sales: number | null;
    specialties: string[];
    reviewedAt: string;
  } | null;
  completedCount?: number;
  activeCount?: number;
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
  specialty: ["Généraliste"],
  teaching: "",
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
  delete details.joined;
  details.specialty = (
    Array.isArray(details.specialty) ? details.specialty : [details.specialty]
  ).filter((s: string) => (specialties as readonly string[]).includes(s));
  details.teaching ||= "";
  if (details.revenue === "5 000 € et plus")
    details.revenue = "Je préfère ne pas préciser";
  return {
    ...details,
    memberSince: normalizeDate(row.member_since),
    lastActiveAt: normalizeDate(row.last_active_at),
    availableSince: normalizeDate(row.available_since),
    followerCount: Number(row.follower_count) || 0,
    followingCount: Number(row.following_count) || 0,
    photo: details.photo?.path
      ? `/api/profile-photo?id=${row.id}&v=${details.photo.version}`
      : undefined,
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
