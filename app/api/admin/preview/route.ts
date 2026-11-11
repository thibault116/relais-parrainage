import { json, user } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";

export async function GET(request: Request) {
  const account = await user(request);
  if (!account || !(await isCrmOwner(account)))
    return json({ error: "Accès réservé au compte administrateur principal." }, 403);
  return json({ userId: account.id });
}
