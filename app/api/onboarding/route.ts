import { json, user } from "@/lib/http";
import { query } from "@/lib/db";
import { isModerator } from "@/lib/verification";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const page = Math.max(
      0,
      Math.floor(Number(new URL(request.url).searchParams.get("page")) || 0),
    );
    const rows = await query(
      `SELECT a.*,p.name,p.role FROM onboarding_answers a JOIN profiles p ON p.user_id=a.user_id ORDER BY a.updated_at DESC LIMIT 21 OFFSET $1`,
      [page * 20],
    );
    return json({
      hasMore: rows.length > 20,
      items: rows
        .slice(0, 20)
        .map((row) => ({
          name: row.name,
          userId: row.user_id,
          answers: JSON.parse(String(row.answers)),
        })),
    });
  } catch {
    return json({ error: "Impossible de charger les questionnaires." }, 503);
  }
}
