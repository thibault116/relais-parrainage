import { timingSafeEqual } from "node:crypto";
import { json } from "@/lib/http";
import { runEmailWorker, queueTestEmails } from "@/lib/email";
import { query } from "@/lib/db";
import { z } from "zod";
export const maxDuration = 60;
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return (
    !!secret &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Non autorisé." }, 401);
  try {
    return json(await runEmailWorker());
  } catch {
    return json({ error: "Traitement des e-mails indisponible." }, 503);
  }
}
export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "Non autorisé." }, 401);
  try {
    const input = z
      .object({ batch: z.string().uuid() })
      .safeParse(await request.json());
    if (!input.success) return json({ error: "Lot invalide." }, 400);
    await queueTestEmails(input.data.batch);
    const result = await runEmailWorker();
    const tests = await query(
      "SELECT kind,status,attempts,error FROM email_outbox WHERE event_id=$1 ORDER BY kind",
      [`test:${input.data.batch}`],
    );
    return json({ ...result, tests });
  } catch {
    return json({ error: "Impossible de lancer les tests." }, 503);
  }
}
