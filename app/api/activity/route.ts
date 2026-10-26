import { guard, json, user } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const blocked = await guard(request);
    if (blocked) return blocked;
    const u = await user(request);
    return u ? json({ ok: true }) : json({ error: "Connexion requise." }, 401);
  } catch {
    return json({ error: "Activité indisponible." }, 503);
  }
}
