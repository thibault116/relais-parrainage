import { guard, json, user } from "@/lib/http";
import {
  communityAccess,
  communityMessages,
  communityMembers,
  communityUnread,
  postCommunity,
  readCommunity,
  deleteCommunity,
} from "@/lib/community";
import { sendEmailsAfterResponse } from "@/lib/email-after";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const access = await communityAccess(u.id);
    if (!access)
      return json(
        { error: "Complète ton profil pour rejoindre ta communauté." },
        403,
      );
    const params = new URL(request.url).searchParams;
    if (params.has("members"))
      return json({
        members: await communityMembers(
          u.id,
          (params.get("members") || "").slice(0, 80),
        ),
      });
    if (params.has("summary"))
      return json({ unread: await communityUnread(u.id) });
    const before = params.get("before") || "";
    if (before && !z.string().uuid().safeParse(before).success)
      return json({ error: "Page invalide." }, 400);
    return json({
      role: access.role,
      ...(await communityMessages(
        u.id,
        before,
        params.get("mentions") === "1",
      )),
      unread: await communityUnread(u.id),
    });
  } catch {
    return json(
      { error: "Impossible de charger la communauté. Réessaie." },
      503,
    );
  }
}
async function mutate(request: Request, method: string) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const schema =
      method === "POST"
        ? z
            .object({
              body: z.string().trim().min(1).max(3000),
              mentions: z.array(z.string().min(1).max(200)).max(10).default([]),
            })
            .strict()
        : method === "PATCH"
          ? z.object({ ids: z.array(z.string().uuid()).max(50) }).strict()
          : z.object({ id: z.string().uuid() }).strict();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return json(
        {
          error: "Message invalide (3 000 caractères et 10 mentions maximum).",
        },
        400,
      );
    if (!(await communityAccess(u.id)))
      return json({ error: "Accès indisponible." }, 403);
    if (method === "POST") {
      const data = parsed.data as { body: string; mentions: string[] };
      const id = await postCommunity(u.id, data.body, [
        ...new Set(data.mentions),
      ]);
      sendEmailsAfterResponse();
      return json({ id }, 201);
    }
    if (method === "PATCH") {
      await readCommunity(u.id, (parsed.data as { ids: string[] }).ids);
      return json({ ok: true });
    }
    const rows = await deleteCommunity(
      u.id,
      (parsed.data as { id: string }).id,
    );
    return rows.length
      ? json({ ok: true })
      : json({ error: "Action non autorisée." }, 403);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "RATE")
      return json(
        { error: "Patiente quelques secondes avant ton prochain message." },
        429,
      );
    if (code === "ACCESS" || code === "MENTION")
      return json(
        {
          error:
            "Ce membre ne fait pas partie de ton espace ou n’est plus disponible.",
        },
        403,
      );
    return json({ error: "Impossible d’enregistrer. Réessaie." }, 503);
  }
}
export const POST = (r: Request) => mutate(r, "POST");
export const PATCH = (r: Request) => mutate(r, "PATCH");
export const DELETE = (r: Request) => mutate(r, "DELETE");
