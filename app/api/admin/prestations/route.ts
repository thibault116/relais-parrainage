import {z} from "zod";
import {user,json,guard,sameOrigin} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {query} from "@/lib/db";
import {book,bookingAction,moneyTransaction,lock} from "@/lib/monetization/store";
import {saveProof,readProof,deleteProof,detectProofType} from "@/lib/proof-storage";
export const runtime="nodejs";
export async function GET(r:Request){
 const u=await user(r);if(!await isCrmOwner(u))return json({error:"Accès réservé au compte principal."},403);
 try{
 const image=new URL(r.url).searchParams.get("image");
 if(image){z.string().uuid().parse(image);const [f]=await query("SELECT stored_path,mime FROM money_service_images WHERE id=$1 AND owner_id=$2",[image,u!.id]);if(!f)return json({error:"Image introuvable."},404);const bytes=await readProof(String(f.stored_path));if(!bytes)return json({error:"Image indisponible."},404);return new Response(bytes,{headers:{"Content-Type":String(f.mime),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});}
 const [profile]=await query("SELECT id,name,role FROM profiles WHERE user_id=$1",[u!.id]);
 const services=await query("SELECT id,owner_id,data FROM money_services WHERE owner_id=$1 AND archived=0 ORDER BY created_at DESC",[u!.id]);
 const requests=await query("SELECT b.*,COALESCE(m.reason,'') AS reason,p.id AS profile_id,p.name FROM money_bookings b LEFT JOIN money_service_requests m ON m.booking_id=b.id LEFT JOIN profiles p ON p.user_id=b.owner_id WHERE b.owner_id=$1 ORDER BY b.created_at DESC,b.id",[u!.id]);
 const [stats]=await query("SELECT COUNT(rating) AS reviews,COALESCE(SUM(CASE WHEN rating>=4 THEN 1 ELSE 0 END),0) AS positive FROM accompaniments a WHERE mentor_id=$1 AND status='completed' AND NOT EXISTS(SELECT 1 FROM hidden_ratings h WHERE h.accompaniment_id=a.id)",[u!.id]);
 return json({profile,stats:{reviews:Number(stats.reviews),satisfaction:Number(stats.reviews)?Math.round(Number(stats.positive)*100/Number(stats.reviews)):null},services:services.map(s=>({...s,data:JSON.parse(String(s.data))})),requests:requests.map(b=>({...b,snapshot:JSON.parse(String(b.snapshot))}))});
 }catch{return json({error:"Prestations indisponibles."},400);}
}
export async function POST(r:Request){
 const u=await user(r);if(!await isCrmOwner(u))return json({error:"Accès réservé au compte principal."},403);
 if(!sameOrigin(r))return json({error:"Origine refusée."},403);
 let path:string|undefined;
 try{
 if(r.headers.get("content-type")?.startsWith("multipart/form-data")){
 if(Number(r.headers.get("content-length"))>4300000)return json({error:"4 Mo maximum."},413);
 const form=await r.formData(),file=form.get("file");if(!(file instanceof File)||!file.size||file.size>4000000)return json({error:"Choisis une image de 4 Mo maximum."},400);
 const bytes=Buffer.from(await file.arrayBuffer()),mime=detectProofType(bytes);if(!mime||!["image/jpeg","image/png","image/webp"].includes(mime))return json({error:"Formats acceptés : JPG, PNG, WebP."},400);
 const id=crypto.randomUUID();path=await saveProof(id,bytes,mime);
 await moneyTransaction(async q=>{await lock(q,u!.id);const [count]=await q("SELECT COUNT(*) AS n FROM money_service_images WHERE owner_id=$1",[u!.id]);if(Number(count.n)>=100)throw Error("Limite d’images atteinte.");await q("INSERT INTO money_service_images(id,owner_id,stored_path,mime,created_at) VALUES($1,$2,$3,$4,$5)",[id,u!.id,path!,mime,new Date().toISOString()]);});path=undefined;return json({id},201);
 }
 const denied=await guard(r);if(denied)return denied;
 const d=z.discriminatedUnion("action",[
 z.object({action:z.literal("request"),id:z.string().uuid(),key:z.string().uuid(),notes:z.string().trim().max(1000).default("")}).strict(),
 z.object({action:z.literal("decision"),id:z.string().uuid(),transition:z.enum(["accept","complete","decline","cancel"]),reason:z.string().trim().max(1000).default("")}).strict(),
 ]).parse(await r.json());
 if(d.action==="request")return json({id:await book(u!.id,d.id,d.key,d.notes,"À convenir")});
 if(d.transition==="decline"&&d.reason.length<10)return json({error:"Explique le refus en au moins 10 caractères."},400);
 await bookingAction(u!.id,d.id,d.transition,d.reason);return json({ok:true});
 }catch(e){if(path)await deleteProof(path);const message=(e as Error).message;return json({error:["Crédits insuffisants","Plus de disponibilité","Prestation indisponible","Prestation introuvable","Transition impossible ou déjà effectuée","Limite d’images atteinte."].includes(message)?message:"Action impossible. Vérifie le formulaire puis actualise."},400);}
}
