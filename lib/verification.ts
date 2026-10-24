import { query } from "./db";
export { dossierSchema } from "./verification-form";
export async function isModerator(id: string) {
  return (
    (await query("SELECT user_id FROM moderators WHERE user_id=$1", [id]))
      .length > 0
  );
}
export function publicVerification(row: Record<string, unknown> | undefined) {
  if (!row || row.status !== "approved") return null;
  return {
    sales: row.verified_sales === null ? null : Number(row.verified_sales),
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
