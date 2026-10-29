import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const handlers = {},
  cached = [],
  shown = [],
  opened = [];
const cache = { addAll: async (urls) => cached.push(...urls) };
const self = {
  location: { origin: "https://mentora-resell.vercel.app" },
  addEventListener: (name, fn) => (handlers[name] = fn),
  skipWaiting: async () => {},
  clients: {
    claim: async () => {},
    matchAll: async () => [],
    openWindow: async (url) => opened.push(url),
  },
  registration: {
    showNotification: async (title, options) => shown.push({ title, options }),
  },
};
const context = vm.createContext({
  self,
  caches: {
    open: async () => cache,
    keys: async () => [],
    match: async () => new Response("offline"),
  },
  fetch: async () => {
    throw Error("offline");
  },
  URL,
  Request,
  Response,
});
vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
let pending;
handlers.install({ waitUntil: (p) => (pending = p) });
await pending;
assert.deepEqual(Array.from(cached), ["/offline.html", "/icons/icon-192.png"]);
let intercepted = false;
handlers.fetch({
  request: {
    url: self.location.origin + "/api/me",
    method: "GET",
    mode: "cors",
  },
  respondWith: () => (intercepted = true),
});
assert.equal(intercepted, false);
handlers.push({
  data: {
    json: () => ({
      title: "Mentora",
      body: "Un événement",
      url: "https://evil.example/",
      tag: "x",
    }),
  },
  waitUntil: (p) => (pending = p),
});
await pending;
assert.equal(shown[0].options.data.url, "/");
assert.equal(shown[0].options.icon, "/icons/icon-192.png");
handlers.notificationclick({
  notification: {
    close: () => {},
    data: { url: "/?profileTab=requests#profile" },
  },
  waitUntil: (p) => (pending = p),
});
await pending;
assert.equal(opened[0], self.location.origin + "/?profileTab=requests#profile");
console.log(
  "PWA tests passed: only static fallback cached, APIs not intercepted, foreign click URL rejected, notification routing.",
);

context.Request = class { constructor(request, options) { this.url=request.url; this.cache=options.cache; } };
let offline;
handlers.fetch({request:{url:self.location.origin+'/?profileTab=requests',method:'GET',mode:'navigate'},respondWith:p=>offline=p});
assert.equal(await (await offline).text(),'offline');
console.log('Offline navigation fallback passed; no private response cached.');
