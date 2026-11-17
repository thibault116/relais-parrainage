import { z } from "zod";
import { user, json, guard } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { query } from "@/lib/monetization/db";
import { billingLive, moneyMode } from "@/lib/monetization/mode";
import {
  lock,
  moneyTransaction,
  serviceMessage,
  confirmService,
} from "@/lib/monetization/store";
export const runtime = "nodejs";
export async function GET(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès réservé au compte principal." }, 403);
  const id = new URL(r.url).searchParams.get("id");
  if (!id)
    return json({
      threads: (
        await query(
          "SELECT b.id,b.snapshot,b.status,b.created_at,MAX(m.created_at) AS last_at FROM money_bookings b JOIN money_service_messages m ON m.booking_id=b.id AND m.owner_id=b.owner_id WHERE b.owner_id=$1 GROUP BY b.id,b.snapshot,b.status,b.created_at ORDER BY MAX(m.created_at) DESC",
          [u!.id],
        )
      ).map((b) => ({ ...b, snapshot: JSON.parse(String(b.snapshot)) })),
    });
  if (!z.string().uuid().safeParse(id).success)
    return json({ error: "Conversation introuvable." }, 404);
  const [b] = await query(
    "SELECT b.*,COALESCE(c.revision,0) AS revision FROM money_bookings b LEFT JOIN money_service_completion c ON c.booking_id=b.id WHERE b.id=$1 AND b.owner_id=$2",
    [id, u!.id],
  );
  if (!b) return json({ error: "Conversation introuvable." }, 404);
  const messages = await query(
    "SELECT id,role,kind,body,revision,created_at FROM money_service_messages WHERE booking_id=$1 AND owner_id=$2 ORDER BY created_at,id",
    [id, u!.id],
  );
  return json({
    mode: moneyMode(),
    booking: {
      id: b.id,
      title: JSON.parse(String(b.snapshot)).title,
      status: b.status,
      revision: Number(b.revision),
      credits: Number(b.credits),
      payoutCents: Number(b.payout_cents),
    },
    messages,
  });
}
export async function POST(r: Request) {
  const u = await user(r);
  if (!(await isCrmOwner(u)))
    return json({ error: "Accès réservé au compte principal." }, 403);
  const denied = await guard(r);
  if (denied) return denied;
  try {
    const d = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("send"),
            id: z.string().uuid(),
            role: z.enum(["mentor", "buyer"]),
            body: z.string().trim().min(1).max(3000),
            key: z.string().uuid(),
          })
          .strict(),
        z
          .object({
            action: z.literal("confirm"),
            id: z.string().uuid(),
            revision: z.number().int().positive(),
            yes: z.boolean(),
          })
          .strict(),
      ])
      .parse(await r.json());
    if (d.action === "confirm")
      await confirmService(u!.id, d.id, d.revision, d.yes);
    else
      await moneyTransaction(async (q) => {
        await lock(q, u!.id);
        const [b] = await q(
          "SELECT b.status,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1 AND b.owner_id=$2",
          [d.id, u!.id],
        );
        if (
          !b ||
          !["reserved", "accepted", "completion_pending", "completed"].includes(
            String(b.status),
          )
        )
          throw Error("Conversation indisponible.");
        const role = billingLive()
          ? b.mentor === u!.id
            ? "mentor"
            : "buyer"
          : d.role;
        await serviceMessage(
          q,
          u!.id,
          d.id,
          role,
          "text",
          d.body,
          0,
          `text:${u!.id}:${d.id}:${d.key}`,
        );
      });
    return json({ ok: true });
  } catch (e) {
    return json(
      {
        error:
          e instanceof z.ZodError ? "Message invalide." : (e as Error).message,
      },
      400,
    );
  }
}
