import { getPublicVerifications } from "@/lib/verification";
import { query } from "@/lib/db";
import { decode, publicProfile } from "@/lib/profile";
import { json, user } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("contact");
    if (id) {
      const u = await user(request);
      if (!u)
        return json(
          { error: "Connecte-toi pour voir le contact Discord." },
          401,
        );
      const own = await query("SELECT id FROM profiles WHERE user_id=$1", [
        u.id,
      ]);
      if (!own.length)
        return json(
          { error: "Complète d’abord ton profil pour contacter un membre." },
          403,
        );
      const rows = await query(
        "SELECT * FROM profiles p WHERE id=$1 AND visible=1 AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
        [id],
      );
      if (!rows.length)
        return json({ error: "Ce profil n’est plus disponible." }, 404);
      const p = decode(rows[0]);
      return json({ discord: p.discord, discordId: p.discordId });
    }
    const role =
      url.searchParams.get("role") === "beginner" ? "beginner" : "mentor";
    const rows = await query(
      "SELECT p.*, (SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active_count, (SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed') AS completed_count, (SELECT AVG(a.rating * 1.0) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed' AND NOT EXISTS (SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)) AS rating_average, (SELECT COUNT(a.rating) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='completed' AND NOT EXISTS (SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)) AS rating_count FROM profiles p WHERE visible=1 AND role=$1 AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id) ORDER BY updated_at DESC",
      [role],
    );
    const verifications = await getPublicVerifications(
      rows.map((r) => String(r.user_id)),
    );
    let profiles = rows
      .map((row) => ({
        ...decode(row),
        verification: verifications.get(String(row.user_id)) || null,
        completedCount: Number(row.completed_count) || 0,
        activeCount: Number(row.active_count) || 0,
        ratingAverage: Number(row.rating_average) || 0,
        ratingCount: Number(row.rating_count) || 0,
      }))
      .filter((p) => p.role !== "mentor" || p.capacity > 0)
      .map(publicProfile);
    const search = (url.searchParams.get("q") || "").toLocaleLowerCase("fr");
    const specialty = url.searchParams.get("specialty");
    const time = url.searchParams.get("time");
    profiles = profiles.filter(
      (p) =>
        (!search ||
          `${p.name} ${p.bio} ${p.references}`
            .toLocaleLowerCase("fr")
            .includes(search)) &&
        (!specialty ||
          p.specialty.includes(specialty as (typeof p.specialty)[number])) &&
        (!time || p.availability === time),
    );
    const page = Math.max(
      0,
      Math.min(10000, Number(url.searchParams.get("page")) || 0),
    );
    return json({
      profiles: profiles.slice(page * 12, page * 12 + 12),
      total: profiles.length,
    });
  } catch {
    return json(
      {
        error:
          "L’annuaire est momentanément indisponible. Réessaie dans un instant.",
      },
      503,
    );
  }
}
