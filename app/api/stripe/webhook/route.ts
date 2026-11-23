import {ambassadorPayoutEvent} from "@/lib/ambassadors/withdrawals";
import {stripeBilling} from "@/lib/monetization/stripe";
import {withMoneyMode,type MoneyMode} from "@/lib/monetization/mode";
import {handleEvent} from "@/lib/monetization/payments";
import {handleConnectEvent} from "@/lib/monetization/connect";
export const runtime="nodejs";
export async function POST(request:Request){
 const raw=await request.text();if(raw.length>1000000)return new Response("Payload trop volumineux",{status:413});
 const candidates:{mode:MoneyMode;secret:string}[]=[];
 for(const [mode,secret] of [["test",process.env.STRIPE_WEBHOOK_SECRET],["test",process.env.STRIPE_CONNECT_WEBHOOK_SECRET],["live",process.env.STRIPE_LIVE_WEBHOOK_SECRET]] as const)if(secret)candidates.push({mode,secret});
 if(!candidates.length)return new Response("Webhook non configuré",{status:503});
 for(const candidate of candidates){
 let event;try{event=withMoneyMode(candidate.mode,()=>stripeBilling().webhooks.constructEvent(raw,request.headers.get("stripe-signature")||"",candidate.secret));}catch{continue;}
 if(!!event.livemode!==(candidate.mode==="live"))return new Response("Mode Stripe invalide",{status:400});
 if(candidate.mode==="live"&&event.account)return new Response("Connect désactivé",{status:400});
 try{await withMoneyMode(candidate.mode,async()=>{if(event.account){await ambassadorPayoutEvent(event);await handleConnectEvent(event);}else await handleEvent(event);});return Response.json({received:true});}catch{return new Response("Traitement différé, réessayer",{status:500});}
 }
 return new Response("Signature invalide",{status:400});
}
