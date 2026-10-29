/* No private page, API response or application bundle is stored in Cache Storage. */
const CACHE = "mentora-offline-v1";
const OFFLINE = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("mentora-offline-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" })).catch(
        async () =>
          (await caches.match(OFFLINE)) ||
          new Response("Mentora est hors ligne. Reconnecte-toi à Internet.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );
  else if (url.pathname === "/icons/icon-192.png")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/icons/icon-192.png")),
    );
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data?.json() || {};
      } catch {}
      const title =
        typeof data.title === "string" ? data.title.slice(0, 100) : "Mentora";
      const body =
        typeof data.body === "string"
          ? data.body.slice(0, 200)
          : "Du nouveau dans ton espace Mentora.";
      let url = "/";
      try {
        const u = new URL(data.url, self.location.origin);
        if (u.origin === self.location.origin && u.pathname === "/")
          url = u.pathname + u.search + u.hash;
      } catch {}
      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge.png",
        tag: typeof data.tag === "string" ? data.tag.slice(0, 100) : "mentora",
        renotify: false,
        data: { url },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL(
        event.notification.data?.url || "/",
        self.location.origin,
      );
      if (target.origin !== self.location.origin) return;
      // Navigate fully so existing query-based tabs are applied, even in an already-open app.
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clients.find(
        (c) => new URL(c.url).origin === target.origin,
      );
      if (existing) {
        await existing.navigate(target.href);
        await existing.focus();
      } else await self.clients.openWindow(target.href);
    })(),
  );
});
