import {createHash} from 'node:crypto';
import {query} from '../db';
import {SITE_ORIGIN,updateLinkValues} from '../site';
import {config} from '../discord-tickets/store';
import {discordApi,type DiscordApi} from '../discord-tickets/client';
export type Message = {id:string;channel_id:string;author?:{id:string};webhook_id?:string;content?:string;embeds?:any[];components?:any[];flags?:number;type?:number};
function webhook(){
 const raw=process.env.DISCORD_CHANGELOG_WEBHOOK_URL;if(!raw)return null;
 const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='discord.com'||!/^\/api(?:\/v10)?\/webhooks\/\d{15,22}\/[\w-]+$/.test(u.pathname))return null;
 return {id:u.pathname.split('/').at(-2)!,url:u.origin+u.pathname};
}
export function messagePatch(m:Message){
 const embed=(e:any)=>Object.fromEntries(Object.entries({title:e.title,description:e.description,url:e.url,timestamp:e.timestamp,color:e.color,fields:e.fields,author:e.author?{name:e.author.name,url:e.author.url,icon_url:e.author.icon_url}:undefined,footer:e.footer?{text:e.footer.text,icon_url:e.footer.icon_url}:undefined,image:e.image?{url:e.image.url}:undefined,thumbnail:e.thumbnail?{url:e.thumbnail.url}:undefined}).filter(([,v])=>v!==undefined));
 const before={content:m.content||'',embeds:(m.embeds||[]).map(embed),components:m.components||[]};
 const after=updateLinkValues(before);
 // Give migrated media a distinct cache key: Discord can retain the previous
 // thumbnail URL when two domains serve identical image bytes.
 for(let i=0;i<after.embeds.length;i++)for(const key of ['image','thumbnail'] as const){
  const media=after.embeds[i][key];
  if(media?.url&&media.url!==before.embeds[i][key]?.url){const u=new URL(media.url);u.searchParams.set('domain','mentora-resell.app');media.url=u.toString();}
 }
 return JSON.stringify(before)!==JSON.stringify(after)?{before,after,patch:{...after,allowed_mentions:{parse:[] as string[]}}}:null;
}
export async function linkChannels(api:DiscordApi=discordApi){
 const c=await config();if(!c)throw Error('Bot non configuré.');
 const guild=await api(`/guilds/${c.guild_id}`);if(guild.owner_id!==c.owner_id)throw Error('Propriétaire Discord différent.');
 const channels=await api<any[]>(`/guilds/${c.guild_id}/channels`);
 const active=await api<any>(`/guilds/${c.guild_id}/threads/active`);
 return {origin:SITE_ORIGIN,channels:[...channels.filter(ch=>[0,5].includes(ch.type)),...(active.threads||[])].map(ch=>({id:ch.id,name:ch.name,type:ch.type})),archiveParents:channels.filter(ch=>[0,5,15,16].includes(ch.type)).map(ch=>({id:ch.id,name:ch.name}))};
}
async function access(channel:string,api:DiscordApi){const c=await config();if(!c)throw Error('Bot non configuré.');const ch=await api(`/channels/${channel}`);if(ch.guild_id!==c.guild_id)throw Error('Salon extérieur au serveur Mentora.');return c;}
export async function scanLinks(channel:string,before='',api:DiscordApi=discordApi){
 const c=await access(channel,api),messages=await api<Message[]>(`/channels/${channel}/messages?limit=100${before?`&before=${before}`:''}`),hook=webhook();
 return {channel,scanned:messages.length,before:messages.length===100?messages.at(-1)!.id:null,matches:messages.filter(m=>messagePatch(m)).map(m=>({id:m.id,channel,author:m.author?.id===c.owner_id?'owner':m.author?.id===c.bot_id?'bot':hook&&m.webhook_id===hook.id?'webhook':'other',editable:m.author?.id===c.bot_id||!!hook&&m.webhook_id===hook.id,replacement:m.author?.id===c.owner_id?updateLinkValues(m.content||''):undefined,preview:(m.content||(m.embeds||[]).map(e=>e.description||e.title||'').join('\n')).slice(0,220),url:`https://discord.com/channels/${c.guild_id}/${channel}/${m.id}`}))};
}
export async function replaceMessageLinks(actor:string,channel:string,id:string,api:DiscordApi=discordApi){
 const c=await access(channel,api),m=await api<Message>(`/channels/${channel}/messages/${id}`),change=messagePatch(m),hook=webhook();
 if(m.author?.id!==c.bot_id&&(!hook||m.webhook_id!==hook.id))throw Error('Seul l’auteur peut modifier ce message.');
 if(!change)return {id,state:'unchanged'};
 const digest=createHash('sha256').update(JSON.stringify(change.before)).digest('hex'),key=`${id}:${digest}`;
 await query(`CREATE TABLE IF NOT EXISTS discord_link_changes(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,actor_id TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,state TEXT NOT NULL,updated_at TEXT NOT NULL)`);
 await query("INSERT INTO discord_link_changes(id,guild_id,channel_id,message_id,actor_id,before_json,after_json,state,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8) ON CONFLICT(id) DO UPDATE SET state='pending',updated_at=excluded.updated_at",[key,c.guild_id,channel,id,actor,JSON.stringify(change.before),JSON.stringify(change.after),new Date().toISOString()]);
 try{
 if(m.author?.id===c.bot_id)await api(`/channels/${channel}/messages/${id}`,'PATCH',change.patch);
 else {const r=await fetch(`${hook!.url}/messages/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(change.patch),redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`Modification du webhook refusée (${r.status}).`);}
 const saved=await api<Message>(`/channels/${channel}/messages/${id}`);
 if(messagePatch(saved))throw Error('La vérification du nouveau lien a échoué.');
 await query("UPDATE discord_link_changes SET state='updated',updated_at=$1 WHERE id=$2",[new Date().toISOString(),key]);return {id,state:'updated'};
 }catch(e){await query("UPDATE discord_link_changes SET state='failed',updated_at=$1 WHERE id=$2",[new Date().toISOString(),key]);throw e;}
}
export async function archivedLinkChannels(channel:string,mode:'public'|'joined',before='',api:DiscordApi=discordApi){
 await access(channel,api);
 const path=mode==='public'?`/channels/${channel}/threads/archived/public`:`/channels/${channel}/users/@me/threads/archived/private`;
 const d=await api<any>(`${path}?limit=100${before?`&before=${encodeURIComponent(before)}`:''}`),threads=d.threads||[];
 const next=d.has_more?(mode==='public'?threads.at(-1)?.thread_metadata?.archive_timestamp:threads.at(-1)?.id):null;
 if(d.has_more&&!next)throw Error('Pagination des fils Discord incomplète.');
 return {channels:threads.map((ch:any)=>({id:ch.id,name:ch.name,type:ch.type})),before:next};
}
