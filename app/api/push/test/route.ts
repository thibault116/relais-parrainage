import { guard, json, user } from "@/lib/http";
import { query } from "@/lib/db";
import {
  pushConfigured,
  pushMessages,
  sendPush,
  removeSubscription,
} from "@/lib/push";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    if (!pushConfigured())
      return json(
        { error: "Les notifications push ne sont pas encore configurées." },
        503,
      );
    const data = z
      .object({ id: z.string().uuid() })
      .strict()
      .safeParse(await r.json());
    if (!data.success) return json({ error: "Appareil invalide." }, 400);
    const [sub] = await query(
      "UPDATE push_subscriptions SET last_test_at=$3 WHERE id=$1 AND user_id=$2 AND last_test_at<$4 RETURNING *",
      [
        data.data.id,
        u.id,
        new Date().toISOString(),
        new Date(Date.now() - 60000).toISOString(),
      ],
    );
    if (!sub)
      return json(
        {
          error:
            "Appareil indisponible ou test déjà envoyé. Patiente une minute.",
        },
        429,
      );
    try {
      await sendPush(sub, {
        ...pushMessages.test,
        url: "/?profileTab=emails#profile",
        tag: "mentora-test",
      });
      return json({ ok: true });
    } catch (e) {
      if ([404, 410].includes((e as { statusCode?: number }).statusCode || 0)) {
        await removeSubscription(u.id, data.data.id);
        return json(
          { error: "Cet abonnement a expiré. Réactive les notifications." },
          410,
        );
      }
      throw e;
    }
  } catch {
    return json(
      { error: "Le service push n’a pas accepté le test. Réessaie plus tard." },
      503,
    );
  }
}
