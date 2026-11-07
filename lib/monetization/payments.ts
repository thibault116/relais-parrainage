import Stripe from "stripe";
import { query } from "../db";
import { isCrmOwner } from "../crm";
import { offer, plans } from "./catalog";
import { lock, entry, moneyTransaction } from "./store";
import { stripeTest, returnUrl } from "./stripe";
export const objectId = (v: unknown): string =>
  typeof v === "string"
    ? v
    : v && typeof v === "object" && "id" in v
      ? String(v.id)
      : "";
export async function customer(owner: string) {
  const a = (
    await query("SELECT * FROM money_accounts WHERE owner_id=$1", [owner])
  )[0];
  if (a?.customer_id) return String(a.customer_id);
  const c = await stripeTest().customers.create(
    { name: "Mentora · essai administrateur" },
    { idempotencyKey: `mentora-test-customer:${owner}` },
  );
  if (c.livemode) throw Error("Mode réel refusé");
  await query(
    "INSERT INTO money_accounts(owner_id,customer_id) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET customer_id=excluded.customer_id",
    [owner, c.id],
  );
  return c.id;
}
export async function checkout(owner: string, code: string, key: string) {
  const item = offer(code);
  if (!item || !item.cents) throw Error("Offre inconnue");
  const s = stripeTest(),
    cid = await customer(owner),
    subscription = plans.some((p) => p.id === code);
  // Keep one pending/active subscription per owner, including concurrent tabs.
  return moneyTransaction(async (q) => {
    await lock(q, owner);
    const id = `${owner}:${key}`;
    const prior = (await q("SELECT * FROM money_orders WHERE id=$1", [id]))[0];
    if (prior) {
      if (prior.offer !== code) throw Error("Requête déjà utilisée");
      return (await s.checkout.sessions.retrieve(String(prior.session_id))).url;
    }
    if (subscription) {
      const list = await s.subscriptions.list({
        customer: cid,
        status: "all",
        limit: 100,
      });
      if (
        list.data.some(
          (x) => !["canceled", "incomplete_expired"].includes(x.status),
        )
      )
        throw Error(
          "Un abonnement existe déjà. Gère-le avant d’en ouvrir un autre.",
        );
      const open = await s.checkout.sessions.list({
        customer: cid,
        status: "open",
        limit: 100,
      });
      for (const pending of open.data.filter(
        (x) => x.mode === "subscription",
      )) {
        try {
          await s.checkout.sessions.expire(pending.id);
        } catch {
          const current = await s.checkout.sessions.retrieve(pending.id);
          if (current.status !== "expired")
            throw Error(
              "Le paiement précédent est en cours de confirmation. Actualise ton portefeuille avant de recommencer.",
            );
        }
      }
    }
    const session = await s.checkout.sessions.create(
      {
        customer: cid,
        mode: subscription ? "subscription" : "payment",
        integration_identifier: "mentora_private_abcdwxyz",
        client_reference_id: id,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: item.cents,
              product_data: { name: `Mentora ${item.name} · TEST` },
              ...(subscription
                ? { recurring: { interval: "month" as const } }
                : {}),
            },
          },
        ],
        ...(subscription
          ? { subscription_data: { metadata: { mentora_plan: code } } }
          : { invoice_creation: { enabled: true } }),
        success_url: returnUrl(),
        cancel_url: returnUrl(),
      },
      { idempotencyKey: `checkout:${id}` },
    );
    if (session.livemode) throw Error("Mode réel refusé");
    await q(
      "INSERT INTO money_orders(id,owner_id,offer,session_id,created_at) VALUES($1,$2,$3,$4,$5)",
      [id, owner, code, session.id, new Date().toISOString()],
    );
    return session.url;
  });
}
export async function syncSubscription(
  owner: string,
  sub: Stripe.Subscription,
) {
  if (sub.livemode) throw Error("Mode réel refusé");
  const plan = offer(sub.metadata.mentora_plan);
  if (!plan || !plans.some((p) => p.id === plan.id)) return;
  const account = (
    await query(
      "SELECT subscription_id FROM money_accounts WHERE owner_id=$1",
      [owner],
    )
  )[0];
  if (account?.subscription_id && account.subscription_id !== sub.id) {
    const current = await stripeTest().subscriptions.retrieve(
      String(account.subscription_id),
    );
    if (current.created > sub.created) return;
  }
  await query(
    "UPDATE money_accounts SET subscription_id=$1,plan=$2,status=$3,cancel_at_end=$4 WHERE owner_id=$5 AND customer_id=$6",
    [
      sub.id,
      ["active", "trialing"].includes(sub.status) ? plan.id : "free",
      sub.status,
      sub.cancel_at_period_end ? 1 : 0,
      owner,
      objectId(sub.customer),
    ],
  );
}
async function ownerOf(customerId: string) {
  const a = (
    await query("SELECT owner_id FROM money_accounts WHERE customer_id=$1", [
      customerId,
    ])
  )[0];
  if (!a) return null;
  const u = (
    await query('SELECT id,email FROM "user" WHERE id=$1', [String(a.owner_id)])
  )[0];
  if (!u || !(await isCrmOwner({ id: String(u.id), email: String(u.email) })))
    return null;
  return String(a.owner_id);
}
export async function recordPaid(
  owner: string,
  id: string,
  pi: string,
  amount: number,
  credits: number,
  url: string | null,
) {
  return moneyTransaction(async (q) => {
    await lock(q, owner);
    await q(
      "INSERT INTO money_payments(id,owner_id,payment_intent,amount,credits,invoice_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
      [id, owner, pi || null, amount, credits, url, new Date().toISOString()],
    );
    await entry(
      q,
      owner,
      credits,
      "Paiement Stripe test confirmé",
      `payment:${id}`,
    );
  });
}
export async function recordRefund(pi: string, amount: number) {
  return moneyTransaction(async (q) => {
    const row = (
      await q("SELECT * FROM money_payments WHERE payment_intent=$1", [pi])
    )[0];
    if (!row) return false;
    await lock(q, String(row.owner_id));
    const p = (
      await q("SELECT * FROM money_payments WHERE id=$1", [String(row.id)])
    )[0];
    const refunded = Math.max(
      Number(p.refund_amount),
      Math.min(amount, Number(p.amount)),
    );
    const reversed = Math.min(
      Number(p.credits),
      Math.ceil((Number(p.credits) * refunded) / Number(p.amount)),
    );
    const delta = reversed - Number(p.reversed_credits);
    if (delta > 0)
      await entry(
        q,
        String(p.owner_id),
        -delta,
        "Remboursement Stripe test",
        `refund:${p.id}:${refunded}`,
      );
    await q(
      "UPDATE money_payments SET refund_amount=$1,reversed_credits=$2 WHERE id=$3",
      [refunded, reversed, String(p.id)],
    );
    return true;
  });
}
export async function reconcileRefund(pi: string) {
  if (!pi) return;
  const intent = await stripeTest().paymentIntents.retrieve(pi, {
    expand: ["latest_charge"],
  });
  const charge = intent.latest_charge;
  if (charge && typeof charge !== "string" && charge.amount_refunded)
    await recordRefund(pi, charge.amount_refunded);
}
export async function handleEvent(event: Stripe.Event) {
  if (event.livemode) throw Error("Événement réel refusé");
  if (
    (await query("SELECT id FROM money_events WHERE id=$1", [event.id])).length
  )
    return;
  const s = stripeTest();
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  ) {
    const session = await s.checkout.sessions.retrieve(
      objectId(event.data.object),
    );
    if (session.livemode) throw Error("Mode réel refusé");
    const owner = await ownerOf(objectId(session.customer));
    if (owner) {
      const order = (
        await query(
          "SELECT * FROM money_orders WHERE session_id=$1 AND owner_id=$2",
          [session.id, owner],
        )
      )[0];
      if (!order) throw Error("Commande locale pas encore disponible");
      if (session.mode === "subscription" && session.subscription)
        await syncSubscription(
          owner,
          await s.subscriptions.retrieve(objectId(session.subscription)),
        );
      if (session.mode === "payment" && session.payment_status === "paid") {
        const item = offer(String(order.offer));
        if (
          !item ||
          session.currency !== "eur" ||
          session.amount_total !== item.cents
        )
          throw Error("Montant inattendu");
        const invoice = session.invoice
          ? await s.invoices.retrieve(objectId(session.invoice))
          : null;
        await recordPaid(
          owner,
          session.id,
          objectId(session.payment_intent),
          item.cents,
          item.credits,
          invoice?.hosted_invoice_url ?? null,
        );
        await reconcileRefund(objectId(session.payment_intent));
      }
    }
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = await s.invoices.retrieve(objectId(event.data.object));
    const owner = await ownerOf(objectId(invoice.customer));
    const subId = objectId(invoice.parent?.subscription_details?.subscription);
    if (owner && subId) {
      const sub = await s.subscriptions.retrieve(subId);
      await syncSubscription(owner, sub);
      const item = offer(sub.metadata.mentora_plan);
      if (
        event.type === "invoice.paid" &&
        invoice.status === "paid" &&
        item &&
        ["subscription_create", "subscription_cycle"].includes(
          String(invoice.billing_reason),
        )
      ) {
        if (
          invoice.livemode ||
          invoice.currency !== "eur" ||
          invoice.amount_paid !== item.cents
        )
          throw Error("Facture inattendue");
        const payments = await s.invoicePayments.list({
          invoice: invoice.id,
          limit: 100,
        });
        const pi =
          payments.data
            .map((p) => objectId(p.payment.payment_intent))
            .find(Boolean) || "";
        if (!pi) throw Error("Paiement de facture pas encore disponible");
        await recordPaid(
          owner,
          invoice.id,
          pi,
          item.cents,
          item.credits,
          invoice.hosted_invoice_url ?? null,
        );
        await reconcileRefund(pi);
      }
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    const sub = await s.subscriptions.retrieve(objectId(event.data.object));
    const owner = await ownerOf(objectId(sub.customer));
    if (owner) await syncSubscription(owner, sub);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const owner = await ownerOf(objectId(charge.customer));
    if (
      owner &&
      !(await recordRefund(
        objectId(charge.payment_intent),
        charge.amount_refunded,
      ))
    )
      throw Error("Paiement initial non encore enregistré");
  }
  await query(
    "INSERT INTO money_events(id,created_at) VALUES($1,$2) ON CONFLICT(id) DO NOTHING",
    [event.id, new Date().toISOString()],
  );
}
export async function portal(owner: string) {
  const cid = await customer(owner),
    s = stripeTest();
  const config = await s.billingPortal.configurations.create(
    {
      business_profile: { headline: "Mentora · environnement de test privé" },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
      },
    },
    { idempotencyKey: "mentora-test-portal-v1" },
  );
  return (
    await s.billingPortal.sessions.create({
      customer: cid,
      configuration: config.id,
      return_url: returnUrl(),
    })
  ).url;
}
