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
    const data = z
      .object({
        profileId: z.string().uuid(),
        reason: z.enum([
          "Comportement inapproprié",
          "Demande d’argent",
          "Informations trompeuses",
          "Autre",
        ]),
        details: z.string().trim().min(20).max(2000),
      })
      .safeParse(await request.json());
    if (!data.success)
      return json({ error: "Décris les faits en 20 à 2 000 caractères." }, 400);
    const rows = await query("SELECT user_id FROM profiles WHERE id=$1", [
      data.data.profileId,
    ]);
    if (!rows.length) return json({ error: "Profil introuvable." }, 404);
    const target = String(rows[0].user_id);
    if (target === u.id)
      return json({ error: "Tu ne peux pas signaler ton propre profil." }, 400);
    const recent = await query(
      "SELECT COUNT(*) AS n FROM reports WHERE reporter_id=$1 AND created_at>$2",
      [u.id, new Date(Date.now() - 86400000).toISOString()],
    );
    if (Number(recent[0].n) >= 5)
      return json(
        {
          error:
            "Tu as déjà envoyé 5 signalements aujourd’hui. Réessaie demain.",
        },
        429,
      );
    await query(
      "INSERT INTO reports (id,reporter_id,target_id,reason,details,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        crypto.randomUUID(),
        u.id,
        target,
        data.data.reason,
        data.data.details,
        new Date().toISOString(),
      ],
    );
    return json({ ok: true }, 201);
  } catch (e) {
    if (/unique|duplicate/i.test(String(e)))
      return json(
        { error: "Ton signalement de ce profil est déjà en cours d’examen." },
        409,
      );
    return json({ error: "Impossible d’envoyer le signalement." }, 503);
  }
}
