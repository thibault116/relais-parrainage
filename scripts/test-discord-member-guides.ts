import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {query,database} from '../lib/db';
import {migrateDiscordTickets} from '../lib/discord-tickets/store';
import {migrateDiscordCommunity} from '../lib/discord-community/store';
import {guidePanel,publishGuideChannels} from '../lib/discord-community/guides';
import {memberGuides} from '../lib/guides-catalog';
import type {DiscordApi} from '../lib/discord-tickets/client';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Isolated tests only');
const cwd=process.cwd(),directory=await mkdtemp(join(tmpdir(),'mentora-discord-guides-'));process.chdir(directory);
try{
 await migrateDiscordTickets();await migrateDiscordCommunity();
 await query("INSERT INTO discord_ticket_config(id,guild_id,panel_channel,owner_id,bot_id,updated_at) VALUES('main','guild','panel','owner','bot','now')");
 const channels:any[]=[{id:'category',name:'📚┃GUIDES GRATUITS',type:4}],messages:any[]=[];let creates=0,posts=0;
 const api:DiscordApi=async<T>(path:string,method='GET',body?:unknown)=>{
  if(path==='/guilds/guild')return {owner_id:'owner'} as T;
  if(path==='/guilds/guild/roles')return [] as T;
  if(path==='/guilds/guild/channels'){if(method==='GET')return structuredClone(channels) as T;const ch={...(body as object),id:`channel-${++creates}`,guild_id:'guild'};channels.push(ch);return structuredClone(ch) as T;}
  const match=path.match(/^\/channels\/([^/]+)(?:\/messages(?:\/([^?]+))?)?/);assert(match,path);const [,cid,mid]=match;
  if(!path.includes('/messages'))return structuredClone(channels.find(c=>c.id===cid)) as T;
  if(method==='POST'){const m={...(body as object),id:`message-${++posts}`,channel_id:cid,author:{id:'bot'}};messages.push(m);return structuredClone(m) as T;}
  if(mid){const m=messages.find(m=>m.id===mid);if(method==='PATCH')Object.assign(m,body);return structuredClone(m) as T;}
  return structuredClone(messages.filter(m=>m.channel_id===cid)) as T;
 };
 const result=await publishGuideChannels(api);assert.equal(result.guides.length,4);assert.equal(creates,4);assert.equal(posts,4);
 await publishGuideChannels(api);assert.equal(creates,4);assert.equal(posts,4);
 for(const g of memberGuides){const payload=guidePanel(g.slug);assert(payload.embeds[0].description.includes('gratuit'));assert(payload.components[0].components[0].url.includes(`guide=${g.slug}`));assert.deepEqual(payload.allowed_mentions.parse,[]);}
 channels.push({id:'other-category',type:4,name:'guides'});await assert.rejects(()=>publishGuideChannels(api),/une seule catégorie/);assert.equal(posts,4);
 console.log('PASS: 4 guide channels, exact linked summaries, bot messages, idempotent republishing and ambiguous category refusal. No real Discord request.');
}finally{const db=database();if(db instanceof DatabaseSync)db.close();process.chdir(cwd);await rm(directory,{recursive:true,force:true});}
