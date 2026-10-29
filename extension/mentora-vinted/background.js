const API = "https://mentora-resell.vercel.app/api/crm/sync";
const MARK = "#mentora-crm";
const ALARM = "mentora-sales";
let serial = Promise.resolve();
const locked = (fn) => {
  const result = serial.then(fn);
  serial = result.catch(() => {});
  return result;
};
const state = () => chrome.storage.local.get(null);
const save = (value) => chrome.storage.local.set(value);
const validUrl = (value) => {
  try {
    const u = new URL(value);
    return (
      u.origin === "https://www.vinted.fr" &&
      !u.username &&
      !u.password &&
      !/\/items\//.test(u.pathname)
    );
  } catch {
    return false;
  }
};
const marked = (value) => {
  const u = new URL(value);
  u.hash = MARK;
  return u.href;
};
async function post(s, payload) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
    credentials: "omit",
  });
  if (!res.ok) {
    if ([401, 403, 409].includes(res.status))
      await pause(
        "Connexion CRM refusée. Vérifie ou renouvelle la clé et le compte associé.",
      );
    throw Error(
      `CRM indisponible (${res.status}). Aucune commande perdue : réessaie la synchronisation.`,
    );
  }
}
async function pause(message = "Lecture en pause.") {
  await save({ enabled: false, message });
  await chrome.alarms.clear(ALARM);
  const s = await state();
  if (s.tabId)
    await chrome.tabs.sendMessage(s.tabId, { type: "paused" }).catch(() => {});
}
async function ensureTab(s) {
  const tabs = await chrome.tabs.query({ url: "https://www.vinted.fr/*" });
  const managed = tabs.filter((t) => t.url?.endsWith(MARK));
  // Never take ownership of an ordinary user tab.
  let tab = managed.find((t) => t.id === s.tabId) || managed[0];
  if (managed.length > 1) {
    await pause(
      "Plusieurs onglets Mentora détectés. Ferme les doublons puis redémarre.",
    );
    return null;
  }
  if (!tab)
    tab = await chrome.tabs.create({
      url: marked(s.ordersUrl),
      active: false,
      pinned: true,
    });
  await save({ tabId: tab.id });
  await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
  return tab;
}
async function tick() {
  const s = await state();
  if (!s.enabled) return;
  const tab = await ensureTab(s);
  if (!tab) return;
  if (tab.status === "loading") return;
  if (s.nextUrl) {
    await save({ nextUrl: null });
    await chrome.tabs.update(tab.id, { url: marked(s.nextUrl) });
    return;
  }
  if (s.cycleDone) {
    await save({ cycleDone: false, visited: [] });
    await chrome.tabs.update(tab.id, { url: marked(s.ordersUrl) });
    return;
  }
  await chrome.tabs
    .sendMessage(tab.id, { type: "scan", accountKey: s.accountKey })
    .catch(async () => {
      await save({
        message: "Page en cours de chargement. Nouvel essai dans cinq minutes.",
      });
    });
}
async function start() {
  const s = await state();
  if (!/^[a-f0-9]{64}$/.test(s.token || ""))
    throw Error("Aucune clé enregistrée. Ouvre Configurer et enregistre ta clé Mentora.");
  if (
    !validUrl(s.ordersUrl) ||
    !/^\d+$/.test(s.accountKey || "")
  )
    throw Error(
      "Renseigne la clé, l’adresse des ventes et ton identifiant de profil.",
    );
  await save({
    enabled: true,
    nextUrl: null,
    cycleDone: false,
    visited: [],
    message: "Démarrage de la lecture…",
  });
  await chrome.alarms.create(ALARM, { periodInMinutes: 5 });
  await tick();
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const internal = sender.id === chrome.runtime.id &&
    [chrome.runtime.getURL("options.html"), chrome.runtime.getURL("popup.html")].includes(sender.url || "");
  locked(async () => {
    if (internal) {
      if (msg.type === "status") {
        const s = await state();
        return {
          hasToken: /^[a-f0-9]{64}$/.test(s.token || ""),
          enabled: !!s.enabled,
          message: s.message || "Non configurée",
          lastSync: s.lastSync || null,
          ordersUrl: s.ordersUrl || "",
          accountKey: s.accountKey || "",
        };
      }
      if (msg.type === "configure") {
        const existing = await state();
        const token = (msg.token || "").trim() || existing.token || "";
        if (
          !/^[a-f0-9]{64}$/.test(token) ||
          !validUrl(msg.ordersUrl) ||
          !/^\d+$/.test(msg.accountKey || "")
        )
          throw Error("Paramètres invalides.");
        await pause();
        const s = await state();
        if (s.accountKey && s.accountKey !== msg.accountKey)
          throw Error(
            "Cette installation est associée à un autre compte. Révoque la connexion et efface les paramètres avant de changer de compte.",
          );
        await save({
          token,
          ordersUrl: new URL(msg.ordersUrl).href.split("#")[0],
          accountKey: msg.accountKey,
          message: "Configuration enregistrée.",
        });
        const stored = await state();
        if (stored.token !== token) throw Error("La clé n’a pas pu être enregistrée. Réessaie.");
        return { ok: true, hasToken: true };
      }
      if (msg.type === "start") {
        await start();
        return { ok: true };
      }
      if (msg.type === "pause") {
        await pause();
        return { ok: true };
      }
      if (msg.type === "forget") {
        await pause();
        await chrome.storage.local.clear();
        return { ok: true };
      }
    }
    const s = await state();
    if (
      sender.id !== chrome.runtime.id ||
      sender.tab?.id !== s.tabId ||
      !sender.url?.startsWith("https://www.vinted.fr/") ||
      !sender.url.endsWith(MARK)
    )
      return { ignored: true };
    if (msg.type === "hello")
      return { managed: true, enabled: !!s.enabled, accountKey: s.accountKey };
    if (msg.type === "pause") {
      await pause();
      return { ok: true };
    }
    if (msg.type === "result" && s.enabled) {
      const p = msg.payload;
      if (
        !p ||
        p.accountKey !== s.accountKey ||
        !Array.isArray(p.sales) ||
        p.sales.length > 100 ||
        p.page !== sender.url.split("#")[0]
      )
        throw Error("Lecture incohérente, données non envoyées.");
      await post(s, p);
      await save({ lastSync: new Date().toISOString(), message: p.message });
      if (["login_required", "unsupported", "error"].includes(p.status)) {
        await pause(p.message);
        return { ok: true };
      }
      const visited = [...(s.visited || []), p.page];
      if (msg.nextUrl) {
        const next = new URL(msg.nextUrl);
        const root = new URL(s.ordersUrl);
        if (
          next.origin !== root.origin ||
          next.pathname !== root.pathname ||
          visited.includes(next.href) ||
          visited.length >= 500
        ) {
          await pause(
            "Pagination ambiguë ou limite atteinte. Historique partiel conservé.",
          );
          return { ok: true };
        }
        await save({ nextUrl: next.href, visited });
      } else await save({ cycleDone: true, visited: [] });
      return { ok: true };
    }
    return { ignored: true };
  })
    .then(respond)
    .catch(async (e) => {
      await save({ message: e.message });
      respond({ error: e.message });
    });
  return true;
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM)
    void locked(tick).catch((e) => save({ message: e.message }));
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.status === "complete")
    void locked(async () => {
      const s = await state();
      if (s.enabled && id === s.tabId) {
        if (!tab.url?.endsWith(MARK)) {
          await pause(
            "L’onglet dédié a été quitté. Redémarre la lecture lorsque tu es prêt.",
          );
          return;
        }
        await tick();
      }
    }).catch((e) => save({ message: e.message }));
});
async function init() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const s = await state();
  if (s.enabled) {
    await chrome.alarms.create(ALARM, { periodInMinutes: 5 });
    await tick();
  }
}
chrome.runtime.onInstalled.addListener(() => void locked(init));
chrome.runtime.onStartup.addListener(() => void locked(init));
