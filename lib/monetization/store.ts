import { migrateAmbassadors } from "../ambassadors/schema";
import { query, inTransaction, database } from "./db";
import { Pool } from "pg";
import { z } from "zod";
import { payoutRate } from "./payout-rate";
import {billingLive} from "./mode";
import {principalAccount} from "./access";
import { migrateConnect } from "./connect-schema";
let queue: Promise<unknown> = Promise.resolve();
export function moneyTransaction<T>(
  work: (q: typeof query) => Promise<T>,
): Promise<T> {
  if (database() instanceof Pool) return inTransaction(work);
  const result = queue.then(() => inTransaction(work));
  queue = result.catch(() => {});
  return result;
}
export async function migrateMonetization() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS money_accounts(owner_id TEXT PRIMARY KEY,customer_id TEXT UNIQUE,subscription_id TEXT,plan TEXT NOT NULL DEFAULT 'free',status TEXT NOT NULL DEFAULT 'free',cancel_at_end INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS money_services(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_bookings(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,service_id TEXT NOT NULL,snapshot TEXT NOT NULL,credits INTEGER NOT NULL,payout_cents INTEGER NOT NULL,status TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,notes TEXT NOT NULL,slot TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_ledger(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_orders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,offer TEXT NOT NULL,session_id TEXT UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_payments(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,payment_intent TEXT UNIQUE,amount INTEGER NOT NULL,credits INTEGER NOT NULL,refund_amount INTEGER NOT NULL DEFAULT 0,reversed_credits INTEGER NOT NULL DEFAULT 0,invoice_url TEXT,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_service_requests(booking_id TEXT PRIMARY KEY,reason TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_service_images(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,stored_path TEXT NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_test_reprices(payment_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,old_credits INTEGER NOT NULL,old_reversed INTEGER NOT NULL,new_credits INTEGER NOT NULL,new_reversed INTEGER NOT NULL,delta INTEGER NOT NULL,version TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_test_wallet_updates(owner_id TEXT PRIMARY KEY,version TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_service_completion(booking_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,requested_at TEXT,buyer_confirmed_at TEXT,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_service_messages(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,owner_id TEXT NOT NULL,role TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,event_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS money_events(id TEXT PRIMARY KEY,created_at TEXT NOT NULL)`,
  ])
    await query(sql);
  if(database() instanceof Pool)await query("ALTER TABLE money_bookings ADD COLUMN IF NOT EXISTS test_booking INTEGER NOT NULL DEFAULT 0");
  else if(!(await query("PRAGMA table_info(money_bookings)")).some(c=>c.name==="test_booking"))await query("ALTER TABLE money_bookings ADD COLUMN test_booking INTEGER NOT NULL DEFAULT 0");
  await migrateConnect();
  await migrateAmbassadors();
}
export async function lock(q: typeof query, owner: string) {
  await q(
    "INSERT INTO money_accounts(owner_id) VALUES($1) ON CONFLICT(owner_id) DO NOTHING",
    [owner],
  );
  return (
    await q(
      `SELECT * FROM money_accounts WHERE owner_id=$1 ${database() instanceof Pool ? "FOR UPDATE" : ""}`,
      [owner],
    )
  )[0];
}
export async function balance(q: typeof query, owner: string) {
  return Number(
    (
      await q(
        "SELECT COALESCE(SUM(delta),0) AS balance FROM money_ledger WHERE owner_id=$1",
        [owner],
      )
    )[0].balance,
  );
}
export async function entry(
  q: typeof query,
  owner: string,
  delta: number,
  kind: string,
  reference: string,
) {
  return (
    (
      await q(
        "INSERT INTO money_ledger(id,owner_id,delta,kind,reference,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(reference) DO NOTHING RETURNING id",
        [
          crypto.randomUUID(),
          owner,
          delta,
          kind,
          reference,
          new Date().toISOString(),
        ],
      )
    ).length > 0
  );
}
export const serviceSchema = z.object({
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(20).max(5000),
  category: z.string().trim().min(2).max(80),
  duration: z.number().int().min(0).max(10080),
  calls: z.number().int().min(0).max(50),
  followup: z.string().trim().max(2000),
  availability: z.string().trim().min(3).max(2000),
  credits: z.number().int().min(0).max(50000),
  capacity: z.number().int().min(1).max(100),
  published: z.boolean(),
  image: z.union([z.string().uuid(), z.literal("")]).optional(),
});
export async function saveService(owner: string, raw: unknown, id?: string) {
  const data = serviceSchema.parse(raw);
  if (id) {
    const rows = await query(
      "UPDATE money_services SET data=$1 WHERE id=$2 AND owner_id=$3 AND archived=0 RETURNING id",
      [JSON.stringify(data), id, owner],
    );
    if (!rows.length) throw Error("Prestation introuvable");
    return id;
  }
  id = crypto.randomUUID();
  await query(
    "INSERT INTO money_services(id,owner_id,data,created_at) VALUES($1,$2,$3,$4)",
    [id, owner, JSON.stringify(data), new Date().toISOString()],
  );
  return id;
}
export async function book(
  owner: string,
  serviceId: string,
  key: string,
  notes: string,
  slot: string,
) {
  const [service]=await query("SELECT owner_id FROM money_services WHERE id=$1 AND archived=0",[serviceId]);
  if(!service)throw Error("Prestation introuvable");
  const mentor=String(service.owner_id),simulation=await principalAccount(owner);
  if((await query("SELECT user_id FROM profile_blocks WHERE user_id=$1 OR user_id=$2",[owner,mentor])).length)throw Error("Prestation indisponible");
  if(!(await query("SELECT id FROM profiles WHERE user_id=$1 AND role='mentor'",[mentor])).length)throw Error("Prestation indisponible");
  if(owner===mentor&&!simulation)throw Error("Tu ne peux pas réserver ta propre prestation.");
  return moneyTransaction(async (q) => {
    for(const id of [...new Set([owner,mentor])].sort())await lock(q,id);
    const previous = (
      await q("SELECT * FROM money_bookings WHERE request_key=$1", [
        `${owner}:${key}`,
      ])
    )[0];
    if (previous) {
      if (
        previous.service_id !== serviceId ||
        previous.notes !== notes ||
        previous.slot !== slot
      )
        throw Error("Requête déjà utilisée");
      return String(previous.id);
    }
    const s = (
      await q(
        "SELECT * FROM money_services WHERE id=$1 AND owner_id=$2 AND archived=0",
        [serviceId, mentor],
      )
    )[0];
    if (!s) throw Error("Prestation introuvable");
    const d = serviceSchema.parse(JSON.parse(String(s.data)));
    if (!d.published) throw Error("Prestation indisponible");
    const active = Number(
      (
        await q(
          "SELECT COUNT(*) AS n FROM money_bookings WHERE service_id=$1 AND status IN ('reserved','accepted','completion_pending')",
          [serviceId],
        )
      )[0].n,
    );
    if (active >= d.capacity) throw Error("Plus de disponibilité");
    if (d.credits > 0 && (await balance(q, owner)) < d.credits)
      throw Error("Crédits insuffisants");
    const id = crypto.randomUUID();
    await q(
      "INSERT INTO money_bookings(id,owner_id,service_id,snapshot,credits,payout_cents,status,request_key,notes,slot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        owner,
        serviceId,
        JSON.stringify(d),
        d.credits,
        Math.round(d.credits * payoutRate()),
        "reserved",
        `${owner}:${key}`,
        notes,
        slot,
        new Date().toISOString(),
      ],
    );
    if(simulation)await q("UPDATE money_bookings SET test_booking=1 WHERE id=$1",[id]);
    if(d.credits>0)await entry(q, owner, -d.credits, "Réservation", `booking:${id}`);
    await serviceMessage(q,owner,id,"buyer","request",d.credits===0?"Nouvelle demande de prestation gratuite. Aucun crédit ne sera débité.":"Nouvelle demande de prestation. Les crédits sont réservés en attendant la réponse du parrain.",0,`request:${id}`);
    return id;
  });
}
export async function bookingAction(
  owner: string,
  id: string,
  action: string,
  reason = "",
) {
  return moneyTransaction(async (q) => {
    const [initial]=await q("SELECT b.*,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1",[id]);
    if(!initial||![initial.owner_id,initial.mentor].includes(owner))throw Error("Réservation introuvable");
    for(const id of [...new Set([String(initial.owner_id),String(initial.mentor)])].sort())await lock(q,id);
    const [b]=await q("SELECT b.*,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1",[id]);
    if(["accept","complete","decline"].includes(action)&&b.mentor!==owner)throw Error("Action réservée au parrain.");
    if(action==="cancel"&&b.owner_id!==owner)throw Error("Action réservée à l’acheteur.");
    if(action==="refund"&&!await principalAccount(owner))throw Error("Action réservée à l’administration.");
    const buyer=String(b.owner_id);
    if (action === "accept" && b.status === "reserved") {
      await q("UPDATE money_bookings SET status='accepted' WHERE id=$1", [id]);
      await serviceMessage(
        q,
        buyer,
        id,
        "system",
        "accepted",
        Number(b.credits)===0?"Ta demande de prestation gratuite a été acceptée. Vous pouvez échanger ici.":`Ta demande de prestation a été acceptée. Les ${b.credits} crédits réservés sont affectés à cette prestation. Vous pouvez échanger ici.`,
        0,
        `accept:${id}`,
      );
    } else if (action === "complete" && b.status === "accepted") {
      const now = new Date().toISOString();
      await q(
        "INSERT INTO money_service_completion(booking_id,revision,requested_at,updated_at) VALUES($1,1,$2,$2) ON CONFLICT(booking_id) DO UPDATE SET revision=money_service_completion.revision+1,requested_at=excluded.requested_at,buyer_confirmed_at=NULL,updated_at=excluded.updated_at",
        [id, now],
      );
      const [confirmation] = await q(
        "SELECT revision FROM money_service_completion WHERE booking_id=$1",
        [id],
      );
      await q(
        "UPDATE money_bookings SET status='completion_pending' WHERE id=$1",
        [id],
      );
      await serviceMessage(
        q,
        buyer,
        id,
        "system",
        "completion",
        "Le parrain indique que la prestation est terminée. Est-ce bien le cas ?",
        Number(confirmation.revision),
        `complete:${id}:${confirmation.revision}`,
      );
    } else if (
      ["cancel", "decline"].includes(action) &&
      ["reserved", "accepted", "completion_pending"].includes(String(b.status))
    ) {
      await q("UPDATE money_bookings SET status=$1 WHERE id=$2", [
        action === "cancel" ? "cancelled" : "declined",
        id,
      ]);
      if(Number(b.credits)>0)await entry(q, buyer, Number(b.credits), "Restitution", `restore:${id}`);
    } else if (action === "refund" && b.status === "completed") {
      if (
        (
          await q(
            "SELECT booking_id FROM money_connect_allocations WHERE booking_id=$1",
            [id],
          )
        ).length
      )
        throw Error(
          "Cette rémunération est réservée ou transférée dans un retrait. Vérifie le retrait avant de rembourser cette prestation.",
        );
      await q("UPDATE money_bookings SET status='refunded' WHERE id=$1", [id]);
      if(Number(b.credits)>0)await entry(
        q,
        buyer,
        Number(b.credits),
        "Restitution après prestation",
        `restore:${id}`,
      );
    } else throw Error("Transition impossible ou déjà effectuée");
    if(["decline","cancel","refund"].includes(action))await serviceMessage(q,buyer,id,action==="cancel"?"buyer":"system",action,action==="decline"?`La demande a été refusée : ${reason}`:action==="cancel"?(Number(b.credits)===0?"La demande de prestation gratuite a été annulée.":"La demande a été annulée. Les crédits ont été restitués."):(Number(b.credits)===0?"La prestation gratuite a été clôturée sans mouvement de crédits.":"La prestation a été remboursée en crédits."),0,`${action}:${id}`);
    if (action === "decline" && reason)
      await q(
        "INSERT INTO money_service_requests(booking_id,reason,updated_at) VALUES($1,$2,$3) ON CONFLICT(booking_id) DO UPDATE SET reason=$2,updated_at=$3",
        [id, reason, new Date().toISOString()],
      );
  });
}

export async function serviceMessage(
  q: typeof query,
  owner: string,
  booking: string,
  role: string,
  kind: string,
  body: string,
  revision: number,
  event: string,
) {
  const inserted=await q(
    "INSERT INTO money_service_messages(id,booking_id,owner_id,role,kind,body,revision,event_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(event_key) DO NOTHING RETURNING id",
    [
      crypto.randomUUID(),
      booking,
      owner,
      role,
      kind,
      body,
      revision,
      event,
      new Date().toISOString(),
    ],
  );
  if(inserted.length){
    const [b]=await q("SELECT b.owner_id,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1",[booking]);
    const recipient=role==="buyer"?String(b.mentor):String(b.owner_id);
    if(b.mentor!==b.owner_id){
      const now=new Date().toISOString();
      for(const sub of await q("SELECT id FROM push_subscriptions WHERE user_id=$1",[recipient]))await q("INSERT INTO push_outbox(id,subscription_id,user_id,event_id,kind,url,created_at) VALUES($1,$2,$3,$4,'service_message',$5,$6) ON CONFLICT(id) DO NOTHING",[crypto.randomUUID(),String(sub.id),recipient,String(inserted[0].id),`/?mobile=messages&chat=service:${booking}#profile`,now]);
    }
  }
}
export async function confirmService(
  owner: string,
  id: string,
  revision: number,
  yes: boolean,
) {
  return moneyTransaction(async (q) => {
    const [initial]=await q("SELECT b.owner_id,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1",[id]);
    if(!initial||initial.owner_id!==owner)throw Error("Confirmation réservée à l’acheteur.");
    for(const id of [...new Set([owner,String(initial.mentor)])].sort())await lock(q,id);
    const [b] = await q(
      "SELECT b.*,s.owner_id AS mentor FROM money_bookings b JOIN money_services s ON s.id=b.service_id WHERE b.id=$1 AND b.owner_id=$2",
      [id, owner],
    );
    const [c] = await q(
      "SELECT * FROM money_service_completion WHERE booking_id=$1",
      [id],
    );
    if (
      !b ||
      b.status !== "completion_pending" ||
      Number(c?.revision) !== revision
    )
      throw Error("Cette demande de confirmation n’est plus active.");
    if(b.mentor===owner)await q("UPDATE money_bookings SET test_booking=1 WHERE id=$1",[id]);
    // Principal self-tests are permitted but never create withdrawable earnings.
    if (b.mentor === owner && !await principalAccount(owner))
      throw Error(
        "Une prestation réelle ne peut pas être confirmée par son propre parrain.",
      );
    await q("UPDATE money_bookings SET status=$1 WHERE id=$2", [
      yes ? "completed" : "accepted",
      id,
    ]);
    await q(
      "UPDATE money_service_completion SET buyer_confirmed_at=$1,updated_at=$2 WHERE booking_id=$3",
      [yes ? new Date().toISOString() : null, new Date().toISOString(), id],
    );
    await serviceMessage(
      q,
      owner,
      id,
      "buyer",
      "confirmation",
      yes
        ? (Number(b.credits)===0?"Oui, la prestation gratuite est terminée.":"Oui, la prestation est terminée. La rémunération du parrain est maintenant disponible.")
        : "Non, la prestation continue. Échangeons sur ce qu’il reste à faire.",
      revision,
      `confirm:${id}:${revision}`,
    );
  });
}
