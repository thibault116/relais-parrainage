import {z} from "zod";
import {user,guard,json} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {canUseFeature} from "@/lib/beta";
import {withMoneyMode,moneyMode} from "@/lib/monetization/mode";
import {query} from "@/lib/monetization/db";
import {manualBankOverview,saveBankDetails,requestBankTransfer,cancelBankTransfer,bankDetailsSchema} from "@/lib/monetization/manual-bank";
async function actor(r:Request){const u=await user(r);return u&&await isCrmOwner(u)&&await canUseFeature(u.id,"ambassadors")?u:null;}
function mode(r:Request){return z.enum(["test","live"]).parse(new URL(r.url).searchParams.get("mode")||moneyMode());}
export async function GET(r:Request){const u=await actor(r);if(!u)return json({error:"Accès réservé au compte administrateur."},403);try{return await withMoneyMode(mode(r),async()=>json({...await manualBankOverview(u.id,true),mode:moneyMode(),commissions:await query("SELECT payment_id,gross_cents,net_cents,available_at,created_at FROM money_ambassador_commissions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",[u.id]),services:await query("SELECT b.id,b.payout_cents,b.status,b.snapshot,b.created_at FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE s.owner_id=$1 AND b.owner_id<>s.owner_id AND b.test_booking=0 ORDER BY b.created_at DESC LIMIT 100",[u.id])}));}catch{return json({error:"Wallet indisponible."},503)}}
export async function POST(r:Request){const u=await actor(r);if(!u)return json({error:"Accès réservé au compte administrateur."},403);const denied=await guard(r);if(denied)return denied;try{const d=await r.json();return await withMoneyMode(mode(r),async()=>{if(d.action==="save")await saveBankDetails(u.id,bankDetailsSchema.parse(d.bank));else if(d.action==="request")return json(await requestBankTransfer(u.id,z.string().uuid().parse(d.key),true));else if(d.action==="cancel")await cancelBankTransfer(u.id,z.string().uuid().parse(d.id));else return json({error:"Action inconnue."},400);return json({ok:true})});}catch(e){return json({error:e instanceof z.ZodError?"Vérifie les coordonnées bancaires.":e instanceof Error?e.message:"Opération indisponible."},400)}}
