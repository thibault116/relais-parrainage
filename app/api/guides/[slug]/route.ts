import {user,json} from '@/lib/http';
import {canUseFeature} from '@/lib/beta';
import {guideDocument} from '@/lib/guides';
export const runtime='nodejs';
export async function GET(r:Request,{params}:{params:Promise<{slug:string}>}){const account=await user(r);if(!account)return json({error:'Connecte-toi à Mentora pour lire les guides gratuits.'},401);if(!await canUseFeature(account.id,'guides'))return json({error:'Ces guides ne sont pas disponibles pour ce compte.'},403);const {slug}=await params;
 try{if(new URL(r.url).searchParams.has('download'))return json({error:'Les guides se consultent uniquement dans Mentora.'},403);const d=await guideDocument(slug);return d?json(d):json({error:'Guide introuvable.'},404);}catch{return json({error:'Le guide est momentanément indisponible.'},503);}}
