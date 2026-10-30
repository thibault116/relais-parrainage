/* Conservative visible-DOM adapter. No private API, cookies, hidden application state or guessed dates. */
(() => {
  const text = (e) =>
    (e?.innerText || e?.textContent || "").replace(/\s+/g, " ").trim();
  function parseAmount(value) {
    const m = value.match(/^(\d[\d\s\u00a0\u202f]*)(?:[,.](\d{2}))?\s*€$/);
    return m ? Number(m[1].replace(/\D/g, "")) * 100 + Number(m[2] || 0) : null;
  }
  function parseDate(value) {
    let m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!m) {
      const f = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
      if (f) m = [f[0], f[3], f[2].padStart(2, "0"), f[1].padStart(2, "0")];
    }
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(iso + "T12:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === iso ? iso : null;
  }
  function read(doc, accountKey, page) {
    const result = {
      accountKey,
      sales: [],
      status: "unsupported",
      message:
        "La présentation des commandes n’est pas reconnue. Aucune estimation n’a été importée.",
      page,
    };
    const body = text(doc.body);
    if (
      /captcha|vérifie que tu es|confirme que tu es|verify you are|access denied|trop de requêtes/i.test(
        body,
      )
    ) {
      result.status = "login_required";
      result.message =
        "Vinted demande une intervention. Lecture arrêtée : ouvre Vinted toi-même.";
      return { payload: result };
    }
    // Profile links can live in a portalled account menu, outside <header>.
    const ownLinks = [...doc.querySelectorAll('a[href*="/member/"]')]
      .filter((a) => a.closest('header,[role="banner"],nav,[role="menu"],[data-testid*="user-menu"],[data-testid*="account-menu"],[data-testid*="header"]') ||
        /^(mon profil|voir mon profil|my profile|view my profile)$/i.test(text(a) || a.getAttribute("aria-label") || ""))
      .map((a) => {
        try {
          const url = new URL(a.href, page);
          return url.origin === "https://www.vinted.fr" ? url.pathname.match(/^\/member\/(\d+)(?:[-/]|$)/)?.[1] : null;
        } catch { return null; }
      }).filter(Boolean);
    if (!ownLinks.length) {
      result.message = "Ouvre le menu de ton avatar Vinted dans l’onglet Mentora pour afficher le lien Mon profil, puis clique sur Réessayer dans cet onglet. Aucun compte ni vente n’a encore été importé.";
      return { payload: result, retryable: true, reason: "account_missing" };
    }
    if (new Set(ownLinks).size !== 1 || ownLinks[0] !== accountKey) {
      result.message = "Le profil affiché ne correspond pas au numéro configuré, ou plusieurs profils sont présents dans le menu. Vérifie le numéro dans l’adresse de ton propre profil (/member/123456-pseudo). Aucune vente importée.";
      return { payload: result, reason: "account_mismatch" };
    }
    const activeLabels = [...doc.querySelectorAll('[role="tab"][aria-selected="true"],a[aria-current="page"],button[aria-pressed="true"],select option:checked')].map(text);
    const headings = [...doc.querySelectorAll("main h1,main h2")].map(text);
    if (!activeLabels.some(label => /^(mes ventes|ventes|vendus|selling|sold)(?:\s*\(\d+\))?$/i.test(label)) &&
        !headings.some(label => /^(mes ventes|commandes vendues|ventes)$/i.test(label))) {
      result.message = "Sélectionne Ventes dans Commandes, puis clique sur Réessayer. La lecture des achats est exclue.";
      return { payload: result, retryable: true, reason: "sales_filter_missing" };
    }
    const links = [
      ...doc.querySelectorAll(
        'main a[href*="/orders/"],main a[href*="/transactions/"]',
      ),
    ];
    const seen = new Set();
    let skipped = 0;
    for (const link of links) {
      const url = new URL(link.href, page),
        id = url.pathname.match(
          /^\/(?:orders|transactions)\/(\d+)(?:\/|$)/,
        )?.[1];
      if (url.origin !== "https://www.vinted.fr" || !id || seen.has(id))
        continue;
      seen.add(id);
      const row =
        link.closest(
          'article,li,[data-testid="order-card"],[data-testid="transaction-card"]',
        ) || link;
      const item = row.querySelector('a[href*="/items/"]');
      const img = row.querySelector("img");
      const title =
        text(row.querySelector('[data-testid="item-title"],h2,h3')) ||
        text(item) ||
        img?.alt?.trim();
      const amountNode = row.querySelector(
        '[data-testid="item-price"],[data-testid="order-item-price"]',
      );
      // No fallback to "total": it can contain shipping and buyer fees.
      const amount = parseAmount(text(amountNode));
      const content = text(row);
      const status = /rembours[ée]|refunded/i.test(content)
        ? "refunded"
        : /annul[ée]|cancelled/i.test(content)
          ? "cancelled"
          : /vente terminée|transaction terminée|commande terminée|completed/i.test(
                content,
              )
            ? "completed"
            : /en cours|expédi[ée]|en transit|à envoyer|pending/i.test(content)
              ? "pending"
              : null;
      if (!title || amount === null || !status) {
        skipped++;
        continue;
      }
      let photoUrl = img?.currentSrc || img?.src || "";
      try {
        const p = new URL(photoUrl);
        if (
          p.protocol !== "https:" ||
          !(p.hostname === "vinted.net" || p.hostname.endsWith(".vinted.net"))
        )
          photoUrl = "";
      } catch {
        photoUrl = "";
      }
      const dateNode = row.querySelector('[data-testid="sold-date"]');
      result.sales.push({
        orderId: id,
        title: title.slice(0, 500),
        photoUrl,
        orderUrl: url.origin + url.pathname,
        amountCents: amount,
        currency: "EUR",
        status,
        soldOn: parseDate(dateNode?.getAttribute("datetime") || text(dateNode)),
      });
    }
    if (!seen.size || skipped || result.sales.length > 100) {
      result.sales = [];
      result.message =
        "Certaines commandes, leur prix article ou leur statut ne sont pas identifiables. Adaptation du lecteur nécessaire ; aucun chiffre incertain envoyé.";
      return { payload: result };
    }
    const next = doc.querySelector(
      'a[rel="next"],a[aria-label="Page suivante"],a[aria-label="Next page"]',
    );
    const nextUrl =
      next && next.getAttribute("aria-disabled") !== "true"
        ? new URL(next.href, page).href
        : null;
    result.status = nextUrl ? "syncing" : "complete";
    result.message = `${result.sales.length} commande(s) lue(s) sur cette page. ${nextUrl ? "Page suivante au prochain passage." : "Fin des liens de pagination visibles ; historique complet non garanti."}`;
    return { payload: result, nextUrl };
  }
  globalThis.MentoraReader = { read, parseDate, parseAmount };
})();
