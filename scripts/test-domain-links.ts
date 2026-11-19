import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {getAuth} from '../lib/auth';
import {GET as routeGet,POST as routePost} from '../app/api/admin/discord-links/route';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {DatabaseSync} from 'node:sqlite';
import {SITE_ORIGIN,updateSiteLinks,updateLinkValues} from '../lib/site';
import {messagePatch,scanLinks,replaceMessageLinks} from '../lib/discord-community/link-migration';
import {migrateDiscordTickets} from '../lib/discord-tickets/store';import {query,database} from '../lib/db';
import type {DiscordApi} from '../lib/discord-tickets/client';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Local isolated test only');
assert.equal(updateSiteLinks('https://mentora-resell.vercel.app/?mobile=guides&guide=photos-et-annonces#workspace'),SITE_ORIGIN+'/?mobile=guides&guide=photos-et-annonces#workspace');
assert.equal(updateSiteLinks('https://relais-parrainage.vercel.app/path?q=a#x'),SITE_ORIGIN+'/path?q=a#x');
for(const url of ['https://mentora-resell.vercel.app.evil.example','https://other.example','mail@mentora-resell.vercel.app'])assert.equal(updateSiteLinks(url),url);
assert.equal(updateSiteLinks(SITE_ORIGIN),SITE_ORIGIN);assert.equal(updateSiteLinks('mentora-resell.vercel.app'),new URL(SITE_ORIGIN).host);
assert.deepEqual(updateLinkValues({url:'https://mentora-resell.vercel.app',n:2}),{url:SITE_ORIGIN,n:2});
const cwd=process.cwd(),dir=await mkdtemp(join(tmpdir(),'mentora-domain-'));process.chdir(dir);
try{
 await migrateDiscordTickets();await query("INSERT INTO discord_ticket_config(id,guild_id,panel_channel,owner_id,bot_id,updated_at) VALUES('main','g','c','owner','bot','now')");
 const msg:any={id:'m',channel_id:'c',author:{id:'bot'},content:'@everyone **Guide** https://mentora-resell.vercel.app/?guide=photos-et-annonces#workspace',embeds:[{type:'rich',description:'Texte inchangé',url:'https://mentora-resell.vercel.app',image:{url:'https://mentora-resell.vercel.app/discord/guide.png',width:100,proxy_url:'https://cdn.discordapp.com/proxy'}}],components:[{type:1,components:[{type:2,style:5,label:'Lire',url:'https://mentora-resell.vercel.app/?guide=photos-et-annonces#workspace'}]}]};
 let writes=0;const fake:DiscordApi=async<T>(path:string,method='GET',body?:any)=>{if(path==='/channels/c')return {guild_id:'g'} as T;if(path==='/channels/foreign')return {guild_id:'other'} as T;if(path==='/channels/c/messages?limit=100')return [structuredClone(msg),{...structuredClone(msg),id:'u',author:{id:'owner'}}] as T;if(path==='/channels/c/messages/m'){if(method==='PATCH'){writes++;assert.deepEqual(body.allowed_mentions,{parse:[]});Object.assign(msg,body);}return structuredClone(msg) as T;}if(path==='/channels/c/messages/u')return {id:'u',author:{id:'owner'},content:'https://mentora-resell.vercel.app'} as T;throw Error(path);};
 const patch=messagePatch(msg)!;assert(!('proxy_url' in patch.after.embeds[0].image!));assert(patch.after.content.includes('@everyone **Guide**'));assert.equal(patch.after.components[0].components[0].url,SITE_ORIGIN+'/?guide=photos-et-annonces#workspace');
 const scan=await scanLinks('c','',fake);assert.equal(scan.matches.length,2);assert.equal(scan.matches[1].editable,false);
 await assert.rejects(()=>scanLinks('foreign','',fake),/extérieur/);await assert.rejects(()=>replaceMessageLinks('owner','c','u',fake),/auteur/);
 assert.equal((await replaceMessageLinks('owner','c','m',fake)).state,'updated');assert.equal(writes,1);assert.equal((await replaceMessageLinks('owner','c','m',fake)).state,'unchanged');assert.equal(writes,1);assert.equal((await query("SELECT * FROM discord_link_changes WHERE state='updated'")).length,1);assert.equal(messagePatch(msg),null);
 const session=mock.method(getAuth().api,'getSession',async()=>null);assert.equal((await routeGet(new Request('https://www.mentora-resell.app/api/admin/discord-links'))).status,403);assert.equal((await routePost(new Request('https://www.mentora-resell.app/api/admin/discord-links',{method:'POST'}))).status,403);session.mock.restore();
 console.log('PASS: canonical links, guide paths/query/hash preserved, foreign hosts unchanged, author/guild controls, no mentions, archived audit and idempotent updates.');
}finally{const db=database();if(db instanceof DatabaseSync)db.close();process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
