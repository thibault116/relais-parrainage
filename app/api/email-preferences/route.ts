import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const row = (
      await query("SELECT * FROM email_preferences WHERE user_id=$1", [u.id])
    )[0];
    return json({
      enabled: row ? !!Number(row.enabled) : true,
      vacancies: row ? !!Number(row.vacancies) : true,
    });
  } catch {
    return json({ error: "Impossible de charger tes préférences." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const parsed = z
      .object({ enabled: z.boolean(), vacancies: z.boolean() })
      .safeParse(await request.json());
    if (!parsed.success)
      return json({ error: "Choisis des préférences valides." }, 400);
    const { enabled, vacancies } = parsed.data;
    await query(
      "INSERT INTO email_preferences(user_id,enabled,vacancies) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,vacancies=excluded.vacancies",
      [u.id, enabled ? 1 : 0, vacancies ? 1 : 0],
    );
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de sauvegarder tes préférences." }, 503);
  }
}
