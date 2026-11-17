import type Stripe from "stripe";
import {stripeBilling,appOrigin} from "./stripe";
import {billingLive,liveReadiness,liveSecretKey} from "./mode";
export const liveCreditEvents=["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","charge.refunded"] as const;
function mentoraEndpoints(endpoints:Stripe.WebhookEndpoint[]){
 const urls=new Set([`${appOrigin()}/api/stripe/webhook`,"https://mentora-resell.vercel.app/api/stripe/webhook","https://relais-parrainage.vercel.app/api/stripe/webhook"]);
 return endpoints.filter(e=>e.livemode&&urls.has(e.url.replace(/\/$/,"")));
}
export async function completeLiveWebhook(provider:()=>Stripe=stripeBilling){
 if(!billingLive())throw Error("Cette action concerne uniquement Stripe réel.");
 const stripe=provider(),listed=await stripe.webhookEndpoints.list({limit:100}),targets=mentoraEndpoints(listed.data);
 if(!targets.length)throw Error("Aucun webhook réel Mentora trouvé dans ce compte Stripe.");
 for(const e of targets){const events=e.enabled_events.includes("*")?e.enabled_events:[...new Set([...e.enabled_events,...liveCreditEvents])];await stripe.webhookEndpoints.update(e.id,{disabled:false,enabled_events:events as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]});}
 return {ok:true,message:"Webhook réel complété. Aucun paiement effectué."};
}
export async function liveProviderStatus(provider:()=>Stripe=stripeBilling){
 if(!billingLive())return null;
 const readiness=liveReadiness();if(!readiness.ready)return {ready:false,chargesEnabled:false,webhookReady:false,message:readiness.missing.includes("Clé Stripe réelle")?(/^(sk|rk)_test_/.test(liveSecretKey())?"STRIPE_LIVE_SECRET_KEY contient une clé de test. Enregistre une clé sk_live_ ou rk_live_ dans Vercel.":/^pk_/.test(liveSecretKey())?"STRIPE_LIVE_SECRET_KEY contient une clé publique. Enregistre une clé secrète sk_live_ ou rk_live_.":"STRIPE_LIVE_SECRET_KEY doit contenir une clé secrète réelle sk_live_ ou rk_live_ valide."):readiness.missing.join(", ")};
 try{
 const stripe=provider();
 const [account,endpoints]=await Promise.all([stripe.accounts.retrieve(null),stripe.webhookEndpoints.list({limit:100})]);
 const targets=mentoraEndpoints(endpoints.data);
 const webhookReady=targets.some(e=>e.status==="enabled"&&liveCreditEvents.every(type=>e.enabled_events.includes("*")||e.enabled_events.some(v=>v===type)));
 return {ready:account.charges_enabled&&webhookReady,chargesEnabled:account.charges_enabled,webhookReady,canRepairWebhook:targets.length>0&&!webhookReady,message:!account.charges_enabled?"Stripe doit autoriser les encaissements sur le compte réel.":!webhookReady?(targets.length?"Le webhook réel Mentora doit être complété pour les paiements et remboursements.":"Aucun webhook réel Mentora n’est présent dans ce compte Stripe. Ajoute https://mentora-resell.vercel.app/api/stripe/webhook dans Stripe en mode réel."):"Encaissements réels disponibles pour le compte administrateur principal."};
 }catch{return {ready:false,chargesEnabled:false,webhookReady:false,message:"Vérification Stripe réelle impossible : contrôle la clé et ses autorisations dans Stripe."};}
}
