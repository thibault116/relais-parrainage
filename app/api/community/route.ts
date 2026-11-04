import { query } from "@/lib/db";
import { after } from "next/server";
import { runPushWorker } from "@/lib/push";
import { canUseFeature } from "@/lib/beta";
import { guard, json, user } from "@/lib/http";
import {
  editCommunity,
  communityAccess,
  communityMessages,
  communityMembers,
  communityUnread,
  postCommunity,
  readCommunity,
  deleteCommunity,
} from "@/lib/community";

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
    if (params.has("channels"))
      return json({
        channels: await query(
          "SELECT id,name,description FROM community_channels ORDER BY position,name",
        ),
        canManage:
          (
            await query("SELECT user_id FROM moderators WHERE user_id=$1", [
              u.id,
            ])
          ).length > 0,
      });
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
      canPost: true,
      ...(await communityMessages(
        u.id,
        before,
        params.get("mentions") === "1",
        (await canUseFeature(u.id, "communityChannels"))
          ? params.get("channel") || ""
          : "",
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
    const input = await request.json();
    if (method === "POST" && input.action === "createChannel") {
      if (
        !(
          await query("SELECT user_id FROM moderators WHERE user_id=$1", [u.id])
        ).length
      )
        return json({ error: "Accès réservé à l’administration." }, 403);
      const data = z
        .object({
          action: z.literal("createChannel"),
          name: z.string().trim().min(2).max(40),
          description: z.string().trim().max(100).default(""),
        })
        .strict()
        .safeParse(input);
      if (!data.success)
        return json({ error: "Choisis un nom de 2 à 40 caractères." }, 400);
      const id = crypto.randomUUID();
      await query(
        "INSERT INTO community_channels(id,name,description,position) VALUES($1,$2,$3,100)",
        [id, data.data.name, data.data.description],
      );
      return json({ id }, 201);
    }
    const schema =
      method === "POST"
        ? z
            .object({
              channel: z.string().min(1).max(64).optional(),
              replyTo: z.string().uuid().nullable().optional(),
              body: z.string().trim().min(1).max(3000),
              mentions: z.array(z.string().min(1).max(200)).max(10).default([]),
            })
            .strict()
        : method === "PUT"
          ? z
              .object({
                id: z.string().uuid(),
                body: z.string().trim().min(1).max(3000),
              })
              .strict()
          : method === "PATCH"
            ? z.object({ ids: z.array(z.string().uuid()).max(50) }).strict()
            : z.object({ id: z.string().uuid() }).strict();
    const parsed = schema.safeParse(input);
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
      const data = parsed.data as {
        channel?: string;
        body: string;
        mentions: string[];
        replyTo?: string | null;
      };
      if (data.replyTo && !(await canUseFeature(u.id, "communityReplies")))
        return json({ error: "Les réponses sont disponibles en bêta." }, 403);
      if (
        data.channel &&
        data.channel !== "general" &&
        !(await canUseFeature(u.id, "communityChannels"))
      )
        return json({ error: "Ces rubriques sont disponibles en bêta." }, 403);
      if (
        !(
          await query("SELECT id FROM community_channels WHERE id=$1", [
            data.channel || "general",
          ])
        ).length
      )
        return json({ error: "Salon introuvable." }, 400);
      const id = await postCommunity(
        u.id,
        data.body,
        [...new Set(data.mentions)],
        data.replyTo || null,
        data.channel || "general",
      );
      after(async () => {
        try {
          const result = await runPushWorker(id);
          if (!result.configured)
            console.error("COMMUNITY_PUSH_NOT_CONFIGURED");
        } catch {
          console.error("COMMUNITY_PUSH_FAILED");
        }
      });
      return json({ id }, 201);
    }
    if (method === "PUT") {
      if (!(await canUseFeature(u.id, "communityEditing")))
        return json(
          { error: "La modification des messages est disponible en bêta." },
          403,
        );
      const data = parsed.data as { id: string; body: string };
      await editCommunity(u.id, data.id, data.body);
      return json({ ok: true });
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
    if (code === "ACCESS" || code === "MENTION" || code === "REPLY")
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

export const PUT = (r: Request) => mutate(r, "PUT");
export const maxDuration = 60;
