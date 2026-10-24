import { deleteUserProofs } from "@/lib/proof-storage";
import { query } from "@/lib/db";
import { guard, json, user, sameOrigin } from "@/lib/http";
import { dossierSchema } from "@/lib/verification";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const rows = await query(
      "SELECT revision,status,dossier,feedback,verified_sales,verified_specialties,submitted_at,reviewed_at FROM verifications WHERE user_id=$1",
      [u.id],
    );
    const moderationOpen =
      (
        await query(
          'SELECT m.user_id FROM moderators m JOIN "user" u ON u.id=m.user_id LIMIT 1',
        )
      ).length > 0;
    return json({
      moderationOpen,
      verification: rows[0]
        ? { ...rows[0], dossier: JSON.parse(String(rows[0].dossier)) }
        : null,
    });
  } catch {
    return json({ error: "Impossible de charger le dossier." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return json({ error: "Origine refusée." }, 403);
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const parsed = dossierSchema.safeParse(await request.json());
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const p = await query(
      "SELECT details FROM profiles WHERE user_id=$1 AND role='mentor'",
      [u.id],
    );
    if (!p.length)
      return json(
        {
          error: "Complète ton profil parrain avant de soumettre un dossier.",
        },
        403,
      );
    if (
      !(
        await query(
          'SELECT m.user_id FROM moderators m JOIN "user" u ON u.id=m.user_id LIMIT 1',
        )
      ).length
    )
      return json(
        {
          error:
            "La vérification ouvrira dès que la modération sera configurée.",
        },
        503,
      );
    const fileIds = [...new Set(parsed.data.proofs.flatMap((p) => p.files))];
    for (const id of fileIds)
      if (
        !(
          await query(
            "SELECT id FROM verification_files WHERE id=$1 AND user_id=$2",
            [id, u.id],
          )
        ).length
      )
        return json(
          { error: "Un fichier est introuvable ou ne t’appartient pas." },
          400,
        );
    await query(
      `INSERT INTO verifications (user_id,revision,status,dossier,submitted_at) VALUES ($1,$2,'pending',$3,$4) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,status='pending',dossier=excluded.dossier,feedback='',verified_sales=NULL,verified_specialties=NULL,submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewer_id=NULL`,
      [
        u.id,
        crypto.randomUUID(),
        JSON.stringify(parsed.data),
        new Date().toISOString(),
      ],
    );
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible d’envoyer le dossier." }, 503);
  }
}
export async function DELETE(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    await deleteUserProofs(u.id);
    await query("DELETE FROM verifications WHERE user_id=$1", [u.id]);
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de retirer le dossier." }, 503);
  }
}
