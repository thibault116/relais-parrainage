import { user, guard, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { z } from "zod";
import { connectOverview, createConnectAccount, connectOnboarding, connectDashboard, requestConnectWithdrawal, resumeConnectWithdrawal, refreshConnectWithdrawals } from "@/lib/monetization/connect";
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
  try {
    const data=await request.json(),owner=actor!.id;
    switch(data.action) {
      case "setup": {
        if(data.acknowledgeTest!==true) return json({error:"Confirme que tu configures un compte Connect en mode test."},400);
        await createConnectAccount({id:owner,email:actor!.email},data.country);
        return json({url:await connectOnboarding(owner)});
      }
      case "onboarding": return json({url:await connectOnboarding(owner)});
      case "dashboard": return json({url:await connectDashboard(owner)});
      case "withdraw": return json({result:await requestConnectWithdrawal(owner,data.key)});
      case "resume": return json({result:await resumeConnectWithdrawal(owner,z.string().uuid().parse(data.id),data.key)});
      case "refresh": await refreshConnectWithdrawals(owner);return json(await connectOverview(owner));
      default:return json({error:"Action inconnue."},400);
    }
  } catch(error) {
    return json({error:error instanceof z.ZodError?"Formulaire invalide.":safeStripeFailure(error).message},400);
  }
}
