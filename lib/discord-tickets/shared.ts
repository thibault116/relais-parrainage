import {SITE_ORIGIN} from "../site";
export const ticketCategories=[
 {id:"technical",label:"Problème technique",description:"Application, affichage, messages ou notifications",emoji:"🛠️"},
 {id:"payments",label:"Crédits et paiements",description:"Achat, débit, facture ou remboursement",emoji:"💳"},
 {id:"services",label:"Prestations et rémunération",description:"Demande, prestation ou retrait",emoji:"🤝"},
 {id:"account",label:"Compte et profil",description:"Connexion, accès ou informations du profil",emoji:"👤"},
 {id:"report",label:"Signaler un problème",description:"Comportement, contenu ou litige",emoji:"🚩"},
 {id:"recruitment",label:"Recrutement",description:"Candidature pour rejoindre l’équipe Mentora",emoji:"📋"},
 {id:"other",label:"Autre demande",description:"Toute autre question sur Mentora",emoji:"💬"},
];
export const panelMarker="mentora-ticket-panel-v1";
export function ticketPanel(){return {
 allowed_mentions:{parse:[]},
 embeds:[{title:"🎟️ Centre d’aide Mentora",description:"**Support & assistance**\n\nBesoin d’aide ? Choisis une catégorie ci-dessous pour ouvrir un ticket privé.\nDécris ta demande : Thibault te répondra dès que possible.\n\n"+ticketCategories.map(c=>`${c.emoji} **${c.label}**\n${c.description}`).join("\n\n"),color:0x883af5,thumbnail:{url:`${SITE_ORIGIN}/icons/icon-512.png`},footer:{text:panelMarker}}],
 components:[{type:1,components:[{type:3,custom_id:"mentora:ticket:category:v1",placeholder:"Quel est le sujet de ta demande ?",min_values:1,max_values:1,options:ticketCategories.map(c=>({label:c.label,value:c.id,description:c.description,emoji:{name:c.emoji}}))}]}]
};}
export function ticketModal(category:string){return {type:9,data:{custom_id:`mentora:ticket:open:${category}`,title:ticketCategories.find(c=>c.id===category)!.label,components:[{type:1,components:[{type:4,custom_id:"details",label:"Explique ta demande",style:2,min_length:10,max_length:1800,required:true,placeholder:"Ce qui se passe, ce que tu attendais, les étapes pour reproduire…"}]}]}};}
export const message=(content:string)=>({type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
