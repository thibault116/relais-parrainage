import { readPlatformSettings } from "./platform-settings";
import nodemailer from "nodemailer";
import { query } from "./db";
import {
  MAIL_FROM,
  mailKinds,
  renderMail,
  type MailKind,
  type MailData,
} from "./email-templates";
const iso = () => new Date().toISOString();
const future = (ms: number) => new Date(Date.now() + ms).toISOString();
export const emailConfigured = () => !!process.env.GMAIL_APP_PASSWORD;
export async function enqueueMail(
  eventId: string,
  userId: string | null,
  kind: MailKind,
  payload: MailData,
  test = false,
) {
  await query(
    "INSERT INTO email_outbox(id,event_id,user_id,kind,payload,test,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
    [
      `${eventId}:${kind}:${userId || "test"}`,
      eventId,
      userId,
      kind,
      JSON.stringify(payload),
      test ? 1 : 0,
      iso(),
    ],
  );
}
export async function queueTestEmails(batch: string) {
  for (const kind of mailKinds)
    await enqueueMail(
      `test:${batch}`,
      null,
      kind,
      {
        name: "Thibault",
        partner:
          kind === "request_received" ||
          kind === "completed_mentor" ||
          kind === "cancelled"
            ? "Camille (exemple débutant)"
            : "Alex (exemple parrain)",
        discord: "exemple.mentora",
        objective:
          "Je souhaite améliorer mes annonces Vinted et réaliser mes premières ventes avec un budget de 150 €.",
        feedback: kind.startsWith("verification")
          ? "Exemple de retour de l’administration sur ton dossier."
          : undefined,
      },
      true,
    );
}
export async function processEvents() {
  const started = Date.now();
  const { settings } = await readPlatformSettings();
  const events = await query(
    "SELECT * FROM email_events WHERE processed=0 ORDER BY created_at,id LIMIT 100",
  );
  for (const e of events) {
    if (Date.now() - started > 10000) break;
    if (
      !settings.emailsEnabled ||
      (e.kind === "vacancy" && !settings.vacancyEmailsEnabled)
    ) {
      await query("UPDATE email_events SET processed=1 WHERE id=$1", [
        String(e.id),
      ]);
      continue;
    }
    const id = String(e.id),
      entity = String(e.entity_id),
      kind = String(e.kind);
    if (
      ["pending", "active", "declined", "cancelled", "completed"].includes(kind)
    ) {
      const p = (
        await query(
          `SELECT a.*,b.name AS bname,b.discord AS bdiscord,m.name AS mname,m.discord AS mdiscord FROM accompaniments a JOIN profiles b ON b.user_id=a.beginner_id JOIN profiles m ON m.user_id=a.mentor_id WHERE a.id=$1`,
          [entity],
        )
      )[0];
      if (p) {
        const beginner: MailData = {
          name: String(p.bname),
          partner: String(p.mname),
          discord: String(p.mdiscord),
          objective: String(p.objective || ""),
        };
        const mentor: MailData = {
          name: String(p.mname),
          partner: String(p.bname),
          discord: String(p.bdiscord),
          objective: String(p.objective || ""),
        };
        if (kind === "pending" && p.status === "pending") {
          await enqueueMail(
            id,
            String(p.mentor_id),
            "request_received",
            mentor,
          );
          await enqueueMail(
            id,
            String(p.beginner_id),
            "request_sent",
            beginner,
          );
        }
        if (kind === "active" && p.status === "active")
          await enqueueMail(id, String(p.beginner_id), "accepted", beginner);
        if (kind === "declined")
          await enqueueMail(id, String(p.beginner_id), "declined", beginner);
        if (kind === "cancelled")
          await enqueueMail(id, String(p.mentor_id), "cancelled", mentor);
        if (kind === "completed") {
          await enqueueMail(
            id,
            String(p.beginner_id),
            "completed_beginner",
            beginner,
          );
          await enqueueMail(
            id,
            String(p.mentor_id),
            "completed_mentor",
            mentor,
          );
        }
      }
    } else if (kind === "approved" || kind === "changes") {
      const p = (
        await query(
          "SELECT v.*,p.name FROM verifications v JOIN profiles p ON p.user_id=v.user_id WHERE v.user_id=$1",
          [entity],
        )
      )[0];
      if (p && id === `review:${entity}:${p.revision}`)
        await enqueueMail(
          id,
          entity,
          kind === "approved"
            ? "verification_approved"
            : "verification_changes",
          { name: String(p.name), feedback: String(p.feedback) },
        );
    } else if (kind === "vacancy") {
      const p = (
        await query(
          "SELECT p.*, (SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active FROM profiles p WHERE p.user_id=$1 AND p.visible=1 AND p.role='mentor' AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
          [entity],
        )
      )[0];
      if (
        p &&
        Number(JSON.parse(String(p.details)).capacity) > Number(p.active)
      ) {
        const followers = await query(
          'SELECT f.follower_id,u.name FROM follows f JOIN "user" u ON u.id=f.follower_id WHERE f.followed_id=$1',
          [entity],
        );
        for (const f of followers)
          await enqueueMail(id, String(f.follower_id), "place_available", {
            name: String(f.name),
            partner: String(p.name),
            profileId: String(p.id),
          });
      }
    }
    await query("UPDATE email_events SET processed=1 WHERE id=$1", [id]);
  }
}
export async function runEmailWorker() {
  if (!emailConfigured()) return { configured: false, sent: 0 };
  const lease = future(120000),
    now = iso();
  const lock = await query(
    "UPDATE email_worker SET lease_until=$1 WHERE id='main' AND lease_until<$2 RETURNING id",
    [lease, now],
  );
  if (!lock.length) return { configured: true, busy: true, sent: 0 };
  let sent = 0;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: MAIL_FROM,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, ""),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const started = Date.now();
    await processEvents();
    const budget = Math.max(
      0,
      400 -
        Number(
          (
            await query(
              "SELECT COUNT(*) AS n FROM email_outbox WHERE sent_at>$1",
              [new Date(Date.now() - 86400000).toISOString()],
            )
          )[0].n,
        ),
    );
    const jobs = await query(
      "SELECT * FROM email_outbox WHERE (status='pending' AND next_attempt<=$1) OR (status='sending' AND lease_until<$1) ORDER BY created_at,id LIMIT 20",
      [now],
    );
    for (const job of jobs.slice(0, budget)) {
      if (Date.now() - started > 35000) break;
      let to = "thibault.cordiez@hotmail.com";
      if (!Number(job.test)) {
        const { settings } = await readPlatformSettings();
        const u = (
          await query(
            'SELECT u.email,COALESCE(p.enabled,1) AS enabled,COALESCE(p.vacancies,1) AS vacancies FROM "user" u LEFT JOIN email_preferences p ON p.user_id=u.id WHERE u.id=$1',
            [String(job.user_id)],
          )
        )[0];
        let skip =
          !settings.emailsEnabled ||
          (job.kind === "place_available" && !settings.vacancyEmailsEnabled) ||
          !u ||
          !Number(u.enabled) ||
          (job.kind === "place_available" && !Number(u.vacancies));
        const event = (
          await query("SELECT kind,entity_id FROM email_events WHERE id=$1", [
            String(job.event_id),
          ])
        )[0];
        if (
          event &&
          ["pending", "active", "declined", "cancelled", "completed"].includes(
            String(event.kind),
          )
        ) {
          const pair = (
            await query(
              "SELECT a.status FROM accompaniments a JOIN profiles b ON b.user_id=a.beginner_id JOIN profiles m ON m.user_id=a.mentor_id WHERE a.id=$1",
              [String(event.entity_id)],
            )
          )[0];
          skip = skip || !pair || pair.status !== event.kind;
        }
        if (job.kind === "place_available") {
          const d = JSON.parse(String(job.payload));
          const p = (
            await query(
              "SELECT p.details,(SELECT COUNT(*) FROM accompaniments a WHERE a.mentor_id=p.user_id AND a.status='active') AS active FROM profiles p JOIN follows f ON f.followed_id=p.user_id WHERE p.id=$1 AND p.visible=1 AND f.follower_id=$2 AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)",
              [d.profileId, String(job.user_id)],
            )
          )[0];
          skip =
            skip ||
            !p ||
            Number(JSON.parse(String(p.details)).capacity) <= Number(p.active);
        }
        if (skip) {
          await query(
            "UPDATE email_outbox SET status='skipped',payload='{}' WHERE id=$1",
            [String(job.id)],
          );
          continue;
        }
        to = String(u.email);
      }
      await query(
        "UPDATE email_outbox SET status='sending',attempts=attempts+1,lease_until=$1 WHERE id=$2",
        [lease, String(job.id)],
      );
      try {
        const message = renderMail(
          job.kind as MailKind,
          JSON.parse(String(job.payload)),
          !!Number(job.test),
        );
        const result = await transport.sendMail({
          from: { name: "Mentora", address: MAIL_FROM },
          to,
          replyTo: MAIL_FROM,
          messageId: `<${Buffer.from(String(job.id)).toString("base64url")}@mentora-resell.vercel.app>`,
          ...message,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (!result.accepted.length) throw Error("SMTP_REJECTED");
        await query(
          "UPDATE email_outbox SET status='sent',sent_at=$1,error='',payload='{}' WHERE id=$2",
          [iso(), String(job.id)],
        );
        sent++;
      } catch (error) {
        const code = String((error as { code?: string }).code || "SMTP_ERROR")
          .replace(/[^A-Z0-9_]/gi, "")
          .slice(0, 40);
        const attempts = Number(job.attempts) + 1;
        await query(
          "UPDATE email_outbox SET status=$1,error=$2,next_attempt=$3 WHERE id=$4",
          [
            attempts >= 5 ? "failed" : "pending",
            code,
            future(Math.min(86400000, 60000 * 2 ** attempts)),
            String(job.id),
          ],
        );
      }
    }
    return { configured: true, sent };
  } finally {
    transport.close();
    await query(
      "UPDATE email_worker SET lease_until='' WHERE id='main' AND lease_until=$1",
      [lease],
    );
  }
}
