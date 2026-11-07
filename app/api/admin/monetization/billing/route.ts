import { user, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { billingDetails } from "@/lib/monetization/billing";
export const runtime = "nodejs";
export async function GET(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès propriétaire uniquement" }, 403);
  try {
    return json(await billingDetails(u!.id));
  } catch {
    return json({ error: "Détails Stripe indisponibles. Réessaie." }, 503);
  }
}
