import {SITE_ORIGIN, LEGACY_SITE_ORIGINS} from "../site";
import {billingLive,liveReadiness,liveSecretKey} from "./mode";
import Stripe from "stripe";
export function stripeTest() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!/^(sk|rk)_test_/.test(key))
    throw Error("Stripe test non configuré. Les clés live sont refusées.");
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
}
export function stripeBilling(){
 if(!billingLive())return stripeTest();
 const config=liveReadiness();if(!config.ready)throw Error("Paiements réels non configurés : "+config.missing.join(", "));
 return new Stripe(liveSecretKey(),{maxNetworkRetries:2,timeout:20000});
}
export const stripeModeMatches=(live:boolean|undefined)=>!!live===billingLive();
export function appOrigin() {
  const url = new URL(
    process.env.MENTORA_BILLING_ORIGIN ||
      process.env.BETTER_AUTH_URL ||
      SITE_ORIGIN,
  );
  if (
    url.protocol !== "https:" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost"
  )
    throw Error("Origine invalide");
  return LEGACY_SITE_ORIGINS.some(origin => origin === url.origin) ? SITE_ORIGIN : url.origin;
}
export const returnUrl = (page: "admin" | "billing" | "credits" | "ambassador" = "admin") =>
  page === "ambassador"
    ? `${appOrigin()}/?mobile=ambassador&ambassadorTab=checkout#profile`
    : page === "admin"
    ? `${appOrigin()}/?mobile=billing#profile`
    : `${appOrigin()}/?mobile=${page}#profile`;
