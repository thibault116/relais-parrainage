import { user, guard, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { connectOverview } from "@/lib/monetization/connect";
import { safeStripeFailure } from "@/lib/monetization/payout-diagnostics";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request) {
  const actor=await user(request);
  if(!await isCrmOwner(actor)) return json({error:"Accès réservé au compte administrateur principal."},403);
  try {return json(await connectOverview(actor!.id));}
  catch(error) {return json({error:safeStripeFailure(error).message},503);}
}
export async function POST(request:Request) {
  const actor=await user(request);
  if(!await isCrmOwner(actor)) return json({error:"Accès réservé au compte administrateur principal."},403);
  const denied=await guard(request);if(denied) return denied;
  return json({error:"Les retraits passent désormais uniquement par virement manuel."},410);
}
