import { readPlatformSettings } from "@/lib/platform-settings";
import { sendEmailsAfterResponse } from "@/lib/email-after";
import { query, acceptAccompaniment } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const rows = await query(
      `SELECT a.id,a.objective,a.decline_reason,CASE WHEN COALESCE(a.initiator_id,a.beginner_id)=$1 THEN 'sent' ELSE 'received' END AS direction, CASE WHEN a.status IN ('active','completed') AND NOT EXISTS(SELECT 1 FROM profile_blocks pb WHERE pb.user_id IN (a.mentor_id,a.beginner_id)) THEN CASE WHEN a.beginner_id=$1 THEN m.discord ELSE b.discord END ELSE NULL END AS partner_discord, CASE WHEN a.beginner_id=$1 THEN m.id ELSE b.id END AS partner_profile_id,a.status,a.created_at,a.completed_at,a.rating, CASE WHEN a.beginner_id=$1 THEN 'beginner' ELSE 'mentor' END AS side, CASE WHEN a.beginner_id=$1 THEN COALESCE(m.name,'Ancien membre') ELSE COALESCE(b.name,'Ancien membre') END AS partner_name FROM accompaniments a LEFT JOIN profiles m ON m.user_id=a.mentor_id LEFT JOIN profiles b ON b.user_id=a.beginner_id WHERE a.beginner_id=$1 OR a.mentor_id=$1 ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END, a.created_at DESC`,
      [u.id],
    );
    sendEmailsAfterResponse();
    return json({ accompaniments: rows });
  } catch {
    return json({ error: "Impossible de charger les accompagnements." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const input = z
      .object({
        targetProfileId: z.string().uuid().optional(),
        mentorProfileId: z.string().uuid().optional(),
        objective: z.string().trim().min(10).max(2000),
      })
      .safeParse(await request.json());
    if (
      !input.success ||
      !(input.data.targetProfileId || input.data.mentorProfileId)
    )
      return json(
        { error: "Explique ton objectif en 10 à 2 000 caractères." },
        400,
      );
    const own = (
      await query(
        "SELECT * FROM profiles p WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
        [u.id],
      )
    )[0];
    if (!own)
      return json(
        { error: "Complète ton profil avant d’envoyer une demande." },
        403,
      );
    const { settings } = await readPlatformSettings();
    if (!settings.requestsEnabled)
      return json(
        { error: "Les nouvelles demandes sont temporairement en pause." },
        403,
      );
    const target = (
      await query(
        "SELECT * FROM profiles p WHERE id=$1 AND visible=1 AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
        [input.data.targetProfileId || input.data.mentorProfileId!],
      )
    )[0];
    if (!target || target.user_id === u.id || target.role === own.role)
      return json(
        { error: "Choisis un membre avec le rôle complémentaire au tien." },
        400,
      );
    const mentor = own.role === "mentor" ? own : target;
    const beginner = own.role === "beginner" ? own : target;
    if (Number(JSON.parse(String(mentor.details)).capacity) < 1)
      return json({ error: "Ce parrain n’a pas de place disponible." }, 409);
    if (
      settings.verifiedMentorsOnly &&
      !(
        await query(
          "SELECT user_id FROM verifications WHERE user_id=$1 AND status='approved'",
          [String(mentor.user_id)],
        )
      ).length
    )
      return json(
        {
          error:
            "Ce parrain doit faire vérifier son compte avant de recevoir de nouvelles demandes.",
        },
        403,
      );
    const saved = await query(
      `INSERT INTO accompaniments (id,beginner_id,mentor_id,status,created_at,objective,initiator_id) VALUES ($1,$2,$3,'pending',$4,$5,$6) ON CONFLICT(beginner_id,mentor_id) DO NOTHING RETURNING id`,
      [
        crypto.randomUUID(),
        String(beginner.user_id),
        String(mentor.user_id),
        new Date().toISOString(),
        input.data.objective,
        u.id,
      ],
    );
    if (!saved.length)
      return json(
        {
          error:
            "Un accompagnement existe déjà avec ce parrain. Retrouve-le dans Mon profil.",
        },
        409,
      );
    sendEmailsAfterResponse();
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "Impossible d’envoyer la demande." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const input = z
      .object({
        id: z.string().uuid(),
        action: z.enum(["accept", "decline", "cancel", "complete"]),
        reason: z.string().trim().max(2000).optional(),
      })
      .safeParse(await request.json());
    if (!input.success) return json({ error: "Action invalide." }, 400);
    const { id, action } = input.data;
    if (
      action === "decline" &&
      (!input.data.reason || input.data.reason.length < 10)
    )
      return json(
        { error: "Explique le refus en au moins 10 caractères." },
        400,
      );
    if (action === "accept") {
      if (!(await acceptAccompaniment(id, u.id)))
        return json(
          {
            error:
              "Aucune place libre, demande déjà traitée ou action non autorisée. Termine un binôme actif pour libérer une place.",
          },
          409,
        );
      sendEmailsAfterResponse();
      return json({ ok: true });
    }
    const rows =
      action === "complete"
        ? await query(
            `UPDATE accompaniments SET status='completed',completed_at=$1 WHERE id=$2 AND status='active' AND (beginner_id=$3 OR mentor_id=$3) RETURNING id`,
            [new Date().toISOString(), id, u.id],
          )
        : await query(
            `UPDATE accompaniments SET status=$1,decline_reason=$4 WHERE id=$2 AND status='pending' AND ${action === "cancel" ? "COALESCE(initiator_id,beginner_id)=$3" : "(beginner_id=$3 OR mentor_id=$3) AND COALESCE(initiator_id,beginner_id)<>$3"} RETURNING id`,
            [
              action === "decline" ? "declined" : "cancelled",
              id,
              u.id,
              action === "decline" ? input.data.reason! : "",
            ],
          );
    if (!rows.length)
      return json(
        {
          error:
            "Cette action n’est pas autorisée ou l’accompagnement a déjà changé.",
        },
        409,
      );
    sendEmailsAfterResponse();
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de modifier l’accompagnement." }, 503);
  }
}

export const maxDuration = 60;
