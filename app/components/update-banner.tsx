"use client";
import { useEffect, useState } from "react";
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let stopped = false;
    let pending = false;
    const controller = new AbortController();
    async function check() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (
          !stopped &&
          typeof data.version === "string" &&
          data.version !== process.env.NEXT_PUBLIC_RELAIS_VERSION
        )
          setAvailable(true);
      } catch {
        /* Retry on the next check when the connection returns. */
      } finally {
        pending = false;
      }
    }
    void check();
    const interval = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (!available) return null;
  return (
    <aside className="update-banner" role="status">
      <span>
        Une nouvelle version de Relais est disponible. Pense à enregistrer tes
        modifications, puis recharge la page.
      </span>
      <button type="button" onClick={() => window.location.reload()}>
        Recharger la page
      </button>
    </aside>
  );
}
