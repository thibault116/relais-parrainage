import { z } from "zod";
import { user,guard,json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { bankDetailsSchema,cancelBankTransfer,manualBankOverview,requestBankTransfer,saveBankDetails } from "@/lib/monetization/manual-bank";
export const runtime="nodejs";
export async function GET(request:Request) {
  const actor=await user(request);
  if(!await isCrmOwner(actor))return json({error:"Accès réservé au compte administrateur principal."},403);
  try{return json(await manualBankOverview(actor!.id));}
  catch{return json({error:"Coordonnées bancaires indisponibles."},503);}
}
const mutation=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),bank:bankDetailsSchema}).strict(),
  z.object({action:z.literal("request"),key:z.string().uuid()}).strict(),
  z.object({action:z.literal("cancel"),id:z.string().uuid()}).strict(),
]);
export async function POST(request:Request) {
  const actor=await user(request);
  if(!await isCrmOwner(actor))return json({error:"Accès réservé au compte administrateur principal."},403);
  const denied=await guard(request);if(denied)return denied;
  try {
    const data=mutation.parse(await request.json());
    if(data.action==="save")return json({bank:await saveBankDetails(actor!.id,data.bank)});
    if(data.action==="request")return json({request:await requestBankTransfer(actor!.id,data.key)});
    await cancelBankTransfer(actor!.id,data.id);return json({ok:true});
  } catch(error) {
    // No Stripe calls, no real banking API, no raw request/IBAN in responses or logs.
    if(error instanceof z.ZodError)return json({error:"Vérifie le titulaire, le pays et l’IBAN."},400);
    const allowed=["Enregistrement bancaire non configuré.","Coordonnées bancaires illisibles.","Enregistre ton IBAN avant la demande.","Solde de crédits à régulariser.","Aucun gain disponible.","Demande introuvable."];
    return json({error:allowed.includes((error as Error).message)?(error as Error).message:"Opération non confirmée."},400);
  }
}
