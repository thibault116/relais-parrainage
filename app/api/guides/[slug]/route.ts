import {user,json} from '@/lib/http';
import {isCrmOwner} from '@/lib/crm';
import {guideDocument,guideDownload} from '@/lib/guides';
export const runtime='nodejs';
export async function GET(r:Request,{params}:{params:Promise<{slug:string}>}){if(!await isCrmOwner(await user(r)))return json({error:'Ces guides sont réservés au compte administrateur principal pour le moment.'},403);const {slug}=await params;
 try{if(new URL(r.url).searchParams.get('download')==='1'){const d=await guideDownload(slug);if(!d)return json({error:'Guide introuvable.'},404);return new Response(new Uint8Array(d.bytes),{headers:{'Content-Type':d.type,'Content-Disposition':`attachment; filename="${d.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox allow-popups"}});}const d=await guideDocument(slug);return d?json(d):json({error:'Guide introuvable.'},404);}catch{return json({error:'Le guide est momentanément indisponible.'},503);}}
