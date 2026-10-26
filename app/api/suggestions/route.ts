import { readPlatformSettings } from "@/lib/platform-settings";
import { query } from "@/lib/db";
import { guard, json, user, sameOrigin } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import {
  saveProof,
  readProof,
  deleteProof,
  detectProofType,
} from "@/lib/proof-storage";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({
  id: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(5, "Décris ton idée en quelques mots.")
    .max(5000),
  page: z
    .enum([
      "home",
      "directory",
      "guide",
      "faq",
      "profile",
      "moderation",
      "help",
      "",
    ])
    .default(""),
});
export async function POST(request: Request) {
  let path: string | undefined;
  try {
    if (!sameOrigin(request)) return json({ error: "Origine refusée." }, 403);
    const u = await user(request);
    if (!u)
      return json({ error: "Connecte-toi pour envoyer ta suggestion." }, 401);
    if (Number(request.headers.get("content-length")) > 4_300_000)
      return json(
        { error: "Pièce jointe trop volumineuse (4 Mo maximum)." },
        413,
      );
    if (!(await readPlatformSettings()).settings.suggestionsEnabled)
      return json(
        { error: "Les suggestions sont temporairement désactivées." },
        403,
      );
    const form = await request.formData(),
      parsed = schema.safeParse({
        id: form.get("id"),
        message: form.get("message"),
        page: form.get("page") || "",
      });
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const d = parsed.data;
    const existing = (
      await query("SELECT user_id FROM suggestions WHERE id=$1", [d.id])
    )[0];
    if (existing)
      return existing.user_id === u.id
        ? json({ ok: true }, 201)
        : json({ error: "Réessaie l’envoi." }, 409);
    const count = Number(
      (
        await query(
          "SELECT COUNT(*) AS n FROM suggestions WHERE user_id=$1 AND created_at>$2",
          [u.id, new Date(Date.now() - 86400000).toISOString()],
        )
      )[0].n,
    );
    if (count >= 5)
      return json(
        {
          error:
            "Tu as déjà envoyé 5 suggestions aujourd’hui. Réessaie demain.",
        },
        429,
      );
    let attachment = null;
    const file = form.get("file");
    if (file instanceof File && file.size) {
      if (file.size > 4 * 1024 * 1024)
        return json({ error: "Choisis un fichier de 4 Mo maximum." }, 400);
      const bytes = Buffer.from(await file.arrayBuffer()),
        mime = detectProofType(bytes);
      if (!mime)
        return json(
          { error: "Formats acceptés : JPEG, PNG, WebP, GIF, HEIC ou PDF." },
          400,
        );
      path = await saveProof(crypto.randomUUID(), bytes, mime);
      attachment = {
        path,
        name:
          file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180) ||
          "piece-jointe",
        mime,
        size: file.size,
      };
    }
    const saved = await query(
      "INSERT INTO suggestions (id,user_id,message,page,attachment,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING id",
      [
        d.id,
        u.id,
        d.message,
        d.page,
        attachment ? JSON.stringify(attachment) : null,
        new Date().toISOString(),
      ],
    );
    if (!saved.length && path) await deleteProof(path);
    return json({ ok: true }, 201);
  } catch {
    if (path) await deleteProof(path).catch(() => {});
    return json(
      {
        error:
          "Envoi impossible. Ta suggestion est conservée dans le formulaire, réessaie.",
      },
      503,
    );
  }
}
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const url = new URL(request.url),
      id = url.searchParams.get("file");
    if (id) {
      const row = (
        await query("SELECT attachment FROM suggestions WHERE id=$1", [id])
      )[0];
      const a = row?.attachment && JSON.parse(String(row.attachment));
      if (!a) return json({ error: "Fichier introuvable." }, 404);
      const body = await readProof(a.path);
      if (!body) return json({ error: "Fichier introuvable." }, 404);
      return new Response(body, {
        headers: {
          "Content-Type": a.mime,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    const page = Math.max(
      0,
      Math.floor(Number(url.searchParams.get("page")) || 0),
    );
    const rows = await query(
      "SELECT s.*,u.name,u.email FROM suggestions s LEFT JOIN \"user\" u ON u.id=s.user_id ORDER BY CASE WHEN s.status='new' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 30 OFFSET $1",
      [page * 30],
    );
    const count = (await query("SELECT COUNT(*) AS total FROM suggestions"))[0];
    return json({
      total: Number(count.total),
      items: rows.map((r) => {
        const a = r.attachment && JSON.parse(String(r.attachment));
        return { ...r, attachment: a ? { name: a.name, size: a.size } : null };
      }),
    });
  } catch {
    return json({ error: "Impossible de charger les suggestions." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const d = z
      .object({ id: z.string().uuid(), status: z.enum(["new", "reviewed"]) })
      .safeParse(await request.json());
    if (!d.success) return json({ error: "Décision invalide." }, 400);
    const rows = await query(
      "UPDATE suggestions SET status=$1 WHERE id=$2 RETURNING id",
      [d.data.status, d.data.id],
    );
    return rows.length
      ? json({ ok: true })
      : json({ error: "Suggestion introuvable." }, 404);
  } catch {
    return json({ error: "Modification impossible." }, 503);
  }
}
