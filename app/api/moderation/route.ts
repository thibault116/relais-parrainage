import { sendEmailsAfterResponse } from "@/lib/email-after";
import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès réservé à la modération." }, 403);
    const dossiers = await query(
      `SELECT v.*,p.name,p.details FROM verifications v JOIN profiles p ON p.user_id=v.user_id WHERE p.role='mentor' ORDER BY v.submitted_at DESC LIMIT 100`,
    );
    return json({
      dossiers: dossiers.map((r) => ({
        ...r,
        dossier: JSON.parse(String(r.dossier)),
        profile: JSON.parse(String(r.details)),
        details: undefined,
      })),
    });
  } catch {
    return json({ error: "Impossible de charger les dossiers." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès réservé à la modération." }, 403);
    const input = z
      .object({
        userId: z.string(),
        revision: z.string().uuid(),
        action: z.enum(["approve", "changes"]),
        sales: z.number().int().min(0).max(1000000),
        specialties: z.array(z.string()).max(13),
        feedback: z.string().trim().max(1500),
        checked: z.literal(true),
      })
      .safeParse(await request.json());
    if (!input.success)
      return json(
        { error: "Complète la décision et confirme l’examen du dossier." },
        400,
      );
    const d = input.data;
    if (d.action === "changes" && d.feedback.length < 15)
      return json(
        {
          error: "Explique les compléments attendus en au moins 15 caractères.",
        },
        400,
      );
    if (
      d.userId === u.id &&
      !(
        await query(
          "SELECT user_id FROM moderators WHERE user_id=$1 AND LOWER(email)=$2",
          [u.id, "thibault.cordiez@hotmail.com"],
        )
      ).length
    )
      return json(
        {
          error:
            "L’auto-validation est réservée au compte administrateur principal.",
        },
        403,
      );
    const existing = await query(
      "SELECT v.dossier,p.details FROM verifications v JOIN profiles p ON p.user_id=v.user_id WHERE v.user_id=$1 AND v.revision=$2 AND p.role='mentor'",
      [d.userId, d.revision],
    );
    if (!existing.length)
      return json({ error: "Le dossier a changé. Actualise la liste." }, 409);
    const original = JSON.parse(String(existing[0].dossier));
    const allowed =
      original.version === 2
        ? original.helpAreas.map((v: string) =>
            v === "Autre" ? original.otherHelp : v,
          )
        : original.specialties;
    if (
      d.action === "approve" &&
      (!d.specialties.length ||
        d.specialties.some((s) => !allowed.includes(s)) ||
        (original.version !== 2 && (d.sales < 20 || d.sales > original.sales)))
    )
      return json(
        {
          error:
            "Sélectionne les domaines réellement examinés dans le dossier.",
        },
        400,
      );
    const saved = await query(
      `UPDATE verifications SET status=$1,feedback=$2,verified_sales=$3,verified_specialties=$4,reviewed_at=$5,reviewer_id=$6,revision=$7 WHERE user_id=$8 AND revision=$9 RETURNING revision,status,feedback,verified_sales,verified_specialties,reviewed_at`,
      [
        d.action === "approve" ? "approved" : "changes",
        d.feedback || "Dossier examiné et validé par l’administration.",
        d.action === "approve" && original.version !== 2 ? d.sales : null,
        d.action === "approve" ? JSON.stringify(d.specialties) : null,
        new Date().toISOString(),
        u.id,
        crypto.randomUUID(),
        d.userId,
        d.revision,
      ],
    );
    if (!saved.length)
      return json({ error: "Le dossier a changé. Actualise la liste." }, 409);
    sendEmailsAfterResponse();
    return json({ ok: true, verification: saved[0] });
  } catch {
    return json({ error: "Impossible d’enregistrer la décision." }, 503);
  }
}

export const maxDuration = 60;
