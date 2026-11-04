import { query, inTransaction } from "@/lib/db";
import { user, json, sameOrigin } from "@/lib/http";
import {
  saveProof,
  readProof,
  deleteProof,
  detectProofType,
} from "@/lib/proof-storage";
export const runtime = "nodejs";
async function owner(r: Request) {
  const u = await user(r);
  if (!u) return null;
  const [p] = await query(
    "SELECT user_id FROM profiles WHERE user_id=$1 AND role='mentor' AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1)",
    [u.id],
  );
  return p ? u : null;
}
export async function GET(r: Request) {
  try {
    const url = new URL(r.url),
      profile = url.searchParams.get("profile"),
      image = url.searchParams.get("image");
    let uid: string;
    if (profile || image) {
      const [p] = await query(
        `SELECT p.user_id,p.visible FROM profiles p WHERE p.role='mentor' AND ${image ? "p.user_id IN(SELECT user_id FROM mentor_portfolio_images WHERE id=$1)" : "p.id=$1"} AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)`,
        [image || profile],
      );
      if (!p) return json({ error: "Profil indisponible." }, 404);
      if (Number(p.visible) !== 1 && (await user(r))?.id !== p.user_id)
        return json({ error: "Profil indisponible." }, 404);
      uid = String(p.user_id);
    } else {
      const u = await owner(r);
      if (!u) return json({ error: "Compte parrain requis." }, 403);
      uid = u.id;
    }
    if (image) {
      const [f] = await query(
        "SELECT stored_path,mime FROM mentor_portfolio_images WHERE id=$1 AND user_id=$2",
        [image, uid],
      );
      if (!f) return json({ error: "Image introuvable." }, 404);
      const body = await readProof(String(f.stored_path));
      return new Response(body, {
        headers: {
          "Content-Type": String(f.mime),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    const [p] = await query(
      "SELECT bio FROM mentor_portfolios WHERE user_id=$1",
      [uid],
    );
    const images = await query(
      "SELECT id FROM mentor_portfolio_images WHERE user_id=$1 ORDER BY created_at,id",
      [uid],
    );
    const bio = String(p?.bio || "");
    return json({
      bio,
      images: images.map((f) => ({
        id: f.id,
        url: "/api/mentor-portfolio?image=" + f.id,
      })),
      complete: bio.trim().length >= 30 && images.length > 0,
    });
  } catch {
    return json({ error: "Impossible de charger le profil." }, 503);
  }
}
export async function POST(r: Request) {
  let path: string | undefined;
  try {
    if (!sameOrigin(r)) return json({ error: "Origine refusée." }, 403);
    const u = await owner(r);
    if (!u) return json({ error: "Compte parrain requis." }, 403);
    if (Number(r.headers.get("content-length")) > 4300000)
      return json({ error: "4 Mo maximum par image." }, 413);
    const data = await r.formData(),
      file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > 4000000)
      return json({ error: "Choisis une image de 4 Mo maximum." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer()),
      mime = detectProofType(bytes);
    if (!mime || !["image/jpeg", "image/png", "image/webp"].includes(mime))
      return json({ error: "Formats acceptés : JPG, PNG et WebP." }, 400);
    const id = crypto.randomUUID();
    path = await saveProof(id, bytes, mime);
    await inTransaction(async (q) => {
      await q("UPDATE profiles SET updated_at=updated_at WHERE user_id=$1", [
        u.id,
      ]);
      const [count] = await q(
        "SELECT COUNT(*) AS n FROM mentor_portfolio_images WHERE user_id=$1",
        [u.id],
      );
      if (Number(count.n) >= 10) throw Error("LIMIT");
      await q(
        "INSERT INTO mentor_portfolio_images(id,user_id,stored_path,mime,created_at) VALUES($1,$2,$3,$4,$5)",
        [id, u.id, path!, mime, new Date().toISOString()],
      );
    });
    path = undefined;
    return json({ id }, 201);
  } catch (e) {
    if (path) await deleteProof(path);
    return json(
      {
        error: String(e).includes("LIMIT")
          ? "Tu peux publier dix images maximum."
          : "Import impossible. Réessaie.",
      },
      String(e).includes("LIMIT") ? 400 : 503,
    );
  }
}
export async function PUT(r: Request) {
  try {
    if (!sameOrigin(r)) return json({ error: "Origine refusée." }, 403);
    const u = await owner(r);
    if (!u) return json({ error: "Compte parrain requis." }, 403);
    const data = await r.json();
    if (typeof data.bio !== "string" || data.bio.trim().length > 1000)
      return json({ error: "Biographie : 1 000 caractères maximum." }, 400);
    await query(
      "INSERT INTO mentor_portfolios(user_id,bio) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio",
      [u.id, data.bio.trim()],
    );
    return json({ ok: true });
  } catch {
    return json({ error: "Enregistrement impossible." }, 503);
  }
}
export async function DELETE(r: Request) {
  try {
    if (!sameOrigin(r)) return json({ error: "Origine refusée." }, 403);
    const u = await owner(r);
    if (!u) return json({ error: "Compte parrain requis." }, 403);
    const { id } = await r.json();
    const rows = await query(
      "DELETE FROM mentor_portfolio_images WHERE id=$1 AND user_id=$2 RETURNING stored_path",
      [id, u.id],
    );
    for (const f of rows) await deleteProof(String(f.stored_path));
    return json({ ok: true });
  } catch {
    return json({ error: "Suppression impossible." }, 503);
  }
}
