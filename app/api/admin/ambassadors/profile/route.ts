import {z} from "zod";
import {user,guard,json} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {canUseFeature} from "@/lib/beta";
import {withMoneyMode} from "@/lib/monetization/mode";
import {query} from "@/lib/monetization/db";
import {saveAmbassador,syncCode,config} from "@/lib/ambassadors/service";
async function actor(r:Request){const u=await user(r);return u&&await isCrmOwner(u)&&await canUseFeature(u.id,"ambassadors")?u:null;}
export async function GET(r:Request){const u=await actor(r);if(!u)return json({error:"Accès refusé."},403);return withMoneyMode("test",async()=>{const [a]=await query("SELECT code,status,commission_bps,discount_bps,sync_error FROM money_ambassadors WHERE owner_id=$1",[u.id]);return json({member:a?{...a,commission_bps:a.commission_bps??(await config()).commission_bps}:null})})}
export async function POST(r:Request){const u=await actor(r);if(!u)return json({error:"Accès refusé."},403);const denied=await guard(r);if(denied)return denied;try{const d=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,24}$/)}).strict().parse(await r.json());return await withMoneyMode("test",async()=>{const [a]=await query("SELECT * FROM money_ambassadors WHERE owner_id=$1",[u.id]);if(!a||a.status!=="active")throw Error("Statut ambassadeur inactif.");await saveAmbassador(u.id,{ownerId:u.id,code:d.code,status:"active",commissionBps:a.commission_bps,eligibilityReviewed:!!a.eligibility_reviewed},true);await syncCode(u.id,u.id);return json({ok:true})})}catch(e){return json({error:e instanceof z.ZodError?"Utilise 4 à 24 lettres ou chiffres.":e instanceof Error?e.message:"Modification impossible."},400)}}
