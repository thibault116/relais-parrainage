import type Stripe from "stripe";
import {stripeBilling,appOrigin} from "./stripe";
import {billingLive,liveReadiness,liveSecretKey} from "./mode";
export async function liveProviderStatus(provider:()=>Stripe=stripeBilling){
 if(!billingLive())return null;
 const readiness=liveReadiness();if(!readiness.ready)return {ready:false,chargesEnabled:false,webhookReady:false,message:readiness.missing.includes("Clé Stripe réelle")?(/^(sk|rk)_test_/.test(liveSecretKey())?"STRIPE_LIVE_SECRET_KEY contient une clé de test. Enregistre une clé sk_live_ ou rk_live_ dans Vercel.":/^pk_/.test(liveSecretKey())?"STRIPE_LIVE_SECRET_KEY contient une clé publique. Enregistre une clé secrète sk_live_ ou rk_live_.":"STRIPE_LIVE_SECRET_KEY doit contenir une clé secrète réelle sk_live_ ou rk_live_ valide."):readiness.missing.join(", ")};
 try{
 const stripe=provider();
 const [account,endpoints]=await Promise.all([stripe.accounts.retrieve(null),stripe.webhookEndpoints.list({limit:100})]);
 const needed=["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","charge.refunded"];
 const webhookReady=endpoints.data.some(e=>e.livemode&&e.status==="enabled"&&e.url===`${appOrigin()}/api/stripe/webhook`&&needed.every(type=>e.enabled_events.includes("*")||e.enabled_events.some(v=>v===type)));
 return {ready:account.charges_enabled&&webhookReady,chargesEnabled:account.charges_enabled,webhookReady,message:!account.charges_enabled?"Stripe doit autoriser les encaissements sur le compte réel.":!webhookReady?"Le webhook réel doit être actif avec les événements de paiement et remboursement.":"Encaissements réels disponibles pour le compte administrateur principal."};
 }catch{return {ready:false,chargesEnabled:false,webhookReady:false,message:"Vérification Stripe réelle impossible : contrôle la clé et ses autorisations dans Stripe."};}
}
