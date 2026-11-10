import { manageSubscription } from "@/lib/monetization/billing";
import { user, json, guard } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { query } from "@/lib/db";
import { plans, packs, payoutRate, maxCustomCredits } from "@/lib/monetization/catalog";
import {
  balance,
  saveService,
  book,
  bookingAction,
} from "@/lib/monetization/store";
import { checkout, portal, objectId } from "@/lib/monetization/payments";
import { stripeTest } from "@/lib/monetization/stripe";
import { pricingProposal } from "@/lib/pricing-proposal";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès propriétaire uniquement" }, 403);
  try {
    const id = u!.id;
    return json({
      plans,
      packs,
      comparison: pricingProposal.comparison,
      payoutRate: payoutRate(),
      configured:
        /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || "") &&
        !!process.env.STRIPE_WEBHOOK_SECRET,
      balance: await balance(query, id),
      account: (
        await query(
          "SELECT plan,status,cancel_at_end FROM money_accounts WHERE owner_id=$1",
          [id],
        )
      )[0] ?? { plan: "free", status: "free" },
      services: (
        await query(
          "SELECT * FROM money_services WHERE owner_id=$1 AND archived=0 ORDER BY created_at DESC",
          [id],
        )
      ).map((s) => ({ ...s, data: JSON.parse(String(s.data)) })),
      bookings: (
        await query(
          "SELECT * FROM money_bookings WHERE owner_id=$1 ORDER BY created_at DESC",
          [id],
        )
      ).map((b) => ({ ...b, snapshot: JSON.parse(String(b.snapshot)) })),
      ledger: await query(
        "SELECT delta,kind,created_at FROM money_ledger WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200",
        [id],
      ),
      payments: await query(
        "SELECT id,amount,credits,refund_amount,invoice_url,created_at FROM money_payments WHERE owner_id=$1 ORDER BY created_at DESC",
        [id],
      ),
    });
  } catch {
    return json(
      { error: "Monétisation indisponible, vérifier les migrations." },
      503,
    );
  }
}
export async function POST(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès propriétaire uniquement" }, 403);
  const blocked = await guard(r);
  if (blocked) return blocked;
  try {
    const d = await r.json(),
      id = u!.id;
    const action = z.string().parse(d.action);
    if (action === "save")
      return json({
        id: await saveService(
          id,
          d.service,
          d.id ? z.string().uuid().parse(d.id) : undefined,
        ),
      });
    if (action === "delete") {
      await query(
        "UPDATE money_services SET archived=1 WHERE id=$1 AND owner_id=$2",
        [z.string().uuid().parse(d.id), id],
      );
      return json({ ok: true });
    }
    if (action === "book")
      return json({
        id: await book(
          id,
          z.string().uuid().parse(d.id),
          z.string().uuid().parse(d.key),
          z.string().trim().min(5).max(2000).parse(d.notes),
          z.string().trim().min(3).max(200).parse(d.slot),
        ),
      });
    if (action === "booking") {
      await bookingAction(
        id,
        z.string().uuid().parse(d.id),
        z
          .enum(["accept", "complete", "cancel", "decline", "refund"])
          .parse(d.transition),
      );
      return json({ ok: true });
    }
    if (action === "checkout") {
      if (!process.env.STRIPE_WEBHOOK_SECRET)
        throw Error("Webhook Stripe non configuré");
      const code = d.credits === undefined
        ? z.string().parse(d.offer)
        : `custom-v1-${z.number().int().min(1).max(maxCustomCredits).parse(d.credits)}`;
      return json({
        url: await checkout(
          id,
          code,
          z.string().uuid().parse(d.key),
          z
            .enum(["admin", "billing", "credits"])
            .default("admin")
            .parse(d.returnTo),
        ),
      });
    }
    if (
      ["change-plan", "cancel-subscription", "resume-subscription"].includes(
        action,
      )
    ) {
      await manageSubscription(
        id,
        action === "change-plan"
          ? "change"
          : action === "cancel-subscription"
            ? "cancel"
            : "resume",
        d.plan ? z.enum(["starter", "plus", "pro"]).parse(d.plan) : undefined,
      );
      return json({
        ok: true,
        message:
          action === "change-plan"
            ? "Changement programmé au prochain renouvellement."
            : action === "cancel-subscription"
              ? "Résiliation programmée en fin de période."
              : "Abonnement repris.",
      });
    }
    if (action === "portal")
      return json({
        url: await portal(
          id,
          z
            .enum(["admin", "billing", "credits"])
            .default("admin")
            .parse(d.returnTo),
        ),
      });
    if (action === "refund") {
      const p = (
        await query(
          "SELECT * FROM money_payments WHERE id=$1 AND owner_id=$2",
          [z.string().parse(d.id), id],
        )
      )[0];
      if (!p?.payment_intent) throw Error("Paiement introuvable");
      const s = stripeTest();
      const pi = await s.paymentIntents.retrieve(String(p.payment_intent));
      if (pi.livemode) throw Error("Mode réel refusé");
      const account = (
        await query(
          "SELECT customer_id FROM money_accounts WHERE owner_id=$1",
          [id],
        )
      )[0];
      if (objectId(pi.customer) !== account?.customer_id)
        throw Error("Client invalide");
      await s.refunds.create(
        { payment_intent: pi.id },
        { idempotencyKey: `mentora-full-refund:${pi.id}` },
      );
      return json({
        ok: true,
        message:
          "Remboursement test demandé. Solde actualisé après confirmation Stripe.",
      });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json(
      {
        error:
          e instanceof z.ZodError
            ? "Formulaire invalide"
            : e instanceof Error && !("type" in e)
              ? e.message
              : "Stripe indisponible, réessaie.",
      },
      400,
    );
  }
}
