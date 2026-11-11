import { after } from "next/server";
import { z } from "zod";
import { guard, json, user } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { legalRequestSchema, registerLegalRequest, resolveLegalRequest, runLegalMailWorker } from "@/lib/legal-requests";

export const runtime = "nodejs";
export const maxDuration = 60;

const decisionSchema = z.object({
  action: z.literal("resolve"),
  id: z.string().uuid(),
  decision: z.string().trim().min(15).max(3000),
});

function deliver() {
  after(async () => {
    try {
      await runLegalMailWorker();
    } catch {
      console.error("LEGAL_MAIL_WORKER_FAILED");
    }
  });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  try {
    const reviewer = await user(request);
    if (!reviewer || !(await isCrmOwner(reviewer)))
      return json({ error: "Accès réservé au compte administrateur principal." }, 403);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 20000) return json({ error: "Formulaire trop volumineux." }, 413);
    const input = JSON.parse(raw);
    if (input?.action === "resolve") {
      const parsed = decisionSchema.safeParse(input);
      if (!parsed.success) return json({ error: "Indique une décision motivée." }, 400);
      const ok = await resolveLegalRequest(parsed.data.id, reviewer.id, parsed.data.decision);
      if (!ok) return json({ error: "Déclaration déjà traitée ou introuvable." }, 409);
      deliver();
      return json({ ok: true });
    }
    const parsed = legalRequestSchema.safeParse(input);
    if (!parsed.success)
      return json({ error: parsed.error.issues[0]?.message || "Formulaire invalide." }, 400);
    const network = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "local";
    const result = await registerLegalRequest(parsed.data, network);
    deliver();
    return json(result, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Formulaire invalide." }, 400);
    if (error instanceof Error && error.message === "LIMIT")
      return json({ error: "Limite temporaire atteinte. Tu peux transmettre ta déclaration à mentora.officiel@gmail.com." }, 429);
    if (error instanceof Error && error.message.startsWith("Cette référence"))
      return json({ error: error.message }, 409);
    return json({ error: "Enregistrement indisponible. Écris à mentora.officiel@gmail.com." }, 503);
  }
}
