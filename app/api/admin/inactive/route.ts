import { guard, json, user } from "@/lib/http";
import { isModerator } from "@/lib/verification";
import {
  inactiveAccounts,
  inactivityDays,
  queueReminder,
} from "@/lib/retention";
import { emailConfigured } from "@/lib/email";
import { readPlatformSettings } from "@/lib/platform-settings";
import { sendEmailsAfterResponse } from "@/lib/email-after";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
const daysSchema = z
  .number()
  .refine((n) => (inactivityDays as readonly number[]).includes(n));
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const params = new URL(request.url).searchParams;
    const days = daysSchema.safeParse(Number(params.get("days") || 30));
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .safeParse(params.get("page") || 0);
    if (!days.success || !page.success)
      return json({ error: "Filtre invalide." }, 400);
    const { settings } = await readPlatformSettings();
    return json({
      ...(await inactiveAccounts(days.data, page.data)),
      canSend: emailConfigured() && settings.emailsEnabled,
    });
  } catch {
    return json({ error: "Impossible de charger les comptes inactifs." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u || !(await isModerator(u.id)))
      return json({ error: "Accès administrateur requis." }, 403);
    const body = z
      .object({
        userId: z.string().min(1).max(200),
        days: daysSchema,
        subject: z
          .string()
          .trim()
          .min(3)
          .max(150)
          .regex(/^[^\r\n]+$/),
        message: z.string().trim().min(10).max(5000),
      })
      .safeParse(await request.json());
    if (!body.success)
      return json(
        {
          error:
            "Renseigne un objet et un message valides (10 à 5 000 caractères).",
        },
        400,
      );
    const { settings } = await readPlatformSettings();
    if (!emailConfigured() || !settings.emailsEnabled)
      return json(
        { error: "Les envois d’e-mails sont désactivés ou non configurés." },
        409,
      );
    const { userId, days, subject, message } = body.data;
    if (!(await queueReminder(u.id, userId, days, subject, message)))
      return json(
        {
          error:
            "Relance impossible : compte redevenu actif, notifications désactivées, compte modéré ou relance déjà programmée dans les 7 derniers jours.",
        },
        409,
      );
    sendEmailsAfterResponse();
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de programmer la relance." }, 503);
  }
}
