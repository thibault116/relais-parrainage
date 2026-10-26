import { json } from "@/lib/http";
import { publicSettings } from "@/lib/platform-config";
import { readPlatformSettings } from "@/lib/platform-settings";
export async function GET() {
  try {
    return json(publicSettings((await readPlatformSettings()).settings));
  } catch {
    return json({ error: "Paramètres indisponibles." }, 503);
  }
}
