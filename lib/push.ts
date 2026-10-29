import webpush from "web-push";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "./db";
import type { MailKind, MailData } from "./email-templates";
const now = () => new Date().toISOString();
export const pushConfigured = () =>
  !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
export function validPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.apple.com") ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const subscriptionSchema = z
  .object({
    endpoint: z.string().max(2000).refine(validPushEndpoint),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
      })
      .strict(),
    expirationTime: z.number().nullable().optional(),
  })
  .strict();
export async function migratePush() {
  await query(
    "CREATE TABLE IF NOT EXISTS push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,endpoint TEXT NOT NULL UNIQUE,p256dh TEXT NOT NULL,auth TEXT NOT NULL,label TEXT NOT NULL,created_at TEXT NOT NULL,last_test_at TEXT NOT NULL DEFAULT '')",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS push_owner ON push_subscriptions(user_id)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS push_preferences(user_id TEXT PRIMARY KEY,vacancies INTEGER NOT NULL DEFAULT 0)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS push_outbox(id TEXT PRIMARY KEY,subscription_id TEXT NOT NULL,user_id TEXT NOT NULL,event_id TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt TEXT NOT NULL DEFAULT '',lease_until TEXT NOT NULL DEFAULT '')",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS push_due ON push_outbox(status,next_attempt)",
  );
}
export async function subscribe(
  userId: string,
  input: z.infer<typeof subscriptionSchema>,
  label: string,
) {
  const id = randomUUID();
  // Never transfer an existing device endpoint to another member.
  const rows = await query(
    `INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,label,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,label=excluded.label WHERE push_subscriptions.user_id=excluded.user_id RETURNING id`,
    [
      id,
      userId,
      input.endpoint,
      input.keys.p256dh,
      input.keys.auth,
      label.slice(0, 80),
      now(),
    ],
  );
  if (!rows.length) throw Error("DEVICE_BOUND");
  return String(rows[0].id);
}
export async function removeSubscription(userId: string, id?: string) {
  const rows = await query(
    "DELETE FROM push_subscriptions WHERE user_id=$1" +
      (id ? " AND id=$2" : "") +
      " RETURNING id",
    id ? [userId, id] : [userId],
  );
  for (const r of rows)
    await query(
      "DELETE FROM push_outbox WHERE subscription_id=$1 AND user_id=$2",
      [String(r.id), userId],
    );
}
export const pushMessages: Record<string, { title: string; body: string }> = {
  request_received: {
    title: "Nouvelle demande de parrainage",
    body: "Une nouvelle demande t’attend dans Mentora.",
  },
  accepted: {
    title: "Demande acceptée",
    body: "Retrouve ton binôme dans Mentora.",
  },
  declined: {
    title: "Demande refusée",
    body: "Consulte la réponse dans tes demandes.",
  },
  cancelled: {
    title: "Demande annulée",
    body: "Une demande a été annulée. Consulte ton espace.",
  },
  completed_beginner: {
    title: "Accompagnement terminé",
    body: "Retrouve le bilan et laisse ton avis dans Mentora.",
  },
  completed_mentor: {
    title: "Accompagnement terminé",
    body: "Retrouve cet accompagnement dans ton historique.",
  },
  verification_approved: {
    title: "Compte parrain vérifié",
    body: "Ton badge est disponible dans Mentora.",
  },
  verification_changes: {
    title: "Dossier à compléter",
    body: "Consulte le retour dans les paramètres de ton compte.",
  },
  place_available: {
    title: "Une place est disponible",
    body: "Un parrain que tu suis a de nouveau une place. Découvre son profil.",
  },
  test: {
    title: "Mentora",
    body: "Les notifications fonctionnent sur cet appareil.",
  },
};
export async function enqueuePush(
  eventId: string,
  userId: string,
  kind: MailKind,
  data: MailData,
) {
  if (!pushMessages[kind]) return;
  const [event] = await query(
    "SELECT created_at FROM email_events WHERE id=$1",
    [eventId],
  );
  if (!event) return;
  const pref = (
    await query("SELECT vacancies FROM push_preferences WHERE user_id=$1", [
      userId,
    ])
  )[0];
  if (kind === "place_available" && !Number(pref?.vacancies)) return;
  const subs = await query(
    "SELECT id,created_at FROM push_subscriptions WHERE user_id=$1",
    [userId],
  );
  const url =
    kind === "place_available"
      ? `/?member=${encodeURIComponent(data.profileId || "")}#directory`
      : kind.startsWith("verification")
        ? "/?profileTab=verification#profile"
        : kind === "accepted" || kind.startsWith("completed")
          ? "/?profileTab=accompaniments#profile"
          : "/?profileTab=requests#profile";
  for (const s of subs) {
    if (
      new Date(String(s.created_at)).getTime() >
      new Date(String(event.created_at)).getTime()
    )
      continue;
    const id = createHash("sha256")
      .update(`${eventId}:${kind}:${s.id}`)
      .digest("hex");
    await query(
      "INSERT INTO push_outbox(id,subscription_id,user_id,event_id,kind,url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
      [id, String(s.id), userId, eventId, kind, url, now()],
    );
  }
}
async function stillRelevant(job: Record<string, unknown>) {
  const [event] = await query(
    "SELECT kind,entity_id FROM email_events WHERE id=$1",
    [String(job.event_id)],
  );
  if (!event) return false;
  const [member] = await query('SELECT id FROM "user" WHERE id=$1', [
    String(job.user_id),
  ]);
  if (!member) return false;
  if (
    ["pending", "active", "declined", "cancelled", "completed"].includes(
      String(event.kind),
    )
  ) {
    const [pair] = await query(
      "SELECT status,beginner_id,mentor_id FROM accompaniments WHERE id=$1",
      [String(event.entity_id)],
    );
    return (
      !!pair &&
      pair.status === event.kind &&
      [pair.beginner_id, pair.mentor_id].includes(job.user_id)
    );
  }
  if (event.kind === "approved" || event.kind === "changes") {
    const [v] = await query(
      "SELECT revision,status FROM verifications WHERE user_id=$1",
      [String(job.user_id)],
    );
    return (
      event.entity_id === job.user_id &&
      !!v &&
      `review:${job.user_id}:${v.revision}` === job.event_id &&
      v.status === event.kind
    );
  }
  if (event.kind === "vacancy") {
    const [p] = await query(
      `SELECT p.details,(SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active FROM profiles p JOIN follows f ON f.followed_id=p.user_id JOIN push_preferences pref ON pref.user_id=f.follower_id WHERE p.user_id=$1 AND f.follower_id=$2 AND pref.vacancies=1 AND p.visible=1 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)`,
      [String(event.entity_id), String(job.user_id)],
    );
    return (
      !!p && Number(JSON.parse(String(p.details)).capacity) > Number(p.active)
    );
  }
  return false;
}
export async function sendPush(
  sub: Record<string, unknown>,
  payload: Record<string, unknown>,
) {
  if (!pushConfigured()) throw Error("PUSH_NOT_CONFIGURED");
  if (!validPushEndpoint(String(sub.endpoint))) throw Error("INVALID_ENDPOINT");
  return webpush.sendNotification(
    {
      endpoint: String(sub.endpoint),
      keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) },
    },
    JSON.stringify(payload),
    {
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT!,
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
      TTL: 3600,
      urgency: "normal",
      timeout: 7000,
    },
  );
}
export async function runPushWorker() {
  if (!pushConfigured()) return { configured: false, sent: 0 };
  let sent = 0;
  const start = Date.now();
  await query("DELETE FROM push_outbox WHERE created_at<$1", [
    new Date(Date.now() - 30 * 86400000).toISOString(),
  ]);
  const jobs = await query(
    "SELECT * FROM push_outbox WHERE (status='pending' AND next_attempt<=$1) OR (status='sending' AND lease_until<$1) ORDER BY created_at,id LIMIT 30",
    [now()],
  );
  for (const job of jobs) {
    if (Date.now() - start > 16000) break;
    const lease = new Date(Date.now() + 60000).toISOString();
    const claimed = await query(
      "UPDATE push_outbox SET status='sending',lease_until=$2,attempts=attempts+1 WHERE id=$1 AND ((status='pending' AND next_attempt<=$3) OR (status='sending' AND lease_until<$3)) RETURNING id",
      [String(job.id), lease, now()],
    );
    if (!claimed.length) continue;
    const [sub] = await query(
      "SELECT * FROM push_subscriptions WHERE id=$1 AND user_id=$2",
      [String(job.subscription_id), String(job.user_id)],
    );
    if (
      !sub ||
      Date.now() - new Date(String(job.created_at)).getTime() > 86400000 ||
      !(await stillRelevant(job))
    ) {
      await query("UPDATE push_outbox SET status='skipped' WHERE id=$1", [
        String(job.id),
      ]);
      continue;
    }
    try {
      await sendPush(sub, {
        ...pushMessages[String(job.kind)],
        url: job.url,
        tag: job.id,
      });
      await query("UPDATE push_outbox SET status='sent' WHERE id=$1", [
        String(job.id),
      ]);
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await removeSubscription(String(job.user_id), String(sub.id));
      } else {
        const attempts = Number(job.attempts) + 1;
        await query(
          "UPDATE push_outbox SET status=$2,next_attempt=$3 WHERE id=$1",
          [
            String(job.id),
            attempts >= 5 ? "failed" : "pending",
            new Date(Date.now() + 60000 * 2 ** attempts).toISOString(),
          ],
        );
      }
    }
  }
  return { configured: true, sent };
}
