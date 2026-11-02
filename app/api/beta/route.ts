import { guard, json, user } from "@/lib/http";
import { query } from "@/lib/db";
import { isBetaTester } from "@/lib/beta";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    return json({ enabled: await isBetaTester(u.id) });
  } catch {
    return json({ error: "Impossible de charger le statut bêta." }, 503);
  }
}
export async function PUT(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const parsed = z
      .object({ enabled: z.boolean() })
      .strict()
      .safeParse(await request.json());
    if (!parsed.success) return json({ error: "Choix invalide." }, 400);
    if (
      (
        await query("SELECT user_id FROM profile_blocks WHERE user_id=$1", [
          u.id,
        ])
      ).length
    )
      return json({ error: "Compte suspendu." }, 403);
    await query(
      `INSERT INTO beta_preferences(user_id,enabled,updated_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`,
      [u.id, parsed.data.enabled ? 1 : 0, new Date().toISOString()],
    );
    return json({ enabled: parsed.data.enabled });
  } catch {
    return json(
      { error: "Impossible d’enregistrer ton choix. Réessaie." },
      503,
    );
  }
}
