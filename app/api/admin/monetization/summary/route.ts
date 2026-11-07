import { user, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { query } from "@/lib/db";
import { balance } from "@/lib/monetization/store";
export async function GET(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès propriétaire uniquement" }, 403);
  const a = (
    await query(
      "SELECT plan,status,cancel_at_end FROM money_accounts WHERE owner_id=$1",
      [u!.id],
    )
  )[0];
  return json({
    plan: a?.plan || "free",
    status: a?.status || "free",
    balance: await balance(query, u!.id),
  });
}
