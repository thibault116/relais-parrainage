import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const parsed = z
      .object({
        accompanimentId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      return json(
        { error: "Choisis une note entière entre 1 et 5 étoiles." },
        400,
      );
    const updated = await query(
      `UPDATE accompaniments SET rating=$1,rated_at=$2 WHERE id=$3 AND beginner_id=$4 AND status='completed' AND rating IS NULL RETURNING id`,
      [
        parsed.data.rating,
        new Date().toISOString(),
        parsed.data.accompanimentId,
        u.id,
      ],
    );
    if (!updated.length)
      return json(
        {
          error:
            "Tu peux noter une seule fois ton parrain, après la fin d’un accompagnement accepté.",
        },
        409,
      );
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "Impossible d’enregistrer la note." }, 503);
  }
}
