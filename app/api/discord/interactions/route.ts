import {after} from "next/server";
import {verifyInteraction} from "@/lib/discord-tickets/security";
import {interpret,type Interaction} from "@/lib/discord-tickets/service";
import {finishInteraction} from "@/lib/discord-tickets/client";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(r:Request){
 if(Number(r.headers.get('content-length')||0)>30000)return new Response('Payload too large',{status:413});
 const body=await r.text();if(Buffer.byteLength(body)>30000)return new Response('Payload too large',{status:413});
 const key=process.env.DISCORD_TICKET_PUBLIC_KEY||'';
 if(!verifyInteraction(body,r.headers.get('x-signature-ed25519'),r.headers.get('x-signature-timestamp'),key))return new Response('Invalid signature',{status:401});
 let i:Interaction;try{i=JSON.parse(body);}catch{return new Response('Invalid body',{status:400});}
 if(i.application_id!==process.env.DISCORD_TICKET_APPLICATION_ID)return new Response('Invalid application',{status:403});
 try{
  const result=await interpret(i);
  if(result.work)after(async()=>{let text;try{text=await result.work!();}catch{text='Le ticket n’a pas pu être confirmé. Contacte Thibault.';}try{await finishInteraction(i.application_id,i.token,text);}catch{console.error('DISCORD_TICKET_RESPONSE_PENDING');}});
  return Response.json(result.response,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({type:4,data:{content:'Le support est momentanément indisponible. Réessaie plus tard.',flags:64}});}
}
