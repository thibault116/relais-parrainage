import { profileTimingSQL } from "@/lib/profile-timing";
import { query } from "@/lib/db";
import { decode, publicProfile } from "@/lib/profile";
import { guard, json, user } from "@/lib/http";
import { followCountsSQL } from "@/lib/follows";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const url = new URL(request.url),
      target = url.searchParams.get("profile");
    if (target) {
      const p = (
        await query("SELECT user_id FROM profiles WHERE id=$1", [target])
      )[0];
      if (!p) return json({ error: "Profil introuvable." }, 404);
      return json({
        following: !!(
          await query(
            "SELECT 1 FROM follows WHERE follower_id=$1 AND followed_id=$2",
            [u.id, String(p.user_id)],
          )
        ).length,
      });
    }
    const type =
      url.searchParams.get("type") === "followers" ? "followers" : "following";
    const page = Math.max(
      0,
      Math.min(10000, Number(url.searchParams.get("page")) || 0),
    );
    const side = type === "followers" ? "followed_id" : "follower_id",
      other = type === "followers" ? "follower_id" : "followed_id";
    const total = Number(
      (
        await query(`SELECT COUNT(*) AS n FROM follows WHERE ${side}=$1`, [
          u.id,
        ])
      )[0].n,
    );
    const rows = await query(
      `SELECT p.*, f.created_at, ${profileTimingSQL}, ${followCountsSQL}, (SELECT COUNT(*) FROM profile_blocks b WHERE b.user_id=p.user_id) AS blocked FROM follows f JOIN profiles p ON p.user_id=f.${other} WHERE f.${side}=$1 ORDER BY p.updated_at DESC,p.id LIMIT 30 OFFSET $2`,
      [u.id, page * 30],
    );
    return json({
      total,
      items: rows.map((r) => ({
        id: String(r.id),
        profile:
          r.visible === 1 && !Number(r.blocked)
            ? publicProfile(decode(r))
            : null,
        updatedAt: r.visible === 1 && !Number(r.blocked) ? r.updated_at : null,
      })),
    });
  } catch {
    return json({ error: "Impossible de charger tes abonnements." }, 503);
  }
}
async function change(request: Request, remove = false) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const body = await request.json();
    if (typeof body.profileId !== "string")
      return json({ error: "Choisis un profil." }, 400);
    const p = (
      await query(
        "SELECT p.*, (SELECT COUNT(*) FROM profile_blocks b WHERE b.user_id=p.user_id) AS blocked FROM profiles p WHERE id=$1",
        [body.profileId],
      )
    )[0];
    if (!p) return json({ error: "Profil indisponible." }, 404);
    if (p.user_id === u.id)
      return json({ error: "Tu ne peux pas suivre ton propre profil." }, 400);
    if (remove)
      await query(
        "DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2",
        [u.id, String(p.user_id)],
      );
    else {
      if (p.visible !== 1 || Number(p.blocked))
        return json({ error: "Profil indisponible." }, 404);
      if (
        !(await query("SELECT id FROM profiles WHERE user_id=$1", [u.id]))
          .length
      )
        return json(
          { error: "Complète ton profil avant de suivre un membre." },
          403,
        );
      await query(
        "INSERT INTO follows (follower_id,followed_id,created_at) VALUES ($1,$2,$3) ON CONFLICT(follower_id,followed_id) DO NOTHING",
        [u.id, String(p.user_id), new Date().toISOString()],
      );
    }
    const count = Number(
      (
        await query("SELECT COUNT(*) AS n FROM follows WHERE followed_id=$1", [
          String(p.user_id),
        ])
      )[0].n,
    );
    return json({ following: !remove, followerCount: count });
  } catch {
    return json({ error: "Impossible de modifier cet abonnement." }, 503);
  }
}
export async function POST(r: Request) {
  return change(r);
}
export async function DELETE(r: Request) {
  return change(r, true);
}
