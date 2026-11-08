import { user, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { joinOffers } from "@/lib/join-offers";
export async function GET(r: Request) {
  const u = await user(r);
  if (!u)
    return json({ error: "Connecte-toi pour consulter les offres." }, 401);
  if (!(await isCrmOwner(u)))
    return json(
      { error: "Accès réservé au compte administrateur principal." },
      403,
    );
  return json(joinOffers());
}
