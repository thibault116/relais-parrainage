import {z} from 'zod';
import {user,json,guard} from '@/lib/http';
import {isCrmOwner} from '@/lib/crm';
import {linkChannels,scanLinks,replaceMessageLinks,archivedLinkChannels} from '@/lib/discord-community/link-migration';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Accès refusé.'},403);try{return json(await linkChannels());}catch{return json({error:'Lecture des salons Discord impossible.'},503);}}
const snow=z.string().regex(/^\d{15,22}$/);
export async function POST(r:Request){const u=await user(r);if(!await isCrmOwner(u))return json({error:'Accès refusé.'},403);const denied=await guard(r);if(denied)return denied;try{const d=z.discriminatedUnion('action',[z.object({action:z.literal('scan'),channel:snow,before:snow.optional()}).strict(),z.object({action:z.literal('replace'),channel:snow,id:snow}).strict(),z.object({action:z.literal('archives'),channel:snow,mode:z.enum(['public','joined']),before:z.string().max(40).regex(/^[0-9TZ:.+\-]+$/).optional()}).strict()]).parse(await r.json());return json(d.action==='archives'?await archivedLinkChannels(d.channel,d.mode,d.before):d.action==='scan'?await scanLinks(d.channel,d.before):await replaceMessageLinks(u!.id,d.channel,d.id));}catch(e){return json({error:e instanceof z.ZodError?'Demande invalide.':(e as Error).message},400);}}
