import { z } from "zod";
import { user, json, guard } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { changeBaseline, dashboard, generateDraft, preview, publish, toggleAutomatic, validateProduction } from "@/lib/changelog/service";
import { editDraft, initialize } from "@/lib/changelog/store";
import { reconcileMessage } from "@/lib/changelog/discord";
import { shaSchema } from "@/lib/changelog/shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const account = await user(request);
  if (!account || !(await isCrmOwner(account))) return json({ error: "Accès réservé au compte administrateur principal." }, 403);
  try { return json(await dashboard()); }
  catch { return json({ error: "Le suivi Discord est temporairement indisponible." }, 503); }
}

export async function POST(request: Request) {
  const account = await user(request);
  if (!account || !(await isCrmOwner(account))) return json({ error: "Accès réservé au compte administrateur principal." }, 403);
  const blocked = await guard(request);
  if (blocked) return blocked;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 20000) return json({ error: "Brouillon trop volumineux." }, 413);
    const input = JSON.parse(text);
    const action = z.enum(["generate", "manual", "edit", "preview", "publish", "automatic", "baseline", "reconcile"]).parse(input.action);
    if (action === "generate" || action === "manual") return json(await generateDraft(action === "manual"));
    if (action === "automatic") {
      await toggleAutomatic(z.boolean().parse(input.enabled));
      return json({ ok: true });
    }
    if (action === "baseline") {
      await initialize(await validateProduction());
      await changeBaseline(shaSchema.parse(input.sha));
      return json({ ok: true });
    }
    const id = z.string().uuid().parse(input.id);
    if (action === "edit") await editDraft(id, z.number().int().positive().parse(input.revision), input);
    if (action === "preview") return json(await preview(id));
    if (action === "publish") {
      if (input.confirm !== true) throw new Error("Confirme la publication de l’annonce.");
      return json({ messageId: await publish(id, z.number().int().positive().parse(input.revision)) });
    }
    if (action === "reconcile") {
      await reconcileMessage(id, z.string().regex(/^\d+$/).parse(input.messageId));
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof z.ZodError || error instanceof SyntaxError
      ? "Vérifie les champs et la taille de l’annonce."
      : error instanceof Error ? error.message : "Action indisponible." }, 400);
  }
}
