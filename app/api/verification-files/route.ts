import { query } from "@/lib/db";
import { json, user, sameOrigin } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import {
  saveProof,
  readProof,
  deleteProof,
  detectProofType,
} from "@/lib/proof-storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let savedPath: string | undefined;
  try {
    if (!sameOrigin(request)) return json({ error: "Origine refusée." }, 403);
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    if (
      !(
        await query(
          "SELECT id FROM profiles WHERE user_id=$1 AND role='mentor'",
          [u.id],
        )
      ).length
    )
      return json({ error: "Un profil parrain est nécessaire." }, 403);
    if (Number(request.headers.get("content-length")) > 4_300_000)
      return json({ error: "Le fichier doit faire au maximum 4 Mo." }, 413);
    const counts = await query(
      "SELECT COUNT(*) AS n FROM verification_files WHERE user_id=$1",
      [u.id],
    );
    if (Number(counts[0].n) >= 12)
      return json(
        {
          error:
            "Tu peux conserver au maximum 12 fichiers. Retire un ancien fichier pour en ajouter un autre.",
        },
        400,
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
      return json(
        { error: "Choisis une image ou un PDF de 4 Mo maximum." },
        400,
      );
    const bytes = Buffer.from(await file.arrayBuffer()),
      mime = detectProofType(bytes);
    if (!mime)
      return json(
        { error: "Formats acceptés : JPEG, PNG, WebP, GIF, HEIC et PDF." },
        400,
      );
    const id = crypto.randomUUID(),
      name =
        file.name.replace(/[\r\n\x00-\x1F]/g, "").slice(0, 180) ||
        "justificatif";
    savedPath = await saveProof(id, bytes, mime);
    await query(
      "INSERT INTO verification_files (id,user_id,name,mime,size,stored_path,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, u.id, name, mime, file.size, savedPath, new Date().toISOString()],
    );
    return json({ file: { id, name, mime, size: file.size } }, 201);
  } catch {
    if (savedPath) await deleteProof(savedPath).catch(() => {});
    return json(
      {
        error:
          "Import impossible. Réessaie ou ajoute un lien vers ton justificatif.",
      },
      503,
    );
  }
}
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id)
      return json({
        files: await query(
          "SELECT id,name,mime,size FROM verification_files WHERE user_id=$1 ORDER BY created_at",
          [u.id],
        ),
      });
    const rows = await query("SELECT * FROM verification_files WHERE id=$1", [
      id,
    ]);
    if (!rows.length) return json({ error: "Fichier introuvable." }, 404);
    const f = rows[0];
    if (f.user_id !== u.id) {
      if (!(await isModerator(u.id)))
        return json({ error: "Accès refusé." }, 403);
      const dossier = (
        await query("SELECT dossier FROM verifications WHERE user_id=$1", [
          String(f.user_id),
        ])
      )[0];
      if (
        !dossier ||
        !JSON.parse(String(dossier.dossier)).proofs?.some(
          (p: { files: string[] }) => p.files.includes(id),
        )
      )
        return json({ error: "Fichier non joint à un dossier." }, 403);
    }
    const body = await readProof(String(f.stored_path));
    if (!body) return json({ error: "Fichier introuvable." }, 404);
    return new Response(body, {
      headers: {
        "Content-Type": String(f.mime),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(f.name))}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return json({ error: "Lecture du fichier impossible." }, 503);
  }
}
export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return json({ error: "Origine refusée." }, 403);
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const { id } = await request.json();
    const rows = await query(
      "SELECT stored_path FROM verification_files WHERE id=$1 AND user_id=$2",
      [id, u.id],
    );
    if (!rows.length) return json({ error: "Fichier introuvable." }, 404);
    const current = (
      await query("SELECT dossier FROM verifications WHERE user_id=$1", [u.id])
    )[0];
    if (
      current &&
      JSON.parse(String(current.dossier)).proofs?.some(
        (p: { files: string[] }) => p.files.includes(id),
      )
    )
      return json(
        {
          error:
            "Ce fichier est joint à ton dossier. Renvoie le dossier sans ce fichier, ou retire le dossier, avant de le supprimer.",
        },
        409,
      );
    await deleteProof(String(rows[0].stored_path));
    await query("DELETE FROM verification_files WHERE id=$1", [id]);
    return json({ ok: true });
  } catch {
    return json({ error: "Suppression impossible." }, 503);
  }
}
