import Stripe from "stripe";
export function stripeTest() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!/^(sk|rk)_test_/.test(key))
    throw Error("Stripe test non configuré. Les clés live sont refusées.");
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
}
export function appOrigin() {
  const url = new URL(
    process.env.MENTORA_BILLING_ORIGIN ||
      process.env.BETTER_AUTH_URL ||
      "https://mentora-resell.vercel.app",
  );
  if (
    url.protocol !== "https:" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost"
  )
    throw Error("Origine invalide");
  return url.origin;
}
export const returnUrl = () =>
  `${appOrigin()}/?adminTab=monetization#moderation`;
