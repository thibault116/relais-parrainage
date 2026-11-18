import {z} from "zod";
import {user,json,guard} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {query} from "@/lib/db";
import {config} from "@/lib/discord-tickets/store";
import {configureTickets,publishPanel,recoverPanel,recoverTicket,setupSchema} from "@/lib/discord-tickets/service";
import {ticketPanel} from "@/lib/discord-tickets/shared";
export const runtime="nodejs";export const maxDuration=60;
export async function GET(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Accès refusé.'},403);return json({config:await config(),ready:!!process.env.DISCORD_TICKET_BOT_TOKEN&&!!process.env.DISCORD_TICKET_APPLICATION_ID&&!!process.env.DISCORD_TICKET_PUBLIC_KEY,applicationId:process.env.DISCORD_TICKET_APPLICATION_ID||'',endpoint:'https://mentora-resell.vercel.app/api/discord/interactions',preview:ticketPanel(),tickets:await query('SELECT id,user_id,category,channel_id,state,created_at FROM discord_tickets ORDER BY created_at DESC LIMIT 100')});}
export async function POST(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Accès refusé.'},403);const denied=await guard(r);if(denied)return denied;
 try{const d=await r.json();if(d.action==='configure')return json(await configureTickets(setupSchema.parse(d.setup)));if(d.action==='publish')return json(await publishPanel());if(d.action==='recover-panel')return json(await recoverPanel());if(d.action==='recover-ticket')return json(await recoverTicket(z.string().regex(/^\d{15,22}$/).parse(d.id)));return json({error:'Action inconnue.'},400);}catch(e){return json({error:e instanceof z.ZodError?'Vérifie les identifiants Discord.':(e as Error).message},400);}}
