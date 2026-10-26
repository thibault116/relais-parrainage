import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import { settingsSchema } from "@/lib/platform-config";
import { readPlatformSettings } from "@/lib/platform-settings";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    return json(await readPlatformSettings());
  } catch {
    return json({ error: "Impossible de charger les paramètres." }, 503);
  }
}
export async function PUT(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const parsed = z
      .object({ settings: settingsSchema, revision: z.string().uuid() })
      .safeParse(await request.json());
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const revision = crypto.randomUUID(),
      updatedAt = new Date().toISOString();
    const rows = await query(
      "UPDATE platform_settings SET data=$1,revision=$2,updated_at=$3,updated_by=$4 WHERE id='main' AND revision=$5 RETURNING id",
      [
        JSON.stringify(parsed.data.settings),
        revision,
        updatedAt,
        u.id,
        parsed.data.revision,
      ],
    );
    if (!rows.length)
      return json(
        {
          error:
            "Les paramètres ont été modifiés ailleurs. Recharge-les avant de réessayer.",
        },
        409,
      );
    return json({ settings: parsed.data.settings, revision, updatedAt });
  } catch {
    return json({ error: "Impossible d’enregistrer les paramètres." }, 503);
  }
}
