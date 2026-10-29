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
    const ownLinks = [
      ...doc.querySelectorAll(
        'header a[href*="/member/"],nav[aria-label] a[href*="/member/"]',
      ),
    ]
      .map((a) => new URL(a.href, page).pathname.match(/^\/member\/(\d+)/)?.[1])
      .filter(Boolean);
    if (!ownLinks.includes(accountKey) || new Set(ownLinks).size !== 1) {
      result.message =
        "Le compte connecté ne peut pas être confirmé dans l’en-tête Vinted. Lecture arrêtée pour éviter de mélanger des comptes.";
      return { payload: result };
    }
    const active = text(
      doc.querySelector(
        '[role="tab"][aria-selected="true"],a[aria-current="page"],button[aria-pressed="true"]',
      ),
    );
    const heading = text(doc.querySelector("main h1"));
    if (
      !/^(mes ventes|ventes|vendus|selling|sold)$/i.test(active) &&
      !/^(mes ventes|commandes vendues|ventes)$/i.test(heading)
    ) {
      result.message =
        "Impossible de confirmer que la page affiche les ventes et non les achats. Ouvre le filtre Ventes.";
      return { payload: result };
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
