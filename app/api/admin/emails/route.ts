import { query } from "@/lib/db";
import { guard, json, user } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import { emailConfigured, queueTestEmails } from "@/lib/email";
import { sendEmailsAfterResponse } from "@/lib/email-after";
import { z } from "zod";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès réservé à l’administration." }, 403);
    const counts = await query(
      "SELECT status,COUNT(*) AS count FROM email_outbox GROUP BY status",
    );
    const recent = await query(
      'SELECT e.id,e.kind,e.status,e.test,e.attempts,e.created_at,e.sent_at,e.error,u.name FROM email_outbox e LEFT JOIN "user" u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 50',
    );
    return json({ configured: emailConfigured(), counts, recent });
  } catch {
    return json({ error: "Impossible de charger le suivi des e-mails." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès réservé à l’administration." }, 403);
    const b = z
      .object({
        action: z.enum(["test", "retry"]),
        batch: z.string().uuid().optional(),
      })
      .safeParse(await request.json());
    if (!b.success) return json({ error: "Action invalide." }, 400);
    if (!emailConfigured())
      return json({ error: "La connexion Gmail n’est pas configurée." }, 503);
    if (b.data.action === "test") {
      // One set per day avoids duplicate sends on retries and accidental double-clicks.
      await queueTestEmails(`admin-${new Date().toISOString().slice(0, 10)}`);
    } else
      await query(
        "UPDATE email_outbox SET status='pending',attempts=0,next_attempt='' WHERE status='failed'",
      );
    sendEmailsAfterResponse();
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de lancer les envois." }, 503);
  }
}
