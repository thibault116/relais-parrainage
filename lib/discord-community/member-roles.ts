import {randomBytes} from 'node:crypto';
import {query,inTransaction} from '../db';
import {config} from '../discord-tickets/store';
import {discordApi,type DiscordApi} from '../discord-tickets/client';
import {SITE_ORIGIN,updateSiteLinks} from '../site';
import {geographicRoles,rolePanelPayload,type RoleReply} from './role-options';
import type {Interaction} from '../discord-tickets/service';
type Role={id:string;name:string;permissions:string;managed?:boolean;position:number};
type Details={version:2;updates:string;announcements:string;regions:Record<string,string>;status:{beginner:string;mentor:string}};
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/^[^a-z0-9]+/,'').trim();
const basic=(1n<<6n)|(1n<<9n)|(1n<<10n)|(1n<<11n)|(1n<<14n)|(1n<<15n)|(1n<<16n)|(1n<<18n)|(1n<<20n)|(1n<<21n)|(1n<<25n)|(1n<<26n)|(1n<<31n)|(1n<<32n)|(1n<<35n)|(1n<<36n)|(1n<<37n)|(1n<<38n)|(1n<<39n)|(1n<<46n);
export async function roleInventory(api:DiscordApi=discordApi){
 const c=await config();if(!c)throw Error('Bot Mentora non configuré.');
 const [roles,channels,guild,bot]=await Promise.all([api<Role[]>(`/guilds/${c.guild_id}/roles`),api<any[]>(`/guilds/${c.guild_id}/channels`),api(`/guilds/${c.guild_id}`),api<{roles:string[]}>(`/guilds/${c.guild_id}/members/${c.bot_id}`)]);
 if(guild.owner_id!==c.owner_id)throw Error('Le propriétaire du serveur a changé.');
 const owned=roles.filter(r=>r.id===c.guild_id||bot.roles.includes(r.id)),perms=owned.reduce((n,r)=>n|BigInt(r.permissions),0n),admin=!!(perms&8n);
 if(!admin&&!(perms&(1n<<28n)))throw Error('Le bot doit disposer de Gérer les rôles.');
 const top=Math.max(0,...owned.map(r=>r.position));
 return {c,roles,channels,bot,perms,admin,top};
}
function manageable(role:Role|undefined,top:number,zero=false){if(!role||role.managed||role.position>=top||(!zero&&(BigInt(role.permissions)&~basic)!==0n)||(zero&&role.permissions!=='0'))throw Error('Un rôle est absent, protégé, trop haut ou contient des permissions sensibles.');return role;}
function assertDetails(d:Details,roles:Role[],top:number){
 const ids=[d.updates,d.announcements,d.status?.beginner,d.status?.mentor,...geographicRoles.map(([key])=>d.regions?.[key])];
 if(d.version!==2||ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Configure le nouveau panneau de rôles.');
 for(const id of ids)manageable(roles.find(r=>r.id===id),top,id!==d.status.beginner&&id!==d.status.mentor);
}
async function lease(guild:string,uid:string,id:string){return inTransaction(async q=>{
 const now=new Date().toISOString();await q("INSERT INTO discord_member_preferences(guild_id,user_id,updated_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[guild,uid,now]);
 return (await q("UPDATE discord_member_preferences SET lease_id=$3,lease_until=$4 WHERE guild_id=$1 AND user_id=$2 AND (lease_id='' OR lease_until<$5) RETURNING user_id",[guild,uid,id,new Date(Date.now()+180000).toISOString(),now])).length>0;
});}
async function release(guild:string,uid:string,id:string){await query("UPDATE discord_member_preferences SET lease_id='',lease_until='' WHERE guild_id=$1 AND user_id=$2 AND lease_id=$3",[guild,uid,id]);}
export async function upgradeRolePanel(api:DiscordApi=discordApi){
 const inventory=await roleInventory(api),{c,roles,channels,top,admin,perms}=inventory,lock=randomBytes(16).toString('hex');
 if(!await lease(c.guild_id,'setup',lock))throw Error('Mise à jour du panneau déjà en cours.');
 try{
  const [panel]=await query("SELECT * FROM discord_community_panels WHERE kind='roles'");
  const found=panel?.channel_id?channels.filter(ch=>ch.id===panel.channel_id):channels.filter(ch=>['notifications','roles','choisir-mes-roles'].includes(clean(ch.name))&&[0,5].includes(ch.type));
  if(found.length!==1)throw Error('Le salon de rôles existant est introuvable ou ambigu. Aucun salon créé.');
  const ch=found[0];if(!admin&&!(perms&16n))throw Error('Le bot doit disposer de Gérer les salons pour renommer ce salon.');
  // Respect Discord channel overwrites, without requesting any new permission.
  let effective=perms;if(!admin){const everyone=ch.permission_overwrites?.find((p:any)=>p.id===c.guild_id);if(everyone)effective=(effective&~BigInt(everyone.deny))|BigInt(everyone.allow);let allow=0n,deny=0n;for(const p of ch.permission_overwrites||[])if(p.type===0&&inventory.bot.roles.includes(p.id)){allow|=BigInt(p.allow);deny|=BigInt(p.deny)}effective=(effective&~deny)|allow;const individual=ch.permission_overwrites?.find((p:any)=>p.type===1&&p.id===c.bot_id);if(individual)effective=(effective&~BigInt(individual.deny))|BigInt(individual.allow);if((effective&84992n)!==84992n)throw Error('Le bot doit voir le salon, lire son historique et envoyer des messages et des liens intégrés.');}
  const d=JSON.parse(String(panel?.details||'{}'));d.regions||={};d.status||={};
  await query("INSERT INTO discord_community_panels(kind,channel_id) VALUES('roles',$1) ON CONFLICT DO NOTHING",[String(ch.id)]);
  const save=()=>query("UPDATE discord_community_panels SET details=$1 WHERE kind='roles'",[JSON.stringify(d)]);
  async function ensure(existing:string|undefined,label:string,zero:boolean,aliases:string[]=[]){let role:Role|undefined;if(existing)role=roles.find(r=>r.id===existing);else{const matches=roles.filter(r=>[clean(label),...aliases].includes(clean(r.name)));if(matches.length>1)throw Error(`Plusieurs rôles correspondent à ${label}.`);role=matches[0];if(!role){role=await api<Role>(`/guilds/${c.guild_id}/roles`,'POST',{name:label,permissions:'0',color:0x883af5,mentionable:false,hoist:false});roles.push(role);}}return manageable(role,top,zero).id;}
  for(const [key,label] of [['updates','Mises à jour Mentora'],['announcements','Annonces Mentora']]){d[key]=await ensure(d[key],label,true);await save();}
  for(const [key,label] of geographicRoles){d.regions[key]=await ensure(d.regions[key],label,true);await save();}
  d.status.beginner=await ensure(d.status.beginner,'Débutant',false,['debutants']);await save();d.status.mentor=await ensure(d.status.mentor,'Parrain',false,['parrains']);d.version=2;await save();assertDetails(d,roles,top);
  for(const channel of channels)for(const p of channel.permission_overwrites||[])if([d.status.beginner,d.status.mentor].includes(p.id)&&(BigInt(p.allow)&~basic)!==0n)throw Error('Un rôle de statut accorde une permission sensible dans un salon.');
  const payload=rolePanelPayload(SITE_ORIGIN);let messageId=String(panel?.message_id||'');
  if(!messageId){const messages=await api<any[]>(`/channels/${ch.id}/messages?limit=100`),matches=messages.filter(m=>m.author?.id===c.bot_id&&m.embeds?.some((e:any)=>e.footer?.text==='mentora-community:roles'||updateSiteLinks(String(e.footer?.icon_url||''))===`${SITE_ORIGIN}/icons/icon-192.png?panel=roles`));if(matches.length!==1)throw Error('Le panneau existant est introuvable ou ambigu. Aucun doublon envoyé.');messageId=String(matches[0].id);}
  const existing=await api<any>(`/channels/${ch.id}/messages/${messageId}`);if(existing.author?.id!==c.bot_id)throw Error('Le panneau existant n’appartient pas au bot Mentora.');
  await api(`/channels/${ch.id}`,'PATCH',{name:'choisir-mes-rôles'});await api(`/channels/${ch.id}/messages/${messageId}`,'PATCH',payload);
  await query("UPDATE discord_community_panels SET channel_id=$1,message_id=$2,state='published' WHERE kind='roles'",[String(ch.id),messageId]);
  return {ok:true,channelId:ch.id,messageId,regions:geographicRoles.length,botPermissionsVerified:true,synchronization:'discord-only'};
 }finally{await release(c.guild_id,'setup',lock);}
}
async function context(i:Interaction,api:DiscordApi,confirmation=false){
 const c=await config(),uid=i.member?.user?.id,[panel]=await query("SELECT * FROM discord_community_panels WHERE kind='roles'");
 if(!c||!uid||!panel||panel.state!=='published'||i.guild_id!==c.guild_id||i.application_id!==process.env.DISCORD_TICKET_APPLICATION_ID||i.channel_id!==panel.channel_id||(!confirmation&&i.message?.id!==panel.message_id))throw Error('Utilise le panneau Choisir mes rôles actuel.');
 const inventory=await roleInventory(api),d=JSON.parse(String(panel.details)) as Details;assertDetails(d,inventory.roles,inventory.top);
 return {...inventory,uid,d};
}
async function action(i:Interaction,kind:string,api:DiscordApi,work:(ctx:Awaited<ReturnType<typeof context>>,intent:any,setIntent:(v:unknown)=>Promise<void>)=>Promise<RoleReply>,confirmation=false){
 const ctx=await context(i,api,confirmation),{c,uid}=ctx;
 await query("INSERT INTO discord_role_actions(interaction_id,guild_id,user_id,kind,state,created_at) VALUES($1,$2,$3,$4,'pending',$5) ON CONFLICT DO NOTHING",[i.id,c.guild_id,uid,kind,new Date().toISOString()]);
 const [row]=await query('SELECT * FROM discord_role_actions WHERE interaction_id=$1',[i.id]);if(row.user_id!==uid||row.guild_id!==c.guild_id||row.kind!==kind)throw Error('Interaction invalide.');if(row.state==='applied')return JSON.parse(String(row.result));
 if(!await lease(c.guild_id,uid,i.id))return {content:'Une modification est déjà en cours. Réessaie dans un instant.',components:[]};
 try{const setIntent=async(v:unknown)=>{await query("UPDATE discord_role_actions SET intent=$1,state='applying' WHERE interaction_id=$2",[JSON.stringify(v),i.id]);};const result=await work(ctx,row.intent?JSON.parse(String(row.intent)):null,setIntent);await query("UPDATE discord_role_actions SET state='applied',result=$1,error='' WHERE interaction_id=$2",[JSON.stringify(result),i.id]);return result;}catch(e){await query("UPDATE discord_role_actions SET state='failed',error=$1 WHERE interaction_id=$2",[(e as Error).message.slice(0,400),i.id]);throw e;}finally{await release(c.guild_id,uid,i.id);}
}
async function memberRoles(c:{guild_id:string},uid:string,api:DiscordApi){return (await api<{roles:string[]}>(`/guilds/${c.guild_id}/members/${uid}`)).roles;}
async function setRole(guild:string,uid:string,id:string,add:boolean,api:DiscordApi){await api(`/guilds/${guild}/members/${uid}/roles/${id}`,add?'PUT':'DELETE');}
async function reconcileStatus(ctx:Awaited<ReturnType<typeof context>>,api:DiscordApi){const {c,uid,d}=ctx;let roles=await memberRoles(c,uid,api);const [pref]=await query('SELECT mentor_since FROM discord_member_preferences WHERE guild_id=$1 AND user_id=$2',[c.guild_id,uid]);if(pref?.mentor_since||roles.includes(d.status.mentor)){
 await query("UPDATE discord_member_preferences SET mentor_since=COALESCE(mentor_since,$3),updated_at=$3 WHERE guild_id=$1 AND user_id=$2",[c.guild_id,uid,new Date().toISOString()]);
 if(roles.includes(d.status.beginner))await setRole(c.guild_id,uid,d.status.beginner,false,api);if(!roles.includes(d.status.mentor))await setRole(c.guild_id,uid,d.status.mentor,true,api);roles=await memberRoles(c,uid,api);
 if(!roles.includes(d.status.mentor)||roles.includes(d.status.beginner))throw Error('Discord n’a pas confirmé ton statut Parrain. Réessaie pour terminer.');
 }return roles;}
export async function memberRoleInteraction(i:Interaction,api:DiscordApi=discordApi):Promise<RoleReply>{
 const key=i.data?.custom_id||'';
 if(key.startsWith('mentora:role:')){const [old]=await query("SELECT details FROM discord_community_panels WHERE kind='roles'");if(JSON.parse(String(old?.details||'{}')).version!==2)return {content:await(await import('./service')).toggleRole(i,api),components:[]};}
 const confirm=key.startsWith('mentora:member:confirm:'),cancel=key.startsWith('mentora:member:cancel:');
 try{return await action(i,key,api,async(ctx,intent,setIntent)=>{
  const {c,uid,d}=ctx;
  if(confirm||cancel){const token=key.split(':').at(-1),[confirmation]=await query('SELECT * FROM discord_role_confirmations WHERE token=$1 AND guild_id=$2 AND user_id=$3',[token||'',c.guild_id,uid]);if(!confirmation||String(confirmation.expires_at)<new Date().toISOString()||(confirmation.used_by&&confirmation.used_by!==i.id))throw Error('Cette confirmation est expirée ou ne t’appartient pas. Rouvre Mon statut.');if(cancel){await query('UPDATE discord_role_confirmations SET used_by=$1 WHERE token=$2',[i.id,token!]);return {content:'Demande annulée. Ton statut reste inchangé.',components:[]};}
   await query('UPDATE discord_role_confirmations SET used_by=$1 WHERE token=$2 AND (used_by IS NULL OR used_by=$1)',[i.id,token!]);
   const before=await memberRoles(c,uid,api),[pref]=await query('SELECT mentor_since FROM discord_member_preferences WHERE guild_id=$1 AND user_id=$2',[c.guild_id,uid]);if(!before.includes(d.status.beginner)&&!before.includes(d.status.mentor)&&!pref?.mentor_since)throw Error('Ton rôle Débutant n’est plus présent. Aucun changement effectué.');
   // Irreversible intent is durable before remote writes, so retries cannot downgrade the member.
   await query('UPDATE discord_member_preferences SET mentor_since=COALESCE(mentor_since,$3),updated_at=$3 WHERE guild_id=$1 AND user_id=$2',[c.guild_id,uid,new Date().toISOString()]);await reconcileStatus(ctx,api);return {content:'Tu es maintenant Parrain sur Discord 💜 Ce changement est définitif. Ton compte Mentora et ses accès restent inchangés.',components:[]};
  }
  const roles=await reconcileStatus(ctx,api);
  if(key==='mentora:member:status:v1'){
   if(roles.includes(d.status.mentor))return {content:'Tu es déjà Parrain sur Discord 💜 Le retour au statut Débutant n’est pas proposé.',components:[]};
   if(!roles.includes(d.status.beginner))return {content:'Aucun rôle Débutant ou Parrain n’est associé à ton compte Discord. Contacte l’équipe Mentora.',components:[]};
   const token=randomBytes(18).toString('hex');await query('INSERT INTO discord_role_confirmations(token,guild_id,user_id,expires_at) VALUES($1,$2,$3,$4)',[token,c.guild_id,uid,new Date(Date.now()+600000).toISOString()]);return {content:'Tu es Débutant sur Discord. Devenir Parrain est définitif : tu ne pourras plus revenir au statut Débutant. Cela ne modifie pas ton profil ni tes accès sur l’application Mentora.',components:[{type:1,components:[{type:2,style:1,label:'Devenir Parrain — confirmer',custom_id:`mentora:member:confirm:${token}`},{type:2,style:2,label:'Annuler',custom_id:`mentora:member:cancel:${token}`}]}]};
  }
  if(key==='mentora:member:region:v1'){
   const values=i.data?.values;if(!values||values.length!==1||(!geographicRoles.some(([id])=>id===values[0])&&values[0]!=='none'))throw Error('Choisis une seule région valide.');
   const selected=values[0],all=Object.values(d.regions),target=selected==='none'?null:d.regions[selected];await setIntent({region:selected});
   for(const id of roles.filter(id=>all.includes(id)&&id!==target))await setRole(c.guild_id,uid,id,false,api);if(target&&!roles.includes(target))await setRole(c.guild_id,uid,target,true,api);
   const current=(await memberRoles(c,uid,api)).filter(id=>all.includes(id));if(current.length!==(target?1:0)||(target&&current[0]!==target))throw Error('Discord n’a pas confirmé la région. Réessaie pour terminer.');
   await query('UPDATE discord_member_preferences SET region_key=$3,updated_at=$4 WHERE guild_id=$1 AND user_id=$2',[c.guild_id,uid,target?selected:null,new Date().toISOString()]);return {content:target?`Ta région : ${geographicRoles.find(([id])=>id===selected)![1]}.`:'Ton rôle géographique a été retiré.',components:[]};
  }
  if(['mentora:role:updates','mentora:role:announcements'].includes(key)){
   const id=key.endsWith(':updates')?d.updates:d.announcements,add=intent?!!intent.add:!roles.includes(id);if(!intent)await setIntent({add});await setRole(c.guild_id,uid,id,add,api);if((await memberRoles(c,uid,api)).includes(id)!==add)throw Error('Discord n’a pas confirmé la notification. Réessaie.');return {content:add?'Notification activée.':'Notification retirée.',components:[]};
  }
  throw Error('Action inconnue.');
 },confirm||cancel);}catch(e){return {content:(e as Error).message||'Action indisponible. Réessaie.',components:[]};}
}

export async function auditRoleConfiguration(api:DiscordApi=discordApi){const {c,roles,top}=await roleInventory(api);const [panel]=await query("SELECT channel_id,message_id,details FROM discord_community_panels WHERE kind='roles'");return {channelId:panel?.channel_id,messageId:panel?.message_id,botHighestPosition:top,roles:roles.filter(r=>r.id!==c.guild_id).map(r=>({id:r.id,name:r.name,permissions:r.permissions,managed:!!r.managed,position:r.position})),linkedMentoraAccounts:false};}

// Real integration check on the bot itself only; never promote a human member for a test.
export async function testGeographyOnBot(api:DiscordApi=discordApi){
 const c=await config(),[panel]=await query("SELECT channel_id,message_id,details FROM discord_community_panels WHERE kind='roles'");if(!c||!panel)throw Error('Publie le panneau avant le test.');const d=JSON.parse(String(panel.details)) as Details;
 const before=await memberRoles(c,c.bot_id,api);if(before.some(id=>Object.values(d.regions||{}).includes(id)||[d.status.beginner,d.status.mentor].includes(id)))throw Error('Le bot a déjà une région ou un statut membre. Aucun test effectué pour préserver sa configuration.');
 const run=async(key:string)=>{const response=await memberRoleInteraction({id:`selftest-${randomBytes(16).toString('hex')}`,application_id:process.env.DISCORD_TICKET_APPLICATION_ID||'',type:3,guild_id:c.guild_id,channel_id:String(panel.channel_id),token:'not-used',member:{user:{id:c.bot_id}},message:{id:String(panel.message_id)},data:{custom_id:'mentora:member:region:v1',values:[key]}},api);return response.content;};
 const results:string[]=[];try{for(const key of ['bretagne','ile-de-france']){results.push(await run(key));const assigned=(await memberRoles(c,c.bot_id,api)).filter(id=>Object.values(d.regions).includes(id));if(assigned.length!==1||assigned[0]!==d.regions[key])throw Error('Le changement de région du bot n’a pas été confirmé.');}}
 finally{results.push(await run('none'));if((await memberRoles(c,c.bot_id,api)).some(id=>Object.values(d.regions).includes(id)))throw Error('Le rôle régional du bot doit être retiré manuellement.');}
 return {ok:true,tested:true,results,restored:true};
}
