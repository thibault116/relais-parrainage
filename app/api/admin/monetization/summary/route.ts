import {moneyMode} from "@/lib/monetization/mode";
import { user, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import {commerceActor} from "@/lib/monetization/access";
import { query } from "@/lib/monetization/db";
import { balance } from "@/lib/monetization/store";
export async function GET(r: Request) {
  const u = await user(r);
  if (!(await commerceActor(u)))
    return json({ error: "Accès propriétaire uniquement" }, 403);
  const a = (
    await query(
      "SELECT plan,status,cancel_at_end FROM money_accounts WHERE owner_id=$1",
      [u!.id],
    )
  )[0];
  return json({
    mode:moneyMode(),
    plan: "credits",
    status: "credits",
    balance: await balance(query, u!.id),
  });
}
