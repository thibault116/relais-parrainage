import { z } from "zod";
import { guard, json, user } from "@/lib/http";
import { query } from "@/lib/db";
import {
  pushConfigured,
  subscriptionSchema,
  subscribe,
  removeSubscription,
} from "@/lib/push";
export const runtime = "nodejs";
export async function GET(r: Request) {
  try {
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const devices = await query(
      "SELECT id,label,created_at FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at DESC",
      [u.id],
    );
    const [pref] = await query(
      "SELECT vacancies FROM push_preferences WHERE user_id=$1",
      [u.id],
    );
    return json({
      configured: pushConfigured(),
      publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
      devices,
      vacancies: !!Number(pref?.vacancies),
    });
  } catch {
    return json(
      { error: "Impossible de charger les notifications push." },
      503,
    );
  }
}
export async function POST(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    if (!pushConfigured())
      return json(
        {
          error:
            "Les notifications push ne sont pas encore configurées sur le serveur.",
        },
        503,
      );
    const parsed = z
      .object({
        subscription: subscriptionSchema,
        label: z.string().trim().min(1).max(80),
      })
      .strict()
      .safeParse(await r.json());
    if (!parsed.success) return json({ error: "Abonnement invalide." }, 400);
    const count = await query(
      "SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=$1",
      [u.id],
    );
    if (Number(count[0].n) >= 20)
      return json(
        {
          error: "Limite de 20 appareils atteinte. Retire un ancien appareil.",
        },
        409,
      );
    const id = await subscribe(
      u.id,
      parsed.data.subscription,
      parsed.data.label,
    );
    return json({ ok: true, id });
  } catch (e) {
    return json(
      {
        error:
          (e as Error).message === "DEVICE_BOUND"
            ? "Cet appareil est associé à un autre compte. Désactive puis réactive les notifications sur cet appareil."
            : "Enregistrement impossible.",
      },
      (e as Error).message === "DEVICE_BOUND" ? 409 : 503,
    );
  }
}
export async function DELETE(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const data = z
      .object({
        id: z.string().uuid().optional(),
        all: z.literal(true).optional(),
      })
      .strict()
      .safeParse(await r.json());
    if (!data.success || (!data.data.id && !data.data.all))
      return json({ error: "Choisis un appareil." }, 400);
    await removeSubscription(u.id, data.data.all ? undefined : data.data.id);
    return json({ ok: true });
  } catch {
    return json({ error: "Suppression impossible." }, 503);
  }
}
export async function PATCH(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const data = z
      .object({ vacancies: z.boolean() })
      .strict()
      .safeParse(await r.json());
    if (!data.success) return json({ error: "Préférence invalide." }, 400);
    await query(
      "INSERT INTO push_preferences(user_id,vacancies) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET vacancies=excluded.vacancies",
      [u.id, data.data.vacancies ? 1 : 0],
    );
    return json({ ok: true });
  } catch {
    return json({ error: "Enregistrement impossible." }, 503);
  }
}
