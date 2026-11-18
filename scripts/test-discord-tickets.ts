import {getAuth} from "../lib/auth";
import {getMigrations} from "better-auth/db/migration";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {query,database} from "../lib/db";
import {migrateDiscordTickets,config,ticket} from "../lib/discord-tickets/store";
import {configureTickets,publishPanel,recoverPanel,interpret,openTicket,closeTicket,recoverTicket,type Interaction} from "../lib/discord-tickets/service";
import {ticketPermissions,verifyInteraction} from "../lib/discord-tickets/security";
import {ticketPanel} from "../lib/discord-tickets/shared";
import type {DiscordApi} from "../lib/discord-tickets/client";
import {POST as endpoint} from "../app/api/discord/interactions/route";
import {GET as adminGET,POST as adminPOST} from "../app/api/admin/discord-tickets/route";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Local isolated tests only');
const cwd=process.cwd(),env={...process.env},dir=await mkdtemp(join(tmpdir(),'mentora-discord-tickets-'));process.chdir(dir);
try{
 await migrateDiscordTickets();
 const auth=getAuth();await(await getMigrations(auth.options)).runMigrations();
 const guild='111111111111111111',panel='222222222222222222',owner='333333333333333333',bot='444444444444444444',member='555555555555555555',other='666666666666666666',app='777777777777777777';
 const keys=generateKeyPairSync('ed25519'),publicKey=(keys.publicKey.export({format:'der',type:'spki'}) as Buffer).subarray(-32).toString('hex');
 process.env.DISCORD_TICKET_APPLICATION_ID=app;process.env.DISCORD_TICKET_PUBLIC_KEY=publicKey;
 const ts=String(Math.floor(Date.now()/1000)),body=JSON.stringify({application_id:app,type:1}),signature=sign(null,Buffer.from(ts+body),keys.privateKey).toString('hex');
 assert(verifyInteraction(body,signature,ts,publicKey));assert(!verifyInteraction(body+' ',signature,ts,publicKey));assert(!verifyInteraction(body,signature,ts,publicKey,Date.now()+600000));assert(!verifyInteraction(body,null,ts,publicKey));
 assert.equal((await endpoint(new Request('http://localhost/api/discord/interactions',{method:'POST',body}))).status,401);
 const ping=await endpoint(new Request('http://localhost/api/discord/interactions',{method:'POST',body,headers:{'x-signature-ed25519':signature,'x-signature-timestamp':ts}}));assert.equal(ping.status,200);assert.deepEqual(await ping.json(),{type:1});
 assert.equal((await adminGET(new Request('http://localhost/api/admin/discord-tickets'))).status,403);assert.equal((await adminPOST(new Request('http://localhost/api/admin/discord-tickets',{method:'POST',body:'{}'}))).status,403);
 let panelCreates=0,channelCreates=0,messageCreates=0,patches:any[]=[];const channels:any[]=[],messages:any[]=[];
 const fake:DiscordApi=async<T>(path:string,method='GET',data:any=undefined)=>{
 if(path===`/guilds/${guild}`)return {id:guild,owner_id:owner} as T;
 if(path===`/channels/${panel}`)return {id:panel,guild_id:guild,type:0} as T;
 if(path==='/users/@me')return {id:bot,bot:true} as T;
 if(path==='/oauth2/applications/@me')return {id:app} as T;
 if(path===`/channels/${panel}/messages`&&method==='POST'){panelCreates++;const m={id:'888888888888888888',...data,author:{id:bot}};messages.push(m);return m as T;}
 if(path===`/channels/${panel}/messages`&&method==='GET')return messages as T;
 if(path===`/guilds/${guild}/channels`&&method==='POST'){channelCreates++;const channel={id:String(900000000000000000n+BigInt(channelCreates)),guild_id:guild,...data};channels.push(channel);return channel as T;}
 if(path===`/guilds/${guild}/channels`&&method==='GET')return channels as T;
 if(method==='PATCH'){patches.push({path,data});return {id:path.split('/')[2]} as T;}
 if(method==='POST'&&path.endsWith('/messages')){messageCreates++;return {id:'999999999999999999'} as T;}
 if(method==='GET'&&path.endsWith('/messages'))return [] as T;
 throw Error('Unexpected mock request '+path+' '+method);
 };
 await configureTickets({guild,channel:panel,category:''},fake);await publishPanel(fake);await publishPanel(fake);assert.equal(panelCreates,1);assert.equal((await config()).owner_id,owner);assert.deepEqual(ticketPanel().allowed_mentions,{parse:[]});assert(ticketPanel().components[0].components[0].options.some(o=>o.value==="recruitment"));
 await query("UPDATE discord_ticket_config SET panel_message='',panel_state='uncertain'");await recoverPanel(fake);assert.equal(panelCreates,1);
 const i:Interaction={id:'100000000000000001',application_id:app,type:3,guild_id:guild,channel_id:panel,token:'fixture-not-real-token',member:{user:{id:member}},message:{id:'888888888888888888'},data:{custom_id:'mentora:ticket:category:v1',values:['technical']}};
 assert.equal((await interpret(i)).response.type,9);assert.equal((await interpret({...i,guild_id:other})).response.type,4);assert.equal((await interpret({...i,message:{id:other}})).response.type,4);
 const modal={...i,type:5,data:{custom_id:'mentora:ticket:open:technical',components:[{components:[{custom_id:'details',value:'Mon problème de test est suffisamment détaillé.'}]}]}};
 assert.equal((await interpret(modal)).response.type,5);
 const c=(await config())!;
 const [a,b]=await Promise.all([openTicket(i,c,member,'technical','Test uniquement, ne pas envoyer.',fake),openTicket({...i,id:'100000000000000002'},c,member,'technical','Autre test.',fake)]);assert.equal(channelCreates,1);assert.equal(messageCreates,1);assert(a.includes('ouvert')||b.includes('ouvert'));
 const t=(await ticket(i.id))!;
 const overwrites=channels[0].permission_overwrites;assert.equal(overwrites.find((p:any)=>p.id===guild).deny,'1024');assert.deepEqual(overwrites.filter((p:any)=>p.type===1).map((p:any)=>p.id).sort(),[owner,bot,member].sort());assert(!overwrites.some((p:any)=>p.id===other));
 const forged={...i,channel_id:t.channel_id!,data:{custom_id:`mentora:ticket:close:${t.id}`},member:{user:{id:other}}};assert.equal((await interpret(forged)).response.type,4);await assert.rejects(()=>closeTicket(i,c,t,other,fake),/refusé/);
 await closeTicket({...i,id:'100000000000000003'},c,t,member,fake);assert.equal((await ticket(t.id))!.state,'closed');const closed=patches.at(-1).data.permission_overwrites.find((p:any)=>p.id===member);assert.equal(closed.deny,'2048');assert.equal(Number(closed.allow)&1024,1024);
 const before=channelCreates;await openTicket({...i,id:'100000000000000004'},c,member,'account','Deuxième demande après fermeture.',fake);assert.equal(channelCreates,before+1);
 // Ambiguous external failure: do not create a second channel on retry; recover by marker.
 const failing:DiscordApi=async<T>(p:string,m?:string,d?:unknown)=>{if(m==='POST'&&p.endsWith('/messages')&&!p.includes(panel))throw Error('Simulated timeout');return fake<T>(p,m,d);};
 const failed={...i,id:'100000000000000005',member:{user:{id:other}}};await openTicket(failed,c,other,'payments','Test de réponse incertaine.',failing);assert.equal((await ticket(failed.id))!.state,'uncertain');const created=channelCreates;await openTicket({...failed,id:'100000000000000006'},c,other,'payments','Réessai.',fake);assert.equal(channelCreates,created);await recoverTicket(failed.id,fake);assert.equal((await ticket(failed.id))!.state,'open');assert.equal(channelCreates,created);
 const permissions=ticketPermissions(guild,owner,bot,member,true);assert(permissions.every(p=>(BigInt(p.allow)&8n)===0n));
 console.log('PASS signatures Ed25519, requête modifiée/expirée refusée, PING Discord et API admin protégée');
 console.log('PASS panneau unique et menu, serveur/salon vérifiés, formulaire, catégories validées');
 console.log('PASS un ticket par membre en concurrence, accès privé explicite, fermeture réservée aux participants et historique conservé');
 console.log('PASS timeout sans doublon et récupération du salon existant ; aucun appel Discord réel');
}finally{(database() as {close:()=>void}).close();process.chdir(cwd);for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true});}
