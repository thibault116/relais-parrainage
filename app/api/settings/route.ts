import { json } from "@/lib/http";
import { publicSettings } from "@/lib/platform-config";
import { readPlatformSettings } from "@/lib/platform-settings";
import { billingLive, memberCommerceAuthorized } from "@/lib/monetization/mode";
import { featureAvailable } from "@/lib/feature-release";
export async function GET() {
  try {
    return json({
      ...publicSettings((await readPlatformSettings()).settings),
      commerceAvailable:
        billingLive() &&
        memberCommerceAuthorized() &&
        featureAvailable("commerce", false),
    });
  } catch {
    return json({ error: "Paramètres indisponibles." }, 503);
  }
}
