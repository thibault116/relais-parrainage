import { query, acceptAccompaniment } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const rows = await query(
      `SELECT a.id,a.objective,a.status,a.created_at,a.completed_at,a.rating, CASE WHEN a.beginner_id=$1 THEN 'beginner' ELSE 'mentor' END AS side, CASE WHEN a.beginner_id=$1 THEN COALESCE(m.name,'Ancien membre') ELSE COALESCE(b.name,'Ancien membre') END AS partner_name FROM accompaniments a LEFT JOIN profiles m ON m.user_id=a.mentor_id LEFT JOIN profiles b ON b.user_id=a.beginner_id WHERE a.beginner_id=$1 OR a.mentor_id=$1 ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END, a.created_at DESC`,
      [u.id],
    );
    return json({ accompaniments: rows });
  } catch {
    return json({ error: "Impossible de charger les accompagnements." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const input = z
      .object({
        mentorProfileId: z.string().uuid(),
        objective: z.string().trim().min(10).max(2000),
      })
      .safeParse(await request.json());
    if (!input.success)
      return json(
        { error: "Explique ton objectif en 10 à 2 000 caractères." },
        400,
      );
    const own = await query("SELECT role FROM profiles WHERE user_id=$1", [
      u.id,
    ]);
    if (own[0]?.role !== "beginner")
      return json(
        {
          error:
            "Seul un débutant avec un profil peut demander un accompagnement.",
        },
        403,
      );
    const mentors = await query(
      "SELECT user_id,details FROM profiles p WHERE id=$1 AND visible=1 AND role='mentor' AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
      [input.data.mentorProfileId],
    );
    const mentor = mentors[0];
    if (!mentor || Number(JSON.parse(String(mentor.details)).capacity) < 1)
      return json({ error: "Ce parrain n’est plus disponible." }, 404);
    if (mentor.user_id === u.id)
      return json({ error: "Tu ne peux pas être ton propre parrain." }, 400);
    const saved = await query(
      `INSERT INTO accompaniments (id,beginner_id,mentor_id,status,created_at,objective) VALUES ($1,$2,$3,'pending',$4,$5) ON CONFLICT(beginner_id,mentor_id) DO NOTHING RETURNING id`,
      [
        crypto.randomUUID(),
        u.id,
        String(mentor.user_id),
        new Date().toISOString(),
        input.data.objective,
      ],
    );
    if (!saved.length)
      return json(
        {
          error:
            "Un accompagnement existe déjà avec ce parrain. Retrouve-le dans Mon profil.",
        },
        409,
      );
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "Impossible d’envoyer la demande." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const input = z
      .object({
        id: z.string().uuid(),
        action: z.enum(["accept", "decline", "cancel", "complete"]),
      })
      .safeParse(await request.json());
    if (!input.success) return json({ error: "Action invalide." }, 400);
    const { id, action } = input.data;
    if (action === "accept") {
      if (!(await acceptAccompaniment(id, u.id)))
        return json(
          {
            error:
              "Aucune place libre, demande déjà traitée ou action non autorisée. Termine un binôme actif pour libérer une place.",
          },
          409,
        );
      return json({ ok: true });
    }
    const rows =
      action === "complete"
        ? await query(
            `UPDATE accompaniments SET status='completed',completed_at=$1 WHERE id=$2 AND status='active' AND (beginner_id=$3 OR mentor_id=$3) RETURNING id`,
            [new Date().toISOString(), id, u.id],
          )
        : await query(
            `UPDATE accompaniments SET status=$1 WHERE id=$2 AND status='pending' AND ${action === "cancel" ? "beginner_id" : "mentor_id"}=$3 RETURNING id`,
            [action === "decline" ? "declined" : "cancelled", id, u.id],
          );
    if (!rows.length)
      return json(
        {
          error:
            "Cette action n’est pas autorisée ou l’accompagnement a déjà changé.",
        },
        409,
      );
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de modifier l’accompagnement." }, 503);
  }
}
