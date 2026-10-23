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
        "SELECT * FROM profiles WHERE id=$1 AND visible=1",
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
      "SELECT * FROM profiles WHERE visible=1 AND role=$1 ORDER BY updated_at DESC",
      [role],
    );
    let profiles = rows
      .map(decode)
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
        (!specialty || p.specialty === specialty) &&
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
