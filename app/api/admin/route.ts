import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const page = Math.max(
      0,
      Math.min(
        10000,
        Number(new URL(request.url).searchParams.get("page")) || 0,
      ),
    );
    const [
      accounts,
      profiles,
      pairs,
      reports,
      ratings,
      people,
      reportList,
      reviewList,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM "user"'),
      query(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN p.role='mentor' THEN 1 ELSE 0 END) AS mentors, SUM(CASE WHEN p.role='beginner' THEN 1 ELSE 0 END) AS beginners, SUM(CASE WHEN p.role='mentor' AND EXISTS (SELECT 1 FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') THEN 1 ELSE 0 END) AS active FROM profiles p",
      ),
      query("SELECT status,COUNT(*) AS n FROM accompaniments GROUP BY status"),
      query(
        "SELECT COUNT(*) AS total,SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open FROM reports",
      ),
      query(
        "SELECT COUNT(*) AS total,AVG(a.rating*1.0) AS average FROM accompaniments a WHERE rating IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)",
      ),
      query(
        'SELECT u.id,u.name,u.email,u."createdAt" AS created_at,p.id AS profile_id,p.role,p.visible,CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS blocked FROM "user" u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN profile_blocks b ON b.user_id=u.id ORDER BY u."createdAt" DESC LIMIT 30 OFFSET $1',
        [page * 30],
      ),
      query(
        "SELECT r.*,COALESCE(p.name,'Compte supprimé') AS target_name,COALESCE(u.name,'Compte supprimé') AS reporter_name FROM reports r LEFT JOIN profiles p ON p.user_id=r.target_id LEFT JOIN \"user\" u ON u.id=r.reporter_id ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100",
      ),
      query(
        "SELECT a.id,a.mentor_id,a.rating,a.rated_at,COALESCE(m.name,'Ancien membre') AS mentor_name,COALESCE(b.name,'Ancien membre') AS beginner_name,CASE WHEN h.accompaniment_id IS NULL THEN 0 ELSE 1 END AS hidden FROM accompaniments a LEFT JOIN profiles m ON m.user_id=a.mentor_id LEFT JOIN profiles b ON b.user_id=a.beginner_id LEFT JOIN hidden_ratings h ON h.accompaniment_id=a.id WHERE a.rating IS NOT NULL ORDER BY a.rated_at DESC LIMIT 100",
      ),
    ]);
    const counts = Object.fromEntries(
      pairs.map((p) => [String(p.status), Number(p.n)]),
    );
    const accepted = (counts.active || 0) + (counts.completed || 0);
    const decided = accepted + (counts.declined || 0);
    return json({
      stats: {
        accounts: Number(accounts[0].total),
        profiles: Number(profiles[0].total),
        mentors: Number(profiles[0].mentors) || 0,
        beginners: Number(profiles[0].beginners) || 0,
        incomplete: Number(accounts[0].total)-Number(profiles[0].total),
        activeMentors: Number(profiles[0].active) || 0,
        requests: Object.values(counts).reduce((a, b) => a + b, 0),
        pending: counts.pending || 0,
        accepted,
        declined: counts.declined || 0,
        cancelled: counts.cancelled || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        acceptanceRate: decided ? Math.round((accepted / decided) * 100) : null,
        reports: Number(reports[0].total),
        openReports: Number(reports[0].open) || 0,
        ratings: Number(ratings[0].total),
        average: ratings[0].average ? Number(ratings[0].average) : null,
      },
      accounts: people,
      reports: reportList,
      ratings: reviewList,
      page,
    });
  } catch {
    return json({ error: "Impossible de charger le tableau de bord." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const parsed = z
      .object({
        action: z.enum([
          "resolve",
          "dismiss",
          "hide-profile",
          "restore-profile",
          "hide-rating",
          "restore-rating",
        ]),
        id: z.string().min(1).max(100),
        reason: z.string().trim().min(10).max(1500),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      return json(
        { error: "Précise le motif de la décision (au moins 10 caractères)." },
        400,
      );
    const { action, id, reason } = parsed.data,
      now = new Date().toISOString();
    if (action === "resolve" || action === "dismiss") {
      const rows = await query(
        "UPDATE reports SET status=$1,review_note=$2,reviewer_id=$3,reviewed_at=$4 WHERE id=$5 AND status='open' RETURNING id",
        [
          action === "resolve" ? "resolved" : "dismissed",
          reason,
          u.id,
          now,
          id,
        ],
      );
      if (!rows.length)
        return json({ error: "Signalement déjà traité ou introuvable." }, 409);
    } else if (action === "hide-profile") {
      if (id === u.id)
        return json(
          { error: "Tu ne peux pas masquer ton propre compte par modération." },
          400,
        );
      if (!(await query('SELECT id FROM "user" WHERE id=$1', [id])).length)
        return json({ error: "Compte introuvable." }, 404);
      await query(
        "INSERT INTO profile_blocks (user_id,reason,moderator_id,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,moderator_id=excluded.moderator_id,created_at=excluded.created_at",
        [id, reason, u.id, now],
      );
    } else if (action === "restore-profile")
      await query("DELETE FROM profile_blocks WHERE user_id=$1", [id]);
    else if (action === "hide-rating") {
      if (
        !(
          await query(
            "SELECT id FROM accompaniments WHERE id=$1 AND rating IS NOT NULL",
            [id],
          )
        ).length
      )
        return json({ error: "Avis introuvable." }, 404);
      await query(
        "INSERT INTO hidden_ratings (accompaniment_id,reason,moderator_id,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(accompaniment_id) DO NOTHING",
        [id, reason, u.id, now],
      );
    } else
      await query("DELETE FROM hidden_ratings WHERE accompaniment_id=$1", [id]);
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible d’enregistrer la décision." }, 503);
  }
}
