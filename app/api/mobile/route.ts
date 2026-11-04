import { guard, json, user } from "@/lib/http";
import { query } from "@/lib/db";
import { canUseFeature } from "@/lib/beta";
import { mobileMember, mobileNotices } from "@/lib/mobile-space";
import { z } from "zod";
export async function GET(r: Request) {
  try {
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    await mobileMember(u.id);
    if (!(await canUseFeature(u.id, "mobileExtras")))
      return json({ error: "Disponible dans le programme bêta." }, 403);
    const url = new URL(r.url),
      pair = url.searchParams.get("pair");
    if (pair) {
      const own = await query(
        `SELECT id FROM accompaniments WHERE id=$1 AND (mentor_id=$2 OR beginner_id=$2) AND status IN ('active','completed') AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id IN(mentor_id,beginner_id))`,
        [pair, u.id],
      );
      if (!own.length) return json({ error: "Accès refusé." }, 403);
      return json({
        notes: await query(
          "SELECT n.id,n.body,n.created_at,p.name FROM pair_notes n JOIN profiles p ON p.user_id=n.author_id WHERE pair_id=$1 ORDER BY created_at DESC LIMIT 100",
          [pair],
        ),
      });
    }
    return json({
      notices: await mobileNotices(u.id),
      bookmarks: await query(
        `SELECT p.id,p.name,p.role FROM member_bookmarks b JOIN profiles p ON p.id=b.profile_id WHERE b.user_id=$1 AND p.visible=1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=p.user_id) ORDER BY b.created_at DESC`,
        [u.id],
      ),
    });
  } catch {
    return json({ error: "Chargement impossible. Réessaie." }, 503);
  }
}
export async function POST(r: Request) {
  try {
    const g = await guard(r);
    if (g) return g;
    const u = await user(r);
    if (!u) return json({ error: "Connexion requise." }, 401);
    await mobileMember(u.id);
    if (!(await canUseFeature(u.id, "mobileExtras")))
      return json({ error: "Disponible dans le programme bêta." }, 403);
    const p = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("bookmark"),
          id: z.string().uuid(),
          saved: z.boolean(),
        }),
        z.object({
          action: z.literal("read"),
          ids: z.array(z.string().max(200)).max(80),
        }),
        z.object({
          action: z.literal("note"),
          id: z.string().uuid(),
          body: z.string().trim().min(1).max(2000),
        }),
      ])
      .safeParse(await r.json());
    if (!p.success) return json({ error: "Données invalides." }, 400);
    const d = p.data;
    if (d.action === "bookmark") {
      if (d.saved)
        await query(
          `INSERT INTO member_bookmarks(user_id,profile_id,created_at) SELECT $1,id,$3 FROM profiles WHERE id=$2 AND visible=1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=profiles.user_id) ON CONFLICT(user_id,profile_id) DO NOTHING`,
          [u.id, d.id, new Date().toISOString()],
        );
      else
        await query(
          "DELETE FROM member_bookmarks WHERE user_id=$1 AND profile_id=$2",
          [u.id, d.id],
        );
    }
    if (d.action === "read") {
      const permitted = new Set((await mobileNotices(u.id)).map((n) => n.id));
      for (const id of d.ids)
        if (permitted.has(id))
          await query(
            "INSERT INTO member_notice_reads(user_id,notice_id) VALUES($1,$2) ON CONFLICT(user_id,notice_id) DO NOTHING",
            [u.id, id],
          );
    }
    if (d.action === "note") {
      const rows = await query(
        `INSERT INTO pair_notes(id,pair_id,author_id,body,created_at) SELECT $1,id,$2,$3,$4 FROM accompaniments WHERE id=$5 AND status='active' AND (mentor_id=$2 OR beginner_id=$2) AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id IN(mentor_id,beginner_id)) RETURNING id`,
        [crypto.randomUUID(), u.id, d.body, new Date().toISOString(), d.id],
      );
      if (!rows.length)
        return json({ error: "Accompagnement indisponible." }, 403);
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Enregistrement impossible." }, 503);
  }
}
