import { user, json, guard } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { listPayoutTests } from "@/lib/monetization/payout-tests";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const account = await user(request);
  if (!(await isCrmOwner(account))) return json({ error: "Accès réservé au compte administrateur principal." },403);
  return json({ tests: await listPayoutTests(account!.id) });
}
export async function POST(request: Request) {
  const account = await user(request);
  if (!(await isCrmOwner(account))) return json({ error: "Accès réservé au compte administrateur principal." },403);
  const blocked = await guard(request);
  if (blocked) return blocked;
  return json({error:"Les retraits Stripe sont désactivés. Utilise les demandes de virement manuel."},410);
}
