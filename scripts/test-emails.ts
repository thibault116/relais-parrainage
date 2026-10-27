import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { query, acceptAccompaniment } from "../lib/db";
import { migrateEmail } from "../lib/email-migration";
import { mailKinds, renderMail } from "../lib/email-templates";
import {
  processEvents,
  runEmailWorker,
  enqueueMail,
  queueTestEmails,
} from "../lib/email";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local SQLite only");
await migrateEmail();
const prefix = `mailtest-${crypto.randomUUID()}`;
const m = prefix + "m",
  b = prefix + "b",
  f = prefix + "f",
  pair = prefix + "pair";
const stamp = new Date().toISOString();
const delivery: { to: string; subject: string }[] = [];
const original = nodemailer.createTransport;
let fail = false;
// No network access: exercise the real worker with an in-memory SMTP transport.
nodemailer.createTransport = (() => ({
  sendMail: async (msg: { to: string; subject: string }) => {
    if (fail) throw Object.assign(Error("simulated"), { code: "ECONNECTION" });
    delivery.push(msg);
    return { accepted: [msg.to] };
  },
  close() {},
})) as typeof original;
process.env.GMAIL_APP_PASSWORD = "LOCAL-FAKE-NO-NETWORK";
try {
  for (const kind of mailKinds) {
    const r = renderMail(
      kind,
      {
        name: "<script>x</script>",
        reminderMessage: "<script>x</script>",
        discord: "hello",
        objective: "<img src=x>",
        partner: "Alice",
      },
      true,
    );
    assert(!r.html.includes("<script>"));
    assert(r.html.includes("&lt;script&gt;"));
    assert(r.subject.startsWith("[TEST Mentora]"));
    assert(r.text.includes("https://mentora-resell.vercel.app"));
  }
  for (const [id, role] of [
    [m, "mentor"],
    [b, "beginner"],
    [f, "beginner"],
  ]) {
    await query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$1,$2,0,$3,$3)',
      [id, id + "@example.invalid", Date.now()],
    );
    await query(
      "INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES ($1,$1,$1,$2,$1,$3,1,$4)",
      [id, role, JSON.stringify({ capacity: 1 }), stamp],
    );
  }
  await query(
    "INSERT INTO follows(follower_id,followed_id,created_at) VALUES ($1,$2,$3)",
    [f, m, stamp],
  );
  await query(
    "INSERT INTO accompaniments(id,beginner_id,mentor_id,status,created_at,objective) VALUES ($1,$2,$3,'pending',$4,'Progresser sur Vinted')",
    [pair, b, m, stamp],
  );
  await processEvents();
  await processEvents();
  assert.equal(
    (
      await query("SELECT * FROM email_outbox WHERE event_id=$1", [
        `pair:${pair}:pending`,
      ])
    ).length,
    2,
  );
  await runEmailWorker();
  assert.equal(
    delivery.filter((d) => d.to === m + "@example.invalid").length,
    1,
  );
  assert.equal(
    delivery.filter((d) => d.to === b + "@example.invalid").length,
    1,
  );
  await acceptAccompaniment(pair, m);
  assert.equal(
    Number(
      (
        await query("SELECT slots FROM email_availability WHERE user_id=$1", [
          m,
        ])
      )[0].slots,
    ),
    0,
  );
  await runEmailWorker();
  assert(
    delivery.some(
      (d) => d.to === b + "@example.invalid" && d.subject.includes("acceptée"),
    ),
  );
  await query(
    "UPDATE accompaniments SET status='completed',completed_at=$1 WHERE id=$2",
    [stamp, pair],
  );
  assert.equal(
    Number(
      (
        await query("SELECT slots FROM email_availability WHERE user_id=$1", [
          m,
        ])
      )[0].slots,
    ),
    1,
  );
  await runEmailWorker();
  assert(
    delivery.some(
      (d) => d.to === f + "@example.invalid" && d.subject.includes("place"),
    ),
  );
  assert.equal(delivery.filter((d) => d.subject.includes("terminé")).length, 2);
  const count = delivery.length;
  await runEmailWorker();
  assert.equal(delivery.length, count);
  await query(
    "INSERT INTO email_preferences(user_id,enabled,vacancies) VALUES ($1,0,0)",
    [b],
  );
  await enqueueMail(prefix + "optout", b, "accepted", { name: "test" });
  await runEmailWorker();
  assert.equal(delivery.length, count);
  assert.equal(
    (
      await query("SELECT status FROM email_outbox WHERE event_id=$1", [
        prefix + "optout",
      ])
    )[0].status,
    "skipped",
  );
  await query(
    "INSERT INTO email_preferences(user_id,enabled,vacancies) VALUES ($1,1,0)",
    [f],
  );
  await enqueueMail(prefix + "vacancyoptout", f, "place_available", {
    name: "test",
    profileId: m,
  });
  await runEmailWorker();
  assert.equal(delivery.length, count);
  fail = true;
  await enqueueMail(prefix + "retry", m, "accepted", { name: "test" });
  await runEmailWorker();
  const failed = (
    await query("SELECT * FROM email_outbox WHERE event_id=$1", [
      prefix + "retry",
    ])
  )[0];
  assert.equal(failed.status, "pending");
  assert.equal(failed.error, "ECONNECTION");
  assert.equal(failed.attempts, 1);
  fail = false;
  await query("UPDATE email_outbox SET next_attempt='' WHERE event_id=$1", [
    prefix + "retry",
  ]);
  await runEmailWorker();
  assert.equal(delivery.length, count + 1);
  await queueTestEmails(prefix);
  await queueTestEmails(prefix);
  await runEmailWorker();
  assert.equal(
    delivery.filter((d) => d.to === "thibault.cordiez@hotmail.com").length,
    mailKinds.length,
  );
  assert.equal(
    (
      await query(
        "SELECT * FROM email_outbox WHERE event_id=$1 AND status='sent' AND payload='{}'",
        ["test:" + prefix],
      )
    ).length,
    mailKinds.length,
  );
  console.log(
    "PASS : modèles, HTML échappé, demandes, acceptation, fin, place libérée, dédoublonnage, préférences, relance SMTP, suppression des contenus après envoi. Aucun e-mail réel envoyé.",
  );
} finally {
  nodemailer.createTransport = original;
  delete process.env.GMAIL_APP_PASSWORD;
  await query("DELETE FROM accompaniments WHERE id=$1", [pair]);
  await query("DELETE FROM follows WHERE follower_id=$1", [f]);
  for (const id of [m, b, f]) {
    await query("DELETE FROM email_preferences WHERE user_id=$1", [id]);
    await query("DELETE FROM profiles WHERE user_id=$1", [id]);
    await query("DELETE FROM email_availability WHERE user_id=$1", [id]);
    await query('DELETE FROM "user" WHERE id=$1', [id]);
  }
  await query("DELETE FROM email_outbox WHERE id LIKE $1", [
    "%" + prefix + "%",
  ]);
  await query("DELETE FROM email_events WHERE id LIKE $1", [
    "%" + prefix + "%",
  ]);
}
