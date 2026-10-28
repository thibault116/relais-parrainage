import { guard, json, user } from "@/lib/http";
import { addTask, changeTask, removeTask, taskLists } from "@/lib/tasks";
import { z } from "zod";
export const runtime = "nodejs";
const bodySchema = z.string().trim().min(1).max(1000);
export async function GET(request: Request) {
  try {
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    return json({ lists: await taskLists(u.id) });
  } catch {
    return json({ error: "Impossible de charger les listes." }, 503);
  }
}
async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    if (!u) return json({ error: "Connexion requise." }, 401);
    const schema =
      method === "POST"
        ? z.object({ pairId: z.string().uuid(), body: bodySchema }).strict()
        : method === "DELETE"
          ? z.object({ id: z.string().uuid() }).strict()
          : z
              .object({
                id: z.string().uuid(),
                body: bodySchema.optional(),
                done: z.boolean().optional(),
              })
              .strict()
              .refine((v) => (v.body !== undefined) !== (v.done !== undefined));
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return json(
        { error: "Tâche invalide : indique un texte de 1 à 1 000 caractères." },
        400,
      );
    const input = parsed.data as {
      id: string;
      pairId: string;
      body?: string;
      done?: boolean;
    };
    const rows =
      method === "POST"
        ? await addTask(u.id, input.pairId, input.body!)
        : method === "DELETE"
          ? await removeTask(u.id, input.id)
          : await changeTask(u.id, input.id, input.body, input.done);
    if (!rows.length)
      return json(
        {
          error:
            "Cette action n’est pas autorisée ou le binôme est terminé. Actualise la liste.",
        },
        409,
      );
    return json({ ok: true }, method === "POST" ? 201 : 200);
  } catch {
    return json({ error: "Impossible d’enregistrer la tâche." }, 503);
  }
}
export const POST = (r: Request) => mutate(r, "POST");
export const PATCH = (r: Request) => mutate(r, "PATCH");
export const DELETE = (r: Request) => mutate(r, "DELETE");
