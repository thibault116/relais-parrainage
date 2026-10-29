export const bindingKey = "mentora-push-device";
export function deviceBinding(): { id: string; userId: string } | null {
  try {
    return JSON.parse(localStorage.getItem(bindingKey) || "null");
  } catch {
    return null;
  }
}
export async function detachPush() {
  const binding = deviceBinding();
  if (binding) {
    try {
      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: binding.id }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {}
  }
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      const notifications = await reg?.getNotifications();
      notifications?.forEach((n) => n.close());
    } catch {}
  }
  try {
    localStorage.removeItem(bindingKey);
  } catch {}
}
export async function workerReady() {
  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  if (reg.active) return reg;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            Error(
              "L’installation des notifications prend plus de temps. Réessaie.",
            ),
          ),
        15000,
      ),
    ),
  ]);
}
export const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  !!(navigator as Navigator & { standalone?: boolean }).standalone;
export const iosDevice = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
