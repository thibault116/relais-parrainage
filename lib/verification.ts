import { query } from "./db";
import { z } from "zod";
import { specialties } from "./profile";
export const dossierSchema = z.object({
  sales: z.number().int().min(1).max(1000000),
  specialties: z.array(z.enum(specialties)).min(1).max(6),
  experience: z.string().trim().min(50).max(2000),
  example: z.string().trim().min(80).max(2000),
  evidence: z
    .array(
      z
        .string()
        .url()
        .max(1000)
        .refine(
          (v) => new URL(v).protocol === "https:",
          "Utilise un lien HTTPS.",
        ),
    )
    .min(1)
    .max(5),
  consent: z.literal(true),
});
export async function isModerator(id: string) {
  return (
    (await query("SELECT user_id FROM moderators WHERE user_id=$1", [id]))
      .length > 0
  );
}
export function publicVerification(row: Record<string, unknown> | undefined) {
  if (!row || row.status !== "approved") return null;
  return {
    sales: Number(row.verified_sales),
    specialties: JSON.parse(
      String(row.verified_specialties || "[]"),
    ) as string[],
    reviewedAt: String(row.reviewed_at),
  };
}
export async function getPublicVerifications(ids: string[]) {
  if (!ids.length) return new Map();
  const rows = await query(
    `SELECT user_id,status,verified_sales,verified_specialties,reviewed_at FROM verifications WHERE status='approved' AND user_id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
    ids,
  );
  return new Map(rows.map((r) => [String(r.user_id), publicVerification(r)]));
}
