import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { query } from "../lib/db";
import { inactiveAccounts, queueReminder } from "../lib/retention";
import { runEmailWorker } from "../lib/email";
import { renderMail } from "../lib/email-templates";
import { GET, POST } from "../app/api/admin/inactive/route";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local SQLite only");
const prefix = `retention-${crypto.randomUUID()}`;
const ids = ["old", "recent", "unknown", "optout", "blocked", "returning"].map(
  (x) => `${prefix}-${x}`,
);
const old = new Date(Date.now() - 45 * 86400000).toISOString();
const transport = nodemailer.createTransport;
const sent: any[] = [];
nodemailer.createTransport = (() => ({
  sendMail: async (msg: any) => {
    sent.push(msg);
    return { accepted: [msg.to] };
  },
  close() {},
})) as typeof transport;
process.env.GMAIL_APP_PASSWORD = "LOCAL-FAKE-NO-NETWORK";
try {
  assert.equal(
    (await GET(new Request("http://localhost/api/admin/inactive"))).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/admin/inactive", {
          method: "POST",
          headers: { origin: "https://wrong.example" },
        }),
      )
    ).status,
    403,
  );
  for (const id of ids)
    await query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,0,$3,$3)',
      [id, `${id}@example.invalid`, Date.now()],
    );
  for (const [i, id] of ids.entries())
    if (i !== 2)
      await query(
        "INSERT INTO member_activity(user_id,last_active_at) VALUES($1,$2)",
        [id, i === 1 ? new Date().toISOString() : old],
      );
  await query("INSERT INTO email_preferences(user_id,enabled) VALUES($1,0)", [
    ids[3],
  ]);
  await query(
    "INSERT INTO profile_blocks(user_id,reason,moderator_id,created_at) VALUES($1,$2,$3,$4)",
    [ids[4], "Temporary test", ids[0], old],
  );
  const list = await inactiveAccounts(30, 0);
  assert(list.accounts.some((a) => a.id === ids[0]));
  assert(!list.accounts.some((a) => a.id === ids[1] || a.id === ids[2]));
  assert.equal(
    await queueReminder(
      "test-admin",
      ids[1],
      30,
      "Bonjour",
      "Message personnalisé",
    ),
    false,
  );
  assert.equal(
    await queueReminder(
      "test-admin",
      ids[2],
      30,
      "Bonjour",
      "Message personnalisé",
    ),
    false,
  );
  assert.equal(
    await queueReminder(
      "test-admin",
      ids[3],
      30,
      "Bonjour",
      "Message personnalisé",
    ),
    false,
  );
  assert.equal(
    await queueReminder(
      "test-admin",
      ids[4],
      30,
      "Bonjour",
      "Message personnalisé",
    ),
    false,
  );
  const attempts = await Promise.all([
    queueReminder(
      "test-admin",
      ids[0],
      30,
      "Ton projet",
      "Bonjour <script>test</script>",
    ),
    queueReminder("test-admin", ids[0], 30, "Ton projet", "Un doublon"),
  ]);
  assert.equal(attempts.filter(Boolean).length, 1);
  await queueReminder(
    "test-admin",
    ids[5],
    30,
    "Ton projet",
    "Bonjour, reviens sur Mentora.",
  );
  await query("UPDATE member_activity SET last_active_at=$1 WHERE user_id=$2", [
    new Date().toISOString(),
    ids[5],
  ]);
  await runEmailWorker();
  assert.equal(
    sent.filter((m) => m.to === `${ids[0]}@example.invalid`).length,
    1,
  );
  assert.equal(
    sent.filter((m) => m.to === `${ids[5]}@example.invalid`).length,
    0,
  );
  const mail = sent.find((m) => m.to === `${ids[0]}@example.invalid`);
  assert(mail.html.includes("&lt;script&gt;"));
  assert(!mail.html.includes("<script>"));
  assert(mail.text.includes("Bonjour <script>test</script>"));
  assert(mail.subject.includes("Ton projet"));
  assert.equal(
    (
      await query(
        "SELECT payload FROM email_outbox WHERE user_id=$1 AND kind='reengagement'",
        [ids[0]],
      )
    )[0].payload,
    "{}",
  );
  assert(
    renderMail("reengagement", {
      name: "",
      reminderSubject: "Test",
      reminderMessage: "Bonjour",
    }).text.includes("#directory"),
  );
  console.log(
    "PASS: admin-only access, inactivity filters, unknown activity, opt-out, moderation, concurrent duplicate suppression, custom email escaping, returned member skipped. No real email sent.",
  );
} finally {
  nodemailer.createTransport = transport;
  delete process.env.GMAIL_APP_PASSWORD;
  for (const id of ids) {
    for (const table of [
      "email_outbox",
      "member_activity",
      "email_preferences",
      "profile_blocks",
    ])
      await query(`DELETE FROM ${table} WHERE user_id=$1`, [id]);
    await query('DELETE FROM "user" WHERE id=$1', [id]);
  }
}
