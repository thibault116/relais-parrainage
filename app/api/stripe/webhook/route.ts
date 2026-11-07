import { stripeTest } from "@/lib/monetization/stripe";
import { handleEvent } from "@/lib/monetization/payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook non configuré", { status: 503 });
  const raw = await request.text();
  if (raw.length > 1000000)
    return new Response("Payload trop volumineux", { status: 413 });
  let event;
  try {
    event = stripeTest().webhooks.constructEvent(
      raw,
      request.headers.get("stripe-signature") || "",
      secret,
    );
    if (event.livemode)
      return new Response("Mode réel refusé", { status: 400 });
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }
  try {
    await handleEvent(event);
    return Response.json({ received: true });
  } catch {
    return new Response("Traitement différé, réessayer", { status: 500 });
  }
}
