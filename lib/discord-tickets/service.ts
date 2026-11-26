import {memberRoleInteraction} from "../discord-community/member-roles";
import {z} from "zod";
import {query} from "../db";
import {discordApi,DiscordFailure,type DiscordApi} from "./client";
import {config,ticket,claimTicket,recordAction,type TicketConfig,type Ticket} from "./store";
import {ticketPanel,panelMarker,ticketCategories,ticketModal,message} from "./shared";
import {ticketPermissions} from "./security";
const snowflake=z.string().regex(/^\d{15,22}$/);
export const setupSchema=z.object({guild:snowflake,channel:snowflake,category:z.union([snowflake,z.literal("")]).default("")}).strict();
export async function configureTickets(input:unknown,api:DiscordApi=discordApi){
 const d=setupSchema.parse(input),app=process.env.DISCORD_TICKET_APPLICATION_ID;
 if(!app||!process.env.DISCORD_TICKET_PUBLIC_KEY?.match(/^[a-f0-9]{64}$/i))throw Error("Identifiant d’application et clé publique à configurer.");
 const [guild,channel,me,application]=await Promise.all([api(`/guilds/${d.guild}`),api(`/channels/${d.channel}`),api('/users/@me'),api('/oauth2/applications/@me')]);
 if(application.id!==app||!me.bot||channel.guild_id!==d.guild||![0,5].includes(Number(channel.type)))throw Error("Vérifie le serveur, le salon et le bot Mentora.");
 if(d.category){const parent=await api(`/channels/${d.category}`);if(parent.guild_id!==d.guild||parent.type!==4)throw Error("Catégorie Discord invalide.");}
 const existing=await config();
 if(existing?.panel_message&&(existing.guild_id!==d.guild||existing.panel_channel!==d.channel))throw Error("Un panneau existe déjà dans un autre salon. Conserve sa configuration.");
 if(existing?.panel_state==='publishing'||existing?.panel_state==='uncertain')throw Error("Publication à vérifier avant de modifier la configuration.");
 await query("INSERT INTO discord_ticket_config(id,guild_id,panel_channel,category_id,owner_id,bot_id,updated_at) VALUES('main',$1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET guild_id=excluded.guild_id,panel_channel=excluded.panel_channel,category_id=excluded.category_id,owner_id=excluded.owner_id,bot_id=excluded.bot_id,updated_at=excluded.updated_at",[d.guild,d.channel,d.category,String(guild.owner_id),String(me.id),new Date().toISOString()]);
 return config();
}
export async function publishPanel(api:DiscordApi=discordApi){
 const c=await config();if(!c)throw Error("Configure le salon avant publication.");
 const guild=await api(`/guilds/${c.guild_id}`);if(guild.owner_id!==c.owner_id)throw Error("Le propriétaire du serveur a changé. Actualise la configuration.");
 if(c.panel_message){await api(`/channels/${c.panel_channel}/messages/${c.panel_message}`,"PATCH",ticketPanel());return {id:c.panel_message};}
 if(c.panel_state!=="draft")throw Error("Publication à vérifier : ne pas renvoyer le panneau.");
 if(!(await query("UPDATE discord_ticket_config SET panel_state='publishing' WHERE id='main' AND panel_state='draft' RETURNING id")).length)throw Error("Publication déjà en cours.");
 try{const m=await api(`/channels/${c.panel_channel}/messages`,"POST",{...ticketPanel(),nonce:panelMarker,enforce_nonce:true});await query("UPDATE discord_ticket_config SET panel_message=$1,panel_state='published' WHERE id='main'",[String(m.id)]);return {id:String(m.id)};}
 catch(e){await query("UPDATE discord_ticket_config SET panel_state=$1 WHERE id='main'",[e instanceof DiscordFailure&&e.status>=400&&e.status<500?"draft":"uncertain"]);throw e;}
}
export async function recoverPanel(api:DiscordApi=discordApi){const c=await config();if(!c)throw Error("Configuration absente.");const messages=await api<Record<string,unknown>[]>(`/channels/${c.panel_channel}/messages`);const matches=messages.filter((m:any)=>m.author?.id===c.bot_id&&m.embeds?.some((e:any)=>e.footer?.text===panelMarker));if(matches.length!==1)throw Error("Panneau introuvable ou plusieurs panneaux : vérification manuelle nécessaire.");await query("UPDATE discord_ticket_config SET panel_message=$1,panel_state='published' WHERE id='main'",[String(matches[0].id)]);return {id:String(matches[0].id)};}
export type Interaction={id:string;application_id:string;type:number;guild_id?:string;channel_id?:string;token:string;member?:{user?:{id:string}};message?:{id:string};data?:{custom_id?:string;values?:string[];components?:{components?:{custom_id:string;value:string}[]}[]}};
export async function interpret(i:Interaction){
 if(i.type===1)return {response:{type:1}};
 const c=await config(),uid=i.member?.user?.id;
 if(!c||!uid||i.guild_id!==c.guild_id||i.application_id!==process.env.DISCORD_TICKET_APPLICATION_ID)return {response:message("Cette demande n’est pas disponible ici.")};
 const custom=i.data?.custom_id||"";
 if(i.type===3&&(custom.startsWith("mentora:role:")||custom.startsWith("mentora:member:")))return {response:{type:5,data:{flags:64}},work:async()=>{const reply=await memberRoleInteraction(i);try{await (await import('../discord-account/service')).syncLinkedMember(i.member?.user?.id||'');}catch{}return reply;}};
 if(i.type===3&&custom==="mentora:ticket:category:v1"){
  if(i.channel_id!==c.panel_channel||i.message?.id!==c.panel_message)return {response:message("Utilise le panneau d’aide Mentora actuel.")};
  const category=i.data?.values?.[0];if(!ticketCategories.some(k=>k.id===category))return {response:message("Choisis une catégorie valide.")};
  return {response:ticketModal(category!)};
 }
 if(i.type===5&&custom.startsWith("mentora:ticket:open:")){
  const category=custom.slice("mentora:ticket:open:".length),details=i.data?.components?.flatMap(r=>r.components||[]).find(t=>t.custom_id==='details')?.value.trim()||"";
  if(i.channel_id!==c.panel_channel||!ticketCategories.some(k=>k.id===category)||details.length<10||details.length>1800)return {response:message("Décris ta demande en 10 à 1 800 caractères depuis le panneau Mentora.")};
  return {response:{type:5,data:{flags:64}},work:()=>openTicket(i,c,uid,category,details)};
 }
 if(i.type===3&&custom.startsWith("mentora:ticket:close:")){
  const t=await ticket(custom.slice("mentora:ticket:close:".length));
  if(!t||i.channel_id!==t.channel_id||![t.user_id,c.owner_id].includes(uid))return {response:message("Tu ne peux pas fermer ce ticket.")};
  return {response:{type:5,data:{flags:64}},work:()=>closeTicket(i,c,t,uid)};
 }
 return {response:message("Action inconnue.")};
}
export async function openTicket(i:Interaction,c:TicketConfig,uid:string,category:string,details:string,api:DiscordApi=discordApi){
 const claim=await claimTicket(i.id,c.guild_id,uid,category),t=claim.row;
 if(!t)throw Error("Ticket indisponible.");
 if(!claim.created)return t.channel_id?`Ton ticket est déjà ouvert : <#${t.channel_id}>.`:"Ton ticket est en préparation ou doit être vérifié. Contacte Thibault avant de recommencer.";
 try{
  const channel=await api(`/guilds/${c.guild_id}/channels`,"POST",{name:`ticket-${category}-${i.id.slice(-6)}`,type:0,...(c.category_id?{parent_id:c.category_id}:{}),topic:`mentora-ticket:${t.id}`,permission_overwrites:ticketPermissions(c.guild_id,c.owner_id,c.bot_id,uid),rate_limit_per_user:2});
  await query("UPDATE discord_tickets SET channel_id=$1,state='open',updated_at=$2 WHERE id=$3",[String(channel.id),new Date().toISOString(),t.id]);
  await api(`/channels/${channel.id}/messages`,"POST",{nonce:`intro-${t.id}`,enforce_nonce:true,allowed_mentions:{parse:[],users:Array.from(new Set([uid,c.owner_id]))},content:`<@${uid}> · <@${c.owner_id}>`,embeds:[{title:`${ticketCategories.find(k=>k.id===category)!.emoji} ${ticketCategories.find(k=>k.id===category)!.label}`,description:details,color:0x883af5,footer:{text:"Ticket privé Mentora · Tu peux joindre tes captures dans ce salon."}}],components:[{type:1,components:[{type:2,style:2,label:"Fermer le ticket",custom_id:`mentora:ticket:close:${t.id}`}]}]});
  await recordAction(i.id,t.id,uid,"opened");return `Ton ticket privé est ouvert : <#${channel.id}>.`;
 }catch{await query("UPDATE discord_tickets SET state='uncertain',updated_at=$1 WHERE id=$2",[new Date().toISOString(),t.id]);return "La création n’a pas pu être confirmée. Thibault peut vérifier le ticket depuis son administration. Aucun second ticket ne sera créé automatiquement.";}
}
export async function closeTicket(i:Interaction,c:TicketConfig,t:Ticket,uid:string,api:DiscordApi=discordApi){
 if(![c.owner_id,t.user_id].includes(uid))throw Error("Accès refusé.");
 if(t.state==='closed')return "Ce ticket est déjà fermé.";
 const claimed=await query("UPDATE discord_tickets SET state='closing' WHERE id=$1 AND state='open' RETURNING id",[t.id]);if(!claimed.length)return "La fermeture est en cours ou doit être vérifiée.";
 try{await api(`/channels/${t.channel_id}`,"PATCH",{permission_overwrites:ticketPermissions(c.guild_id,c.owner_id,c.bot_id,t.user_id,true),name:`ferme-${t.id.slice(-6)}`});await query("UPDATE discord_tickets SET state='closed',active_key=NULL,updated_at=$1 WHERE id=$2",[new Date().toISOString(),t.id]);await recordAction(i.id,t.id,uid,"closed");return "Ticket fermé. L’historique reste lisible dans le salon.";}
 catch{return "La fermeture doit être vérifiée par Thibault. Le salon n’a pas été supprimé.";}
}
export async function recoverTicket(id:string,api:DiscordApi=discordApi){const c=await config(),t=await ticket(id);if(!c||!t||t.guild_id!==c.guild_id)throw Error("Ticket introuvable.");const channels=await api<Record<string,unknown>[]>(`/guilds/${c.guild_id}/channels`);const found=channels.filter(ch=>ch.topic===`mentora-ticket:${id}`);if(found.length!==1)throw Error("Aucun salon unique retrouvé. Vérifie Discord manuellement.");await api(`/channels/${found[0].id}`,"PATCH",{permission_overwrites:ticketPermissions(c.guild_id,c.owner_id,c.bot_id,t.user_id,t.state==='closing')});if(t.state!=='closing'){
 const messages=await api<any[]>(`/channels/${found[0].id}/messages`);
 if(!messages.some(m=>m.author?.id===c.bot_id&&m.components?.some((r:any)=>r.components?.some((b:any)=>b.custom_id===`mentora:ticket:close:${id}`))))await api(`/channels/${found[0].id}/messages`,"POST",{nonce:`intro-${id}`,enforce_nonce:true,content:"Ticket Mentora retrouvé. Tu peux préciser ta demande ici et joindre tes captures.",allowed_mentions:{parse:[]},components:[{type:1,components:[{type:2,style:2,label:"Fermer le ticket",custom_id:`mentora:ticket:close:${id}`}]}]});
 }
 await query("UPDATE discord_tickets SET channel_id=$1,state=$2,active_key=$3,updated_at=$4 WHERE id=$5",[String(found[0].id),t.state==='closing'?'closed':'open',t.state==='closing'?null:`${c.guild_id}:${t.user_id}`,new Date().toISOString(),id]);return {ok:true};}
export async function discoverTickets(api:DiscordApi=discordApi){
 const guilds=await api<{id:string;name:string}[]>('/users/@me/guilds');
 const matches=guilds.filter(g=>g.name.toLocaleLowerCase().trim()==='mentora');
 if(matches.length!==1)throw Error('Le bot doit être installé sur ton serveur Mentora. Si plusieurs serveurs portent ce nom, renseigne les identifiants manuellement.');
 const channels=await api<{id:string;name:string;type:number}[]>(`/guilds/${matches[0].id}/channels`);
 const panels=channels.filter(c=>[0,5].includes(c.type)&&c.name.toLocaleLowerCase().includes('ticket')&&c.name.toLocaleLowerCase().includes('ouvrir'));
 if(panels.length!==1)throw Error('Impossible d’identifier un unique salon ouvrir un ticket. Renseigne son identifiant manuellement.');
 return {guild:matches[0].id,channel:panels[0].id,category:''};
}
