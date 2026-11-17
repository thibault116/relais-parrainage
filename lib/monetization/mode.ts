import {AsyncLocalStorage} from "node:async_hooks";
export type MoneyMode="test"|"live";
const context=new AsyncLocalStorage<MoneyMode>();
export const moneyMode=():MoneyMode=>context.getStore()??(process.env.MENTORA_BILLING_MODE==="live"?"live":"test");
export const withMoneyMode=<T>(mode:MoneyMode,fn:()=>T):T=>context.run(mode,fn);
export const billingLive=()=>moneyMode()==="live";
export function salesVersion(){
 if(!billingLive())return "test-2026-11-10.1";
 const version=process.env.MENTORA_LIVE_TERMS_VERSION?.trim();
 if(!version||version.startsWith("test"))throw Error("Conditions de vente réelles non configurées.");return version;
}
export function liveSecretKey(){
 const value=(process.env.STRIPE_LIVE_SECRET_KEY||"").trim();
 return ((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))?value.slice(1,-1).trim():value;
}
export function privateAdminLiveAuthorized(){return process.env.MENTORA_PRIVATE_ADMIN_LIVE_ENABLED==="true"&&!!process.env.MENTORA_PRIVATE_ADMIN_LIVE_AUTHORIZATION_REFERENCE?.trim();}
export function liveReadiness(){
 const missing:string[]=[];
 if(!/^(sk|rk)_live_/.test(liveSecretKey()))missing.push("Clé Stripe réelle");
 if(!process.env.STRIPE_LIVE_WEBHOOK_SECRET?.startsWith("whsec_"))missing.push("Webhook Stripe réel");
 if(!privateAdminLiveAuthorized()&&(process.env.MENTORA_COMMERCIAL_VALIDATED!=="true"||!process.env.MENTORA_COMMERCIAL_VALIDATION_REFERENCE?.trim()))missing.push("Autorisation privée du propriétaire ou validation commerciale et juridique");
 if(!process.env.MENTORA_LIVE_TERMS_VERSION?.trim()||process.env.MENTORA_LIVE_TERMS_VERSION?.startsWith("test"))missing.push("Version des CGV réelles");
 const cents=Number(process.env.MENTORA_LIVE_PAYOUT_CENTS);if(!Number.isFinite(cents)||!Number.isInteger(cents*100)||cents<=0||cents>1000)missing.push("Taux de rémunération réel");
 return {ready:missing.length===0,missing};
}
