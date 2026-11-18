import {query} from '../db';
import {memberGuides,guideLink} from '../guides-catalog';
import {communityInventory,normalized} from './service';
import {discordApi,type DiscordApi} from '../discord-tickets/client';
const root='https://mentora-resell.vercel.app';
const summaries:Record<string,string>={
 'se-lancer-achat-revente':'Comment démarrer avec ou sans budget, préparer ses premières ventes et poser les bases de son activité.',
 'materiel-indispensable':'Les indispensables pour préparer les vêtements, ranger son stock et expédier ses ventes, avec des liens vers le matériel.',
 'photos-et-annonces':'Des exemples de bonnes et mauvaises photos, les détails à photographier et des conseils pour rédiger ses titres et descriptions.',
 'comment-se-sourcer':'Brocantes, friperies, Vinted et fournisseurs : les pistes pour trouver son stock, avec leurs avantages et leurs limites.',
};
export function guidePanel(slug:string){
 const g=memberGuides.find(g=>g.slug===slug);if(!g)throw Error('Guide introuvable.');
 return {allowed_mentions:{parse:[]},embeds:[{title:`📚 ${g.title}`,description:`**Un guide gratuit sur Mentora**\n\n${summaries[g.slug]}\n\n👉 [Lire le guide sur Mentora](${guideLink(root,g.slug)})\n\nRetrouve-le aussi dans **Menu → Général → Guides**. Connexion à ton compte Mentora requise.`,url:guideLink(root,g.slug),color:0x883af5,thumbnail:{url:`${root}/icons/icon-192.png`},footer:{text:`Mentora · Guide gratuit ${g.number}`}}],components:[{type:1,components:[{type:2,style:5,label:'Lire le guide gratuit',url:guideLink(root,g.slug)}]}]};
}
export async function publishGuideChannels(api:DiscordApi=discordApi){
 const {c,channels}=await communityInventory(api);
 const categories=channels.filter(ch=>ch.type===4&&['guide','guides','guide gratuit','guides gratuits'].includes(normalized(ch.name)));
 if(categories.length!==1)throw Error('Crée une seule catégorie « guide » dans ton serveur Discord, puis réessaie.');
 const parent=categories[0],published=[];
 for(const g of memberGuides){
  const kind=`member-guide:${g.slug}`,marker=`mentora-guide:${g.slug}`;
  const matching=channels.filter(ch=>ch.topic===marker||(ch.parent_id===parent.id&&normalized(ch.name)===g.slug));
  if(matching.length>1)throw Error(`Plusieurs salons correspondent au guide ${g.number}. Aucun doublon ne sera créé.`);
  let row=(await query('SELECT * FROM discord_community_panels WHERE kind=$1',[kind]))[0];
  let channel=matching[0];
  if(row?.channel_id){channel=await api(`/channels/${row.channel_id}`);if(channel.guild_id!==c.guild_id||channel.parent_id!==parent.id||channel.type!==0)throw Error('Le salon enregistré ne correspond plus à la catégorie guide.');}
  if(!channel){
   const claimed=await query("INSERT INTO discord_community_panels(kind,channel_id,state) VALUES($1,'','creating') ON CONFLICT DO NOTHING RETURNING kind",[kind]);
   if(!claimed.length)throw Error('Une création de salon est déjà en cours ou doit être vérifiée.');
   try{channel=await api(`/guilds/${c.guild_id}/channels`,'POST',{name:g.slug,type:0,parent_id:parent.id,topic:marker,permission_overwrites:[{id:c.guild_id,type:0,allow:'1024',deny:'2048'},{id:c.owner_id,type:1,allow:'117760',deny:'0'},{id:c.bot_id,type:1,allow:'117760',deny:'0'}]});}
   catch(e){await query("UPDATE discord_community_panels SET state='uncertain' WHERE kind=$1",[kind]);throw e;}
   channels.push(channel);
  }
  await query("INSERT INTO discord_community_panels(kind,channel_id) VALUES($1,$2) ON CONFLICT(kind) DO UPDATE SET channel_id=excluded.channel_id",[kind,channel.id]);
  row=(await query('SELECT * FROM discord_community_panels WHERE kind=$1',[kind]))[0];
  const payload=guidePanel(g.slug);
  if(row.message_id){await api(`/channels/${channel.id}/messages/${row.message_id}`,'PATCH',payload);}
  else{
   const messages=await api<any[]>(`/channels/${channel.id}/messages?limit=100`);
   const existing=messages.filter(m=>m.author?.id===c.bot_id&&m.embeds?.some((e:any)=>e.footer?.text===payload.embeds[0].footer.text));
   if(existing.length>1)throw Error('Plusieurs messages Mentora correspondent à ce guide.');
   if(existing.length===1){await query("UPDATE discord_community_panels SET message_id=$1,state='published' WHERE kind=$2",[existing[0].id,kind]);await api(`/channels/${channel.id}/messages/${existing[0].id}`,'PATCH',payload);}
   else{
    if(!(await query("UPDATE discord_community_panels SET state='publishing' WHERE kind=$1 AND state IN ('draft','creating') RETURNING kind",[kind])).length)throw Error('Envoi déjà engagé : vérifie le salon avant de réessayer.');
    try{const message=await api(`/channels/${channel.id}/messages`,'POST',{...payload,nonce:`mentora-guide-${g.number}`,enforce_nonce:true});await query("UPDATE discord_community_panels SET message_id=$1,state='published' WHERE kind=$2",[String(message.id),kind]);}
    catch(e){await query("UPDATE discord_community_panels SET state='uncertain' WHERE kind=$1",[kind]);throw e;}
   }
  }
  const saved=(await query('SELECT message_id FROM discord_community_panels WHERE kind=$1',[kind]))[0];
  const verified=await api(`/channels/${channel.id}/messages/${saved.message_id}`);
  if((verified.author as any)?.id!==c.bot_id||(verified.embeds as any[])?.[0]?.description!==payload.embeds[0].description)throw Error('Le message publié ne correspond pas au guide.');
  published.push({slug:g.slug,channelId:channel.id,messageId:saved.message_id});
 }
 return {ok:true,guides:published};
}
