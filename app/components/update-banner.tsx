"use client";
import { useEffect, useRef, useState } from "react";
export function UpdateBanner() {
  const [version, setVersion] = useState("");
  const banner = useRef<HTMLElement>(null);
  useEffect(() => {
    let stopped = false,
      pending = false;
    let controller: AbortController | undefined;
    async function check() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) return;
        const d = await r.json();
        if (
          !stopped &&
          typeof d.version === "string" &&
          d.version &&
          d.version !== process.env.NEXT_PUBLIC_RELAIS_VERSION
        )
          setVersion(d.version);
      } catch {
        /* Retry on resume or next interval. */
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    }
    void check();
    const interval = setInterval(check, 30000);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  useEffect(() => {
    if (!version || !banner.current) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--update-banner-height",
        `${banner.current?.getBoundingClientRect().height || 0}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(banner.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--update-banner-height");
    };
  }, [version]);
  if (!version) return null;
  return (
    <>
      <div className="update-banner-space" aria-hidden="true" />
      <aside ref={banner} className="update-banner" role="status">
        <span>
          <strong>Une nouvelle version de Mentora est disponible.</strong>{" "}
          Enregistre tes modifications, puis recharge la page.
        </span>
        <button
          type="button"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("version", version);
            window.location.replace(url.href);
          }}
        >
          Recharger la page
        </button>
      </aside>
    </>
  );
}
