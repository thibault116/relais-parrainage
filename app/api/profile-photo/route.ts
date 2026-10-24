import { query } from "@/lib/db";
import { json, user, sameOrigin } from "@/lib/http";
import {
  saveProof,
  readProof,
  deleteProof,
  detectProofType,
} from "@/lib/proof-storage";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const row = (
      await query(
        "SELECT p.*, (SELECT COUNT(*) FROM profile_blocks b WHERE b.user_id=p.user_id) AS blocked FROM profiles p WHERE id=$1",
        [id],
      )
    )[0];
    if (!row) return json({ error: "Photo introuvable." }, 404);
    if (row.visible !== 1 || Number(row.blocked)) {
      const u = await user(request);
      if (u?.id !== row.user_id)
        return json({ error: "Photo introuvable." }, 404);
    }
    const photo = JSON.parse(String(row.details)).photo;
    if (!photo?.path) return json({ error: "Photo introuvable." }, 404);
    const body = await readProof(photo.path);
    if (!body) return json({ error: "Photo introuvable." }, 404);
    return new Response(body, {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return json({ error: "Photo indisponible." }, 503);
  }
}
async function change(request: Request, remove = false) {
  let saved: string | undefined;
  try {
    if (!sameOrigin(request)) return json({ error: "Origine refusée." }, 403);
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const row = (
      await query("SELECT id,details FROM profiles WHERE user_id=$1", [u.id])
    )[0];
    if (!row)
      return json({ error: "Crée ton profil avant d’ajouter une photo." }, 400);
    const details = JSON.parse(String(row.details)),
      old = details.photo;
    if (remove) delete details.photo;
    else {
      if (Number(request.headers.get("content-length")) > 4_300_000)
        return json({ error: "Photo trop volumineuse (4 Mo maximum)." }, 413);
      const file = (await request.formData()).get("file");
      if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
        return json({ error: "Choisis une photo de 4 Mo maximum." }, 400);
      const bytes = Buffer.from(await file.arrayBuffer()),
        mime = detectProofType(bytes);
      if (!mime || !["image/jpeg", "image/png", "image/webp"].includes(mime))
        return json({ error: "Choisis une image JPEG, PNG ou WebP." }, 400);
      saved = await saveProof(crypto.randomUUID(), bytes, mime);
      details.photo = { path: saved, mime, version: crypto.randomUUID() };
    }
    const changed = await query(
      "UPDATE profiles SET details=$1 WHERE user_id=$2 AND details=$3 RETURNING id",
      [JSON.stringify(details), u.id, String(row.details)],
    );
    if (!changed.length) {
      if (saved) await deleteProof(saved);
      return json({ error: "Ton profil a changé. Réessaie." }, 409);
    }
    saved = undefined;
    if (old?.path) await deleteProof(old.path).catch(() => {});
    return json({ ok: true });
  } catch {
    if (saved) await deleteProof(saved).catch(() => {});
    return json({ error: "Impossible de modifier la photo." }, 503);
  }
}
export async function POST(request: Request) {
  return change(request);
}
export async function DELETE(request: Request) {
  return change(request, true);
}
