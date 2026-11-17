import { user, json } from "@/lib/http";
import { isCrmOwner as isOwner } from "@/lib/crm";
import {rechargeOffers,creditSeasons} from "@/lib/monetization/catalog";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const account = await user(request);
    if (!(await isOwner(account)))
      return json({ error: "Accès réservé au compte propriétaire." }, 403);
    return json({offers:rechargeOffers,seasons:creditSeasons});
  } catch {
    return json(
      { error: "Impossible de charger la proposition. Réessaie." },
      503,
    );
  }
}
