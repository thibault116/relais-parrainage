import { stripeTest } from "@/lib/monetization/stripe";
import { handleEvent } from "@/lib/monetization/payments";
import { handleConnectEvent } from "@/lib/monetization/connect";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET,process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((value):value is string=>!!value);
  if (!secrets.length) return new Response("Webhook non configuré", { status: 503 });
  const raw = await request.text();
  if (raw.length > 1000000)
    return new Response("Payload trop volumineux", { status: 413 });
  let event;
  try {
    for(const secret of secrets) {
      try {event = stripeTest().webhooks.constructEvent(raw,request.headers.get("stripe-signature") || "",secret);break;} catch {}
    }
    if(!event) return new Response("Signature invalide", { status: 400 });
    if (event.livemode)
      return new Response("Mode réel refusé", { status: 400 });
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }
  try {
    if(event.account) await handleConnectEvent(event);
    else await handleEvent(event);
    return Response.json({ received: true });
  } catch {
    return new Response("Traitement différé, réessayer", { status: 500 });
  }
}
