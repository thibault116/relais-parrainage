import { writeFileSync } from "node:fs";
import { stripeTest, appOrigin } from "../lib/monetization/stripe";
const s = stripeTest();
const url = `${appOrigin()}/api/stripe/webhook`;
const endpoints = await s.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((e) => e.url === url);
if (existing) {
  console.log(
    "Webhook test déjà présent :",
    existing.id,
    "— secret conservé, aucune nouvelle création.",
  );
  process.exit(0);
}
const endpoint = await s.webhookEndpoints.create({
  url,
  description: "Mentora administrateur uniquement — TEST",
  enabled_events: [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "charge.refunded",
  ],
  api_version: "2026-10-28.endive",
});
if (endpoint.livemode || !endpoint.secret)
  throw Error("Webhook test non confirmé");
writeFileSync("/private/tmp/mentora-stripe-webhook-secret", endpoint.secret, {
  mode: 0o600,
});
console.log(
  "Webhook de test créé :",
  endpoint.id,
  "pour",
  url,
  "; secret stocké sans affichage.",
);
