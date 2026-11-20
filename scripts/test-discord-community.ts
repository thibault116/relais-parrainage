import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {query,database} from '../lib/db';
import {migrateDiscordTickets} from '../lib/discord-tickets/store';
import {migrateDiscordCommunity} from '../lib/discord-community/store';
import {channelKind,textChunks,repostPayloads,inspectChannel,publishRepost,deleteOriginal,toggleRole,sendWelcome} from '../lib/discord-community/service';
import type {DiscordApi} from '../lib/discord-tickets/client';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Isolated local test only');
const cwd=process.cwd(),dir=await mkdtemp(join(tmpdir(),'mentora-community-'));process.chdir(dir);
try{
 await migrateDiscordTickets();await migrateDiscordCommunity();
 const guild='111111111111111111',owner='222222222222222222',bot='333333333333333333',channel='444444444444444444',sourceId='555555555555555555',member='666666666666666666',role='777777777777777777',welcome='888888888888888888';
 await query("INSERT INTO discord_ticket_config(id,guild_id,panel_channel,owner_id,bot_id,updated_at) VALUES('main',$1,$2,$3,$4,'now')",[guild,channel,owner,bot]);
 const content='# 📜 Règles\n\nTexte **exact**, accents et @everyone.\n'+('💜 Ligne complète !\n'.repeat(280));
 assert.equal(channelKind('📜┃règles'),'rules');assert.equal(textChunks(content).join(''),content);assert(textChunks(content).every(x=>x.length<=3900));
 const original={id:sourceId,author:{id:owner},type:0,content,attachments:[]};let deleted=0,sent:any[]=[],counter=0,rolePermissions='0',roleWrites=0;
 const announcementRole='101010101010101010';let assignedRoles:string[]=[];
 const fake:DiscordApi=async<T>(path:string,method='GET',data:any=undefined)=>{
  if(path===`/channels/${channel}`)return {id:channel,guild_id:guild,name:'📜┃règles',permission_overwrites:[]} as T;
  if(path===`/channels/${channel}/permissions/${bot}`&&method==='PUT')return null as T;
  if(path===`/guilds/${guild}`)return {owner_id:owner} as T;
  if(path===`/guilds/${guild}?with_counts=true`)return {approximate_member_count:31} as T;
  if(path===`/guilds/${guild}/channels`)return [{id:channel,name:'📜┃règles',type:0},{id:welcome,name:'👋┃bienvenue',type:0}] as T;
  if(path===`/guilds/${guild}/roles`)return [{id:role,name:'Mises à jour Mentora',permissions:rolePermissions},{id:announcementRole,name:'Annonces Mentora',permissions:'0'}] as T;
  if(path===`/channels/${channel}/messages?limit=100`)return [original] as T;
  if(path===`/channels/${channel}/messages/${sourceId}`){if(method==='DELETE'){deleted++;return null as T;}return original as T;}
  if(method==='POST'&&path.endsWith('/messages')){const m={id:String(900000000000000000n+BigInt(++counter)),author:{id:bot},...data};sent.push(m);return m as T;}
  if(path.startsWith(`/channels/${channel}/messages/`))return sent.find(m=>m.id===path.split('/').at(-1)) as T;
  if(path===`/guilds/${guild}/members/${member}`)return {user:{id:member,username:'Test'},roles:[...assignedRoles],joined_at:'2026-11-18T11:00:00+00:00'} as T;
  if([role,announcementRole].some(id=>path===`/guilds/${guild}/members/${member}/roles/${id}`)){roleWrites++;const id=path.split('/').at(-1)!;assignedRoles=method==='PUT'?[...assignedRoles,id]:assignedRoles.filter(r=>r!==id);return null as T;}
  throw Error('Unexpected '+path);
 };
 await inspectChannel('rules',fake);assert.equal((await query('SELECT * FROM discord_reposts')).length,1);
 await assert.rejects(()=>deleteOriginal(sourceId,fake));assert.equal(deleted,0);
 await publishRepost(sourceId,fake);const count=sent.length;await publishRepost(sourceId,fake);assert.equal(sent.length,count);assert.equal(sent.map(m=>m.embeds.map((e:any)=>e.description||'').join('')).join(''),content);assert(sent.every(m=>m.allowed_mentions.parse.length===0));
 const saved=sent[0].embeds[1].description;sent[0].embeds[1].description='altéré';await assert.rejects(()=>deleteOriginal(sourceId,fake));assert.equal(deleted,0);sent[0].embeds[1].description=saved;
 await deleteOriginal(sourceId,fake);await deleteOriginal(sourceId,fake);assert.equal(deleted,1);
 assert.throws(()=>repostPayloads({...original,attachments:[{id:'x'}]},'rules'));
 process.env.DISCORD_TICKET_APPLICATION_ID='999999999999999999';
 await query("INSERT INTO discord_community_panels(kind,channel_id,message_id,state,details) VALUES('roles',$1,'panel','published',$2)",[channel,JSON.stringify({updates:role,announcements:announcementRole})]);
 const interaction={application_id:process.env.DISCORD_TICKET_APPLICATION_ID,guild_id:guild,channel_id:channel,message:{id:'panel'},member:{user:{id:member}},data:{custom_id:'mentora:role:updates'}};
 await toggleRole({...interaction,guild_id:'another'},fake);assert.equal(roleWrites,0);rolePermissions='8';await toggleRole(interaction,fake);assert.equal(roleWrites,0);rolePermissions='0';await toggleRole(interaction,fake);assert.equal(roleWrites,1);
 assert.deepEqual(assignedRoles,[role]);assert.equal(await toggleRole(interaction,fake),'Notification retirée.');assert.deepEqual(assignedRoles,[]);
 const announcementInteraction={...interaction,data:{custom_id:'mentora:role:announcements'}};assert.equal(await toggleRole(announcementInteraction,fake),'Notification activée.');assert.deepEqual(assignedRoles,[announcementRole]);assert.equal(await toggleRole(announcementInteraction,fake),'Notification retirée.');assert.deepEqual(assignedRoles,[]);
 const event={id:'a'.repeat(64),guild,user:member,joined:'2026-11-18T11:00:00+00:00'};
 await sendWelcome(event,fake);const after=sent.length;await sendWelcome(event,fake);assert.equal(sent.length,after);assert.equal((await query('SELECT state FROM discord_welcomes'))[0].state,'sent');
 await assert.rejects(()=>sendWelcome({...event,id:'b'.repeat(64),joined:'wrong'},fake));
 console.log('PASS: exact texts, archive, verified deletion, idempotence, attachment protection, safe roles, welcome deduplication.');
}finally{const db=database();if(db instanceof DatabaseSync)db.close();process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
