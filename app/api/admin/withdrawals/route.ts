import {after} from "next/server";
import {z} from "zod";
import {user,guard,json} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {adminBankDetails,adminBankList,bankDecisionSchema,decideBankTransfer} from "@/lib/monetization/bank-admin";
import {runPushWorker} from "@/lib/push";
import {withMoneyMode,moneyMode} from "@/lib/monetization/mode";
function mode(r:Request){return z.enum(["test","live"]).parse(new URL(r.url).searchParams.get("mode")||moneyMode());}
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(r:Request){
  const actor=await user(r);if(!await isCrmOwner(actor))return json({error:"Accès réservé à l’administrateur principal."},403);
  try{return await withMoneyMode(mode(r),async()=>json(await adminBankList(actor!,z.coerce.number().int().min(0).max(10000).parse(new URL(r.url).searchParams.get("page")||0),new URL(r.url).searchParams.get("state")||"")));}
  catch{return json({error:"Demandes indisponibles."},503);}
}
export async function POST(r:Request){
  const actor=await user(r);if(!await isCrmOwner(actor))return json({error:"Accès réservé à l’administrateur principal."},403);
  const denied=await guard(r);if(denied)return denied;
  try{
    const input=await r.json();
    if(input.action==="reveal"){
      const d=z.object({action:z.literal("reveal"),id:z.string().uuid()}).strict().parse(input);
      return await withMoneyMode(mode(r),async()=>json(await adminBankDetails(actor!,d.id)));
    }
    const result=await withMoneyMode(mode(r),()=>decideBankTransfer(actor!,bankDecisionSchema.parse(input)));
    after(()=>runPushWorker());return json(result);
  }catch(e){
    if(e instanceof z.ZodError)return json({error:"Vérifie la décision, son motif et la référence de virement."},400);
    const allowed=["Solde de commissions à régulariser.","Accès refusé.","Demande introuvable.","Référence de décision réutilisée.","La demande a changé. Actualise la liste.","Changement de statut impossible.","Les versements réels sont désactivés.","Coordonnées bancaires illisibles."];
    return json({error:allowed.includes((e as Error).message)?(e as Error).message:"Décision non confirmée."},409);
  }
}
