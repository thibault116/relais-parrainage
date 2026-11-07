import { query } from "../db";
import { stripeTest } from "./stripe";
import { objectId } from "./payments";
import { plans } from "./catalog";
import { lock, moneyTransaction } from "./store";
export async function billingDetails(owner: string) {
  const a = (
    await query("SELECT * FROM money_accounts WHERE owner_id=$1", [owner])
  )[0];
  if (!a?.customer_id)
    return { card: null, renewal: null, invoices: [], pendingPlan: null };
  const s = stripeTest();
  const customer = await s.customers.retrieve(String(a.customer_id), {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted || customer.livemode)
    throw Error("Client test invalide");
  const sub = a.subscription_id
    ? await s.subscriptions.retrieve(String(a.subscription_id), {
        expand: ["default_payment_method"],
      })
    : null;
  if (sub && (sub.livemode || objectId(sub.customer) !== customer.id))
    throw Error("Abonnement invalide");
  const pm =
    sub?.default_payment_method ||
    customer.invoice_settings.default_payment_method;
  const payment =
    typeof pm === "string" ? await s.paymentMethods.retrieve(pm) : pm;
  const invoices = await s.invoices.list({ customer: customer.id, limit: 20 });
  let pendingPlan = null;
  if (sub?.schedule) {
    const schedule = await s.subscriptionSchedules.retrieve(
      objectId(sub.schedule),
    );
    pendingPlan =
      schedule.phases.find(
        (p) =>
          p.start_date >= (sub.items.data[0]?.current_period_end || Infinity),
      )?.metadata?.mentora_plan || null;
  }
  return {
    card: payment?.card
      ? {
          brand: payment.card.brand,
          last4: payment.card.last4,
          month: payment.card.exp_month,
          year: payment.card.exp_year,
        }
      : null,
    renewal: sub && ["active", "trialing"].includes(sub.status) ? sub.items.data[0]?.current_period_end || null : null,
    pendingPlan,
    invoices: invoices.data.map((i) => ({
      id: i.id,
      number: i.number,
      amount: i.amount_paid,
      currency: i.currency,
      status: i.status,
      date: i.created,
      url: i.hosted_invoice_url,
      pdf: i.invoice_pdf,
    })),
  };
}
export async function manageSubscription(
  owner: string,
  action: string,
  plan?: string,
) {
  return moneyTransaction(async (q) => {
    const a = await lock(q, owner);
    if (!a.subscription_id || !a.customer_id)
      throw Error("Aucun abonnement actif");
    const s = stripeTest();
    let sub = await s.subscriptions.retrieve(String(a.subscription_id));
    if (
      sub.livemode ||
      objectId(sub.customer) !== a.customer_id ||
      !["active", "trialing"].includes(sub.status)
    )
      throw Error("Abonnement actif requis");
    if (action === "cancel" || action === "resume") {
      if (sub.schedule) {
        const schedule = await s.subscriptionSchedules.retrieve(
          objectId(sub.schedule),
        );
        if (schedule.metadata?.mentora_owner !== owner)
          throw Error("Planification externe : utilise le support");
        await s.subscriptionSchedules.release(schedule.id);
      }
      sub = await s.subscriptions.update(sub.id, {
        cancel_at_period_end: action === "cancel",
      });
      await q("UPDATE money_accounts SET cancel_at_end=$1 WHERE owner_id=$2", [
        action === "cancel" ? 1 : 0,
        owner,
      ]);
      return;
    }
    const target = plans.find((p) => p.id === plan && p.cents > 0);
    if (!target) throw Error("Formule invalide");
    if (sub.cancel_at_period_end)
      throw Error("Reprends ton abonnement avant de changer d’offre");
    if (target.id === sub.metadata.mentora_plan)
      throw Error("Cette formule est déjà active");
    const price = await s.prices.create(
      {
        currency: "eur",
        unit_amount: target.cents,
        recurring: { interval: "month" },
        product_data: { name: `Mentora ${target.name} · TEST` },
      },
      { idempotencyKey: `mentora-switch-price-v1:${target.id}` },
    );
    let schedule = sub.schedule
      ? await s.subscriptionSchedules.retrieve(objectId(sub.schedule))
      : await s.subscriptionSchedules.create(
          { from_subscription: sub.id },
          { idempotencyKey: `mentora-schedule:${sub.id}` },
        );
    if (!schedule.metadata?.mentora_owner && schedule.phases.length === 1)
      schedule = await s.subscriptionSchedules.update(schedule.id, {
        metadata: { mentora_owner: owner },
      });
    if (schedule.metadata?.mentora_owner !== owner)
      throw Error("Planification externe : utilise le support");
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1 || !schedule.current_phase)
      throw Error("Abonnement non compatible");
    await s.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        {
          start_date: schedule.current_phase.start_date,
          end_date: item.current_period_end,
          items: [{ price: item.price.id, quantity: item.quantity || 1 }],
          metadata: { mentora_plan: sub.metadata.mentora_plan },
          proration_behavior: "none",
        },
        {
          start_date: item.current_period_end,
          duration: { interval: "month", interval_count: 1 },
          items: [{ price: price.id, quantity: 1 }],
          metadata: { mentora_plan: target.id },
          proration_behavior: "none",
        },
      ],
    });
  });
}
