import {notificationRoles} from "@/lib/discord-community/notifications";
import {z} from 'zod';
import {user,json,guard} from '@/lib/http';
import {isCrmOwner} from '@/lib/crm';
import {query} from '@/lib/db';
import {inspectChannel,publishRepost,recoverRepost,deleteOriginal,publishInfo} from '@/lib/discord-community/service';
import {publishGuideChannels} from '@/lib/discord-community/guides';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Accès refusé.'},403);try{return json({posts:await query('SELECT source_id,channel_id,kind,source_json,message_ids,state FROM discord_reposts ORDER BY source_id'),panels:await query('SELECT * FROM discord_community_panels'),welcomes:await query('SELECT event_id,state,created_at FROM discord_welcomes ORDER BY created_at DESC LIMIT 10')});}catch(e){return json({error:(e as Error).message||'Lecture Discord indisponible.'},503);}}
const input=z.object({action:z.enum(['inspect','publish','recover','delete','invite','roles','guides','notifications']),kind:z.enum(['rules','roles','mobile','guide','link']).optional(),id:z.string().regex(/^\d{15,22}$/).optional()}).strict();
export async function POST(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Accès refusé.'},403);const denied=await guard(r);if(denied)return denied;try{const d=input.parse(await r.json());if(d.action==='notifications')return json({roles:await notificationRoles(true)});if(d.action==='guides')return json(await publishGuideChannels());if(d.action==='inspect'&&d.kind)return json(await inspectChannel(d.kind));if(d.action==='invite'||d.action==='roles')return json(await publishInfo(d.action));if(!d.id)return json({error:'Message requis.'},400);if(d.action==='publish')return json(await publishRepost(d.id));if(d.action==='recover')return json(await recoverRepost(d.id));if(d.action==='delete')return json(await deleteOriginal(d.id));return json({error:'Action inconnue.'},400);}catch(e){return json({error:e instanceof z.ZodError?'Demande invalide.':(e as Error).message},400);}}
