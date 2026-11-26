import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {query,database} from '../lib/db';
import {migrateDiscordTickets} from '../lib/discord-tickets/store';
import {migrateDiscordCommunity} from '../lib/discord-community/store';
import {upgradeRolePanel,memberRoleInteraction,testGeographyOnBot} from '../lib/discord-community/member-roles';
import {geographicRoles} from '../lib/discord-community/role-options';
import type {DiscordApi} from '../lib/discord-tickets/client';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Isolated local test only');
const repo=process.cwd(),guild='111111111111111111',owner='222222222222222222',bot='333333333333333333',channel='444444444444444444',panel='555555555555555555',uid='666666666666666666',app='999999999999999999',beginner='100000000000000001',mentor='100000000000000002',updates='100000000000000003',announcements='100000000000000004',other='100000000000000005',botRole='100000000000000006';
process.env.DISCORD_TICKET_APPLICATION_ID=app;
let seq=0,posts=0,writes=0,failTarget='',failOnce=false,patches:any[]=[];
let roles:any[]=[{id:guild,name:'@everyone',permissions:'0',position:0},{id:botRole,name:'Mentora',permissions:String((1n<<28n)|16n|84992n),position:30},{id:beginner,name:'Débutant',permissions:'0',position:2},{id:mentor,name:'Parrain',permissions:'0',position:3},{id:updates,name:'Mises à jour Mentora',permissions:'0',position:4},{id:announcements,name:'Annonces Mentora',permissions:'0',position:5},{id:other,name:'Autre rôle',permissions:'0',position:1}];
let members:Record<string,string[]>={[uid]:[beginner,other],[owner]:[mentor,other],[bot]:[botRole]},channelName='🔔┃notifications';
const api:DiscordApi=async<T>(path:string,method='GET',body:any=undefined)=>{
 if(path===`/guilds/${guild}/roles`){if(method==='POST'){posts++;const r={...body,id:String(200000000000000000n+BigInt(posts)),position:1};roles.push(r);return r as T;}return roles as T;}
 if(path===`/guilds/${guild}`)return {owner_id:owner} as T;
 if(path===`/guilds/${guild}/channels`)return [{id:channel,name:channelName,type:0,permission_overwrites:[]}] as T;
 for(const user of [uid,owner,bot]){
  if(path===`/guilds/${guild}/members/${user}`)return {roles:[...members[user]]} as T;
  if(path.startsWith(`/guilds/${guild}/members/${user}/roles/`)){const role=path.split('/').at(-1)!;writes++;if(failOnce&&role===failTarget){failOnce=false;throw Error('Test de panne Discord');}if(method==='PUT')members[user]=[...new Set([...members[user],role])];else if(method==='DELETE')members[user]=members[user].filter(r=>r!==role);else throw Error('Invalid mutation');return null as T;}
 }
 if(path===`/channels/${channel}`&&method==='PATCH'){channelName=body.name;return {id:channel,name:channelName} as T;}
 if(path===`/channels/${channel}/messages/${panel}`){if(method==='PATCH'){patches.push(body);return {id:panel,...body} as T;}return {id:panel,author:{id:bot}} as T;}
 throw Error(`Unexpected ${method} ${path}`);
};
const interaction=(custom:string,values?:string[],user=uid)=>({id:String(800000000000000000n+BigInt(++seq)),application_id:app,type:3,guild_id:guild,channel_id:channel,token:'fixture-only-token',member:{user:{id:user}},message:{id:panel},data:{custom_id:custom,...(values?{values}:{})}});
const status=()=>interaction('mentora:member:status:v1');
const region=(key:string)=>interaction('mentora:member:region:v1',[key]);
if(process.argv[2]==='restart'){
 process.chdir(process.argv[3]);const state=JSON.parse(await readFile('.data/restart.json','utf8'));roles=state.roles;members=state.members;
 const response=await memberRoleInteraction(status(),api);assert(response.content.includes('déjà Parrain'));assert.equal(response.components?.length,0);assert(members[uid].includes(mentor));assert(!members[uid].includes(beginner));console.log('PASS: irreversible status survived a new process.');(database() as DatabaseSync).close();process.exit(0);
}
const dir=await mkdtemp(join(tmpdir(),'mentora-member-roles-'));process.chdir(dir);
try{
 await migrateDiscordTickets();await migrateDiscordCommunity();await query("INSERT INTO discord_ticket_config(id,guild_id,panel_channel,owner_id,bot_id,updated_at) VALUES('main',$1,$2,$3,$4,'now')",[guild,channel,owner,bot]);await query("INSERT INTO discord_community_panels(kind,channel_id,message_id,state,details) VALUES('roles',$1,$2,'published',$3)",[channel,panel,JSON.stringify({updates,announcements})]);
 const setup=await upgradeRolePanel(api);assert.equal(setup.messageId,panel);assert.equal(channelName,'choisir-mes-rôles');assert.equal(posts,15);assert.equal(patches.length,1);assert.equal(patches[0].components.length,3);assert.equal(patches[0].components[1].components[0].options.length,16);assert(patches[0].allowed_mentions.parse.length===0);assert(roles.slice(-15).every(r=>r.permissions==='0'&&!r.mentionable));
 await upgradeRolePanel(api);assert.equal(posts,15);const d=JSON.parse(String((await query("SELECT details FROM discord_community_panels WHERE kind='roles'"))[0].details));assert.equal(d.updates,updates);assert.equal(d.announcements,announcements);
 const selfTest=await testGeographyOnBot(api);assert(selfTest.restored);assert.deepEqual(members[bot],[botRole]);const {interpret}=await import('../lib/discord-tickets/service');const deferred=await interpret(status());assert.equal((deferred.response as any).data.flags,64);assert.equal(typeof deferred.work,'function');
 const initialWrites=writes;for(const bad of [{...region('bretagne'),guild_id:other},{...region('bretagne'),application_id:other},{...region('bretagne'),message:{id:other}},{...region('bretagne'),channel_id:other},region('invalid'),{...region('corse'),data:{custom_id:'mentora:member:region:v1',values:['corse','bretagne']}}])await memberRoleInteraction(bad,api);assert.equal(writes,initialWrites);
 for(const [key] of geographicRoles){const result=await memberRoleInteraction(region(key),api);assert(result.content.startsWith('Ta région'));assert.deepEqual(members[uid].filter(id=>Object.values(d.regions).includes(id)),[d.regions[key]]);assert(members[uid].includes(other));}
 await memberRoleInteraction(region('none'),api);assert(!members[uid].some(id=>Object.values(d.regions).includes(id)));
 const n=interaction('mentora:role:updates');await memberRoleInteraction(n,api);const after=writes;await memberRoleInteraction(n,api);assert.equal(writes,after);assert(members[uid].includes(updates));await memberRoleInteraction(interaction('mentora:role:updates'),api);assert(!members[uid].includes(updates));
 await memberRoleInteraction(interaction('mentora:role:announcements'),api);assert(members[uid].includes(announcements));await memberRoleInteraction(interaction('mentora:role:announcements'),api);assert(!members[uid].includes(announcements));
 failTarget=updates;failOnce=true;const retry=interaction('mentora:role:updates');assert((await memberRoleInteraction(retry,api)).content.includes('panne'));await memberRoleInteraction(retry,api);assert(members[uid].includes(updates));
 const prompt=await memberRoleInteraction(status(),api);assert(prompt.components?.length);assert(members[uid].includes(beginner));assert(!members[uid].includes(mentor));const confirmId=(prompt.components![0] as any).components[0].custom_id;
 await memberRoleInteraction(interaction(confirmId,undefined,owner),api);assert(!members[uid].includes(mentor));
 const cancelledPrompt=await memberRoleInteraction(status(),api),cancelId=(cancelledPrompt.components![0] as any).components[1].custom_id;await memberRoleInteraction(interaction(cancelId),api);assert(members[uid].includes(beginner));
 const expiredPrompt=await memberRoleInteraction(status(),api),expiredId=(expiredPrompt.components![0] as any).components[0].custom_id;await query("UPDATE discord_role_confirmations SET expires_at='2000-01-01T00:00:00.000Z' WHERE token=$1",[expiredId.split(':').at(-1)]);assert((await memberRoleInteraction(interaction(expiredId),api)).content.includes('expirée'));assert(members[uid].includes(beginner));
 members[owner]=[beginner,other];const ownerPrompt=await memberRoleInteraction(interaction('mentora:member:status:v1',undefined,owner),api),ownerConfirm=(ownerPrompt.components![0] as any).components[0].custom_id;failTarget=mentor;failOnce=true;assert((await memberRoleInteraction(interaction(ownerConfirm,undefined,owner),api)).content.includes('panne'));assert(!members[owner].includes(beginner));assert(!members[owner].includes(mentor));await memberRoleInteraction(interaction('mentora:member:status:v1',undefined,owner),api);assert(members[owner].includes(mentor));assert(!members[owner].includes(beginner));
 const confirmed=await memberRoleInteraction(interaction(confirmId),api);assert(confirmed.content.includes('maintenant Parrain'));assert(members[uid].includes(mentor));assert(!members[uid].includes(beginner));assert(members[uid].includes(other));
 const noDowngrade=await memberRoleInteraction(status(),api);assert(!noDowngrade.components?.length);assert(noDowngrade.content.includes('déjà Parrain'));
 members[uid].push(beginner);await memberRoleInteraction(region('corse'),api);assert(!members[uid].includes(beginner));
 members[uid]=members[uid].filter(r=>r!==mentor);await memberRoleInteraction(status(),api);assert(members[uid].includes(mentor));
 roles.find(r=>r.id===d.regions.corse).permissions='8';const safeWrites=writes;await memberRoleInteraction(region('bretagne'),api);assert.equal(writes,safeWrites);roles.find(r=>r.id===d.regions.corse).permissions='0';
 roles.find(r=>r.id===mentor).position=40;await memberRoleInteraction(status(),api);assert.equal(writes,safeWrites);roles.find(r=>r.id===mentor).position=3;
 await query("UPDATE discord_member_preferences SET lease_id='another',lease_until=$3 WHERE guild_id=$1 AND user_id=$2",[guild,uid,new Date(Date.now()+60000).toISOString()]);const locked=await memberRoleInteraction(region('bretagne'),api);assert(locked.content.includes('déjà en cours'));await query("UPDATE discord_member_preferences SET lease_id='',lease_until='' WHERE guild_id=$1 AND user_id=$2",[guild,uid]);
 await writeFile('.data/restart.json',JSON.stringify({roles,members}));const child=spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/test-discord-roles.ts'),'restart',dir],{cwd:repo,env:{...process.env,TSX_TSCONFIG_PATH:join(repo,'tsconfig.json')},encoding:'utf8'});assert.equal(child.status,0,child.stdout+child.stderr);assert(child.stdout.includes('survived'));
 assert((await query("SELECT interaction_id FROM discord_role_actions WHERE state='applied'")).length>20);
 console.log('PASS: existing panel edited without duplicates, same notification roles, 15 zero-permission geographic roles, exclusive changes/removal, confirmation/cancel/ownership, monotonic mentor status, unrelated roles retained, hierarchy/sensitive permissions, deduplicated retries, lease serialization, durable audit and restart.');
}finally{(database() as DatabaseSync).close();process.chdir(repo);await rm(dir,{recursive:true,force:true});}
