import { diagnosePayoutTest } from "@/lib/monetization/payout-diagnostics";
import { user, json, guard } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { createPayoutTest, listPayoutTests, refreshPayoutTests } from "@/lib/monetization/payout-tests";
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
  try {
    const data = await request.json();
    if (data.action === "diagnose") return json({ diagnostic: await diagnosePayoutTest() });
    if (data.action === "refresh") return json({ tests: await refreshPayoutTests(account!.id) });
    if (data.action !== "create") return json({ error: "Action inconnue." },400);
    const result = await createPayoutTest(account!.id,data.amount,data.key);
    return json({ result,tests: await listPayoutTests(account!.id) });
  } catch {
    return json({ error: "Test indisponible. Utilise 0 € ou 0,01 € et vérifie la configuration Stripe test. Aucun virement réel n’est autorisé." },400);
  }
}
