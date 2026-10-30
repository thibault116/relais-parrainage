(() => {
  let managed = false,
    enabled = false,
    busy = false,
    currentAccount = "",
    lastProblem = "";
  const send = (message) => chrome.runtime.sendMessage(message);
  function banner() {
    document.getElementById("mentora-reading-notice")?.remove();
    if (!managed || (!enabled && !lastProblem) || document.visibilityState !== "visible") return;
    const host = document.createElement("div");
    host.id = "mentora-reading-notice";
    Object.assign(host.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "2147483647",
      maxWidth: "min(410px, calc(100vw - 32px))",
    });
    const root = host.attachShadow({ mode: "closed" });
    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#160d24;color:white;padding:20px;border:2px solid #a855f7;border-radius:16px;font:15px/1.5 system-ui;box-shadow:0 8px 35px #0006";
    const title = document.createElement("strong");
    title.textContent = "Onglet réservé à Mentora";
    const p = document.createElement("p");
    p.textContent =
      "Mentora lit les ventes de ce compte sur cet onglet. Merci de ne pas le modifier pendant la synchronisation. Tu peux naviguer dans Vinted dans un autre onglet.";
    const button = document.createElement("button");
    button.textContent = "Mettre en pause et reprendre la main";
    button.style.cssText =
      "padding:12px;background:#a855f7;color:white;border:0;border-radius:8px;cursor:pointer;font:inherit";
    button.onclick = async () => {
      await send({ type: "pause" });
      enabled = false;
      banner();
    };
    panel.append(title, p);
    if (lastProblem) {
      const problem = document.createElement("p");
      problem.textContent = lastProblem;
      const retry = document.createElement("button");
      retry.textContent = "Réessayer la lecture";
      retry.style.cssText = button.style.cssText;
      retry.onclick = async () => {
        const response = await send({ type: "retry" });
        if (response?.ok) { enabled = true; lastProblem = ""; banner(); void scan(currentAccount); }
      };
      panel.append(problem, retry);
    }
    panel.append(button);
    root.append(panel);
    document.documentElement.append(host);
  }
  async function scan(accountKey) {
    if (busy || !enabled) return;
    busy = true;
    try {
      currentAccount = accountKey;
      let result;
      // Retry only while the document is still missing its identity/filter.
      // No repeated network requests, menu clicks or hidden account-state reads.
      for (let attempt = 0; attempt < 12; attempt++) {
        if (!enabled) return;
        result = globalThis.MentoraReader.read(document, accountKey, location.href.split("#")[0]);
        if (!result.retryable) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!enabled || !result) return;
      lastProblem = result.payload.status === "unsupported" ? result.payload.message : "";
      banner();
      const response = await send({ type: "result", ...result });
      if (response?.error)
        console.warn(
          "Mentora : synchronisation non terminée. Consulte le statut dans l’extension.",
        );
    } catch {
      lastProblem = "La lecture a été interrompue. Recharge l’extension puis clique sur Démarrer / reprendre.";
      banner();
    } finally {
      busy = false;
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "paused") {
      enabled = false;
      banner();
      respond({ ok: true });
    }
    if (message.type === "scan") {
      send({ type: "hello" }).then((s) => {
        managed = !!s?.managed;
        enabled = !!s?.enabled;
        banner();
        if (managed) void scan(message.accountKey);
      });
      respond({ ok: true });
    }
  });
  document.addEventListener("visibilitychange", banner);
  send({ type: "hello" }).then((s) => {
    managed = !!s?.managed;
    enabled = !!s?.enabled;
    banner();
  });
})();
