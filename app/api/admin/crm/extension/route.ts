import { user, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { extensionArchive } from "@/lib/extension-archive";
export const runtime = "nodejs";
export async function GET(r: Request) {
  try {
    if (!(await isCrmOwner(await user(r))))
      return json({ error: "Accès réservé au propriétaire du CRM." }, 403);
    return new Response(new Uint8Array(await extensionArchive()), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="mentora-vinted-0.1.0.zip"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return json({ error: "Téléchargement indisponible." }, 503);
  }
}
