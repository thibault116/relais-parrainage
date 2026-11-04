import { after } from "next/server";
import { guard, json, user, sameOrigin } from "@/lib/http";
import { query, inTransaction } from "@/lib/db";
import { canUseFeature } from "@/lib/beta";
import {
  chatAccess,
  connectChat,
  listChats,
  mobileMember,
  sendPrivate,
} from "@/lib/mobile-space";
import {
  saveProof,
  readProof,
  deleteProof,
  detectProofType,
} from "@/lib/proof-storage";
import { runPushWorker } from "@/lib/push";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
async function account(r: Request) {
  const u = await user(r);
  if (!u) throw Error("AUTH");
  if (!(await canUseFeature(u.id, "privateMessaging"))) throw Error("BETA");
  await mobileMember(u.id);
  return u;
}
function failure(e: unknown) {
  const code = String(e);
  return json(
    {
      error: code.includes("RATE")
        ? "Patiente quelques secondes avant de réessayer."
        : code.includes("BETA")
          ? "La messagerie privée est disponible en bêta."
          : code.includes("AUTH")
            ? "Connexion requise."
            : "Conversation indisponible ou action non autorisée.",
    },
    code.includes("AUTH") ? 401 : code.includes("RATE") ? 429 : 403,
  );
}
export async function GET(r: Request) {
  try {
    const u = await account(r),
      url = new URL(r.url),
      id = url.searchParams.get("chat"),
      file = url.searchParams.get("file");
    if (file) {
      const [m] = await query("SELECT * FROM private_messages WHERE id=$1", [
        file,
      ]);
      if (!m) throw Error("ACCESS");
      await chatAccess(u.id, String(m.chat_id));
      if (!m.file_path) throw Error("ACCESS");
      const content = await readProof(String(m.file_path));
      if (!content) throw Error("ACCESS");
      return new Response(content, {
        headers: {
          "Content-Type": String(m.file_mime),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    if (!id) return json({ chats: await listChats(u.id) });
    const c = await chatAccess(u.id, id);
    if (c.status !== "accepted")
      return json({ chat: c, messages: [], hasOlder: false });
    const before = url.searchParams.get("before") || "";
    const rows = await query(
      `SELECT m.id,m.body,m.created_at,CASE WHEN m.author_id=$2 THEN 1 ELSE 0 END AS mine,CASE WHEN m.file_path IS NULL THEN 0 ELSE 1 END AS image FROM private_messages m WHERE m.chat_id=$1 AND ($3='' OR EXISTS(SELECT 1 FROM private_messages ref WHERE ref.id=$3 AND ref.chat_id=$1 AND (m.created_at<ref.created_at OR (m.created_at=ref.created_at AND m.id<ref.id)))) ORDER BY m.created_at DESC,m.id DESC LIMIT 51`,
      [id, u.id, before],
    );
    return json({
      chat: { id: c.id, canSend: c.canSend, status: c.status },
      messages: rows.slice(0, 50).reverse(),
      hasOlder: rows.length > 50,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  let saved: string | undefined;
  try {
    if (!sameOrigin(r)) throw Error("ACCESS");
    const u = await account(r);
    if (r.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (Number(r.headers.get("content-length")) > 4300000)
        return json({ error: "Image trop volumineuse (4 Mo maximum)." }, 413);
      const form = await r.formData(),
        file = form.get("file"),
        id = String(form.get("chat") || ""),
        body = String(form.get("body") || "").trim();
      if (!(file instanceof File) || file.size > 4000000 || body.length > 3000)
        throw Error("ACCESS");
      const c = await chatAccess(u.id, id);
      if (!c.canSend) throw Error("ACCESS");
      const bytes = Buffer.from(await file.arrayBuffer()),
        mime = detectProofType(bytes);
      if (
        !mime ||
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
      )
        return json({ error: "Choisis une image JPG, PNG, WebP ou GIF." }, 400);
      saved = await saveProof(crypto.randomUUID(), bytes, mime);
      const message = await sendPrivate(u.id, id, body || "Photo", {
        path: saved,
        mime,
      });
      saved = undefined;
      after(() => runPushWorker(message));
      return json({ ok: true }, 201);
    }
    const g = await guard(r);
    if (g) return g;
    const parsed = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("connect"),
          profileId: z.string().uuid(),
        }),
        z.object({
          action: z.literal("send"),
          id: z.string().length(64),
          body: z.string().trim().min(1).max(3000),
        }),
        z.object({
          action: z.enum([
            "accept",
            "decline",
            "read",
            "pin",
            "block",
            "unblock",
          ]),
          id: z.string().length(64),
          value: z.boolean().optional(),
        }),
      ])
      .safeParse(await r.json());
    if (!parsed.success) return json({ error: "Données invalides." }, 400);
    const d = parsed.data;
    if (d.action === "connect")
      return json({ id: await connectChat(u.id, d.profileId) }, 201);
    const c = await chatAccess(u.id, d.id);
    if (d.action === "send") {
      const id = await sendPrivate(u.id, d.id, d.body);
      after(() => runPushWorker(id));
      return json({ ok: true }, 201);
    }
    if (d.action === "accept" || d.action === "decline") {
      const result = await query(
        `UPDATE private_chats SET status=$3 WHERE id=$1 AND (user_a=$2 OR user_b=$2) AND requested_by<>$2 AND status='pending' RETURNING id`,
        [d.id, u.id, d.action === "accept" ? "accepted" : "declined"],
      );
      if (!result.length) throw Error("ACCESS");
    }
    if (d.action === "block" || d.action === "unblock")
      await inTransaction(async (q) => {
        await q("UPDATE private_chats SET status=status WHERE id=$1", [d.id]);
        if (d.action === "block")
          await q(
            "INSERT INTO member_blocks(user_id,target_id) VALUES($1,$2) ON CONFLICT(user_id,target_id) DO NOTHING",
            [u.id, c.other],
          );
        else
          await q(
            "DELETE FROM member_blocks WHERE user_id=$1 AND target_id=$2",
            [u.id, c.other],
          );
      });
    if (d.action === "pin" || d.action === "read") {
      await query(
        `INSERT INTO private_chat_preferences(user_id,chat_id,pinned,read_at) VALUES($1,$2,0,'') ON CONFLICT(user_id,chat_id) DO NOTHING`,
        [u.id, d.id],
      );
      if (d.action === "pin")
        await query(
          "UPDATE private_chat_preferences SET pinned=$3 WHERE user_id=$1 AND chat_id=$2",
          [u.id, d.id, d.value ? 1 : 0],
        );
      else
        await query(
          "UPDATE private_chat_preferences SET read_at=$3 WHERE user_id=$1 AND chat_id=$2",
          [u.id, d.id, new Date().toISOString()],
        );
    }
    return json({ ok: true });
  } catch (e) {
    if (saved) await deleteProof(saved).catch(() => {});
    return failure(e);
  }
}
