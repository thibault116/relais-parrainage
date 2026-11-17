import type Stripe from "stripe";
import { query } from "./db";
import { moneyTransaction, lock } from "./store";
import { stripeBilling } from "./stripe";
import { billingLive, moneyMode } from "./mode";
import { objectId } from "./payments";
// Retain payment history and balances; stop only this account's existing recurring contracts.
export async function switchToCredits(
  owner: string,
  provider: () => Stripe = stripeBilling,
) {
  const [a] = await query("SELECT * FROM money_accounts WHERE owner_id=$1", [
    owner,
  ]);
  if (a?.customer_id) {
    const stripe = provider(),
      customer = String(a.customer_id);
    for await (const sub of stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    })) {
      if (
        !!sub.livemode !== billingLive() ||
        objectId(sub.customer) !== customer
      )
        throw Error("Compte Stripe incompatible.");
      if (["canceled", "incomplete_expired"].includes(sub.status)) continue;
      if (sub.schedule)
        await stripe.subscriptionSchedules.release(objectId(sub.schedule));
      await stripe.subscriptions.cancel(
        sub.id,
        { prorate: false, invoice_now: false },
        {
          idempotencyKey: `mentora-credits-only:${moneyMode()}:${owner}:${sub.id}`,
        },
      );
    }
    for await (const session of stripe.checkout.sessions.list({
      customer,
      status: "open",
      limit: 100,
    })) {
      if (session.mode === "subscription")
        await stripe.checkout.sessions.expire(session.id);
    }
  }
  await moneyTransaction(async (q) => {
    await lock(q, owner);
    await q(
      "UPDATE money_accounts SET plan='free',status='free',subscription_id=NULL,cancel_at_end=0 WHERE owner_id=$1",
      [owner],
    );
  });
  return {
    ok: true,
    message: "Fonctionnement par crédits activé. Ton solde est conservé.",
  };
}
