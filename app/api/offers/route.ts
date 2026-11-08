import { user, json } from "@/lib/http";
import { query } from "@/lib/db";
import { canUseFeature } from "@/lib/beta";
import { joinOffers } from "@/lib/join-offers";
export async function GET(r: Request) {
  const u = await user(r);
  if (!u)
    return json({ error: "Connecte-toi pour consulter les offres." }, 401);
  const p = (
    await query("SELECT role FROM profiles WHERE user_id=$1", [u.id])
  )[0];
  if (p?.role !== "beginner" || !(await canUseFeature(u.id, "joinOffers")))
    return json(
      { error: "Présentation réservée aux débutants bêta-testeurs." },
      403,
    );
  return json(joinOffers());
}
