import { sendEmailsAfterResponse } from "@/lib/email-after";
import { followCountsSQL } from "@/lib/follows";
import { deleteProfilePhoto } from "@/lib/profile-photo";
import { deleteUserProofs } from "@/lib/proof-storage";
import { isModerator, getPublicVerifications } from "@/lib/verification";
import { query } from "@/lib/db";
import { decode, profileSchema } from "@/lib/profile";
import { guard, json, user } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u)
      return json({ error: "Connecte-toi pour accéder à ton profil." }, 401);
    const rows = await query(
      `SELECT p.*, ${followCountsSQL}, (SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active_count, (SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed') AS completed_count, (SELECT COUNT(a.rating) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed' AND NOT EXISTS (SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)) AS rating_count, (SELECT AVG(a.rating*1.0) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed' AND NOT EXISTS (SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)) AS rating_average FROM profiles p WHERE user_id=$1`,
      [u.id],
    );
    const verifications = await getPublicVerifications([u.id]);
    sendEmailsAfterResponse();
    return json({
      isModerator: await isModerator(u.id),
      moderationBlock:
        (
          await query("SELECT reason FROM profile_blocks WHERE user_id=$1", [
            u.id,
          ])
        )[0]?.reason || null,
      profile: rows[0]
        ? {
            ...decode(rows[0]),
            verification: verifications.get(u.id) || null,
            completedCount: Number(rows[0].completed_count) || 0,
            ratingCount: Number(rows[0].rating_count) || 0,
            ratingAverage: Number(rows[0].rating_average) || 0,
            activeCount: Number(rows[0].active_count) || 0,
          }
        : null,
    });
  } catch {
    return json(
      { error: "Impossible de charger ton profil pour le moment." },
      503,
    );
  }
}
export async function PUT(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const { discord, consent, ...details } = parsed.data;
    void consent;
    const rows = await query("SELECT * FROM profiles WHERE user_id=$1", [u.id]);
    const savedDetails = {
      ...details,
      photo: rows[0] ? JSON.parse(String(rows[0].details)).photo : undefined,
    };
    const id = String(rows[0]?.id || crypto.randomUUID());
    await query(
      `INSERT INTO profiles (id,user_id,discord,role,name,details,visible,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id) DO UPDATE SET discord=excluded.discord,role=excluded.role,name=excluded.name,details=excluded.details,visible=excluded.visible,updated_at=excluded.updated_at`,
      [
        id,
        u.id,
        discord,
        details.role,
        details.name,
        JSON.stringify(savedDetails),
        details.visible ? 1 : 0,
        new Date().toISOString(),
      ],
    );
    sendEmailsAfterResponse();
    return json({
      profile: decode({
        id,
        discord,
        name: details.name,
        role: details.role,
        visible: details.visible ? 1 : 0,
        details: JSON.stringify(savedDetails),
      }),
    });
  } catch (e) {
    if (/unique|duplicate/i.test(String(e)))
      return json(
        { error: "Ce pseudo Discord est déjà utilisé par un profil." },
        409,
      );
    return json(
      {
        error:
          "Enregistrement impossible. Tes changements ne sont pas enregistrés.",
      },
      503,
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const b = await request.json();
    if (typeof b.visible !== "boolean")
      return json({ error: "Choisis une visibilité valide." }, 400);
    await query(
      "UPDATE profiles SET visible=$1, updated_at=$2 WHERE user_id=$3",
      [b.visible ? 1 : 0, new Date().toISOString(), u.id],
    );
    sendEmailsAfterResponse();
    return json({ visible: b.visible });
  } catch {
    return json({ error: "Impossible de modifier la visibilité." }, 503);
  }
}
export async function DELETE(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    await deleteUserProofs(u.id);
    await deleteProfilePhoto(u.id);
    await query("DELETE FROM follows WHERE follower_id=$1 OR followed_id=$1", [
      u.id,
    ]);
    await query("DELETE FROM verifications WHERE user_id=$1", [u.id]);
    await query("DELETE FROM profiles WHERE user_id=$1", [u.id]);
    return json({ ok: true });
  } catch {
    return json({ error: "Suppression impossible pour le moment." }, 503);
  }
}

export const maxDuration = 60;
