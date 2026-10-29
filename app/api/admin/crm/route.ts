import { user, guard, json } from "@/lib/http";
import { isCrmOwner, createCrmConnection, crmOverview } from "@/lib/crm";
import { query } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(r: Request) {
  try {
    const u = await user(r);
    if (!u || !(await isCrmOwner(u)))
      return json({ error: "Accès réservé au propriétaire du CRM." }, 403);
    const p = Number(new URL(r.url).searchParams.get("page") || 0);
    return json(
      await crmOverview(
        u.id,
        Number.isInteger(p) ? Math.max(0, Math.min(p, 100000)) : 0,
      ),
    );
  } catch {
    return json({ error: "Impossible de charger le CRM." }, 503);
  }
}
export async function POST(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u || !(await isCrmOwner(u)))
      return json({ error: "Accès réservé au propriétaire du CRM." }, 403);
    return json(await createCrmConnection(u.id));
  } catch {
    return json({ error: "Impossible de créer la connexion." }, 503);
  }
}
export async function DELETE(r: Request) {
  try {
    const denied = await guard(r);
    if (denied) return denied;
    const u = await user(r);
    if (!u || !(await isCrmOwner(u)))
      return json({ error: "Accès réservé au propriétaire du CRM." }, 403);
    await query("DELETE FROM crm_connections WHERE owner_id=$1", [u.id]);
    return json({ ok: true });
  } catch {
    return json({ error: "Impossible de révoquer la connexion." }, 503);
  }
}
