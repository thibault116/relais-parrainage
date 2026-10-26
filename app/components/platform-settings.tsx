"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { defaultSettings, publicSettings } from "@/lib/platform-config";
const SettingsContext = createContext(publicSettings(defaultSettings));
export const usePlatformSettings = () => useContext(SettingsContext);
export function PlatformProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(publicSettings(defaultSettings));
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/settings", { cache: "no-store" })
        .then(async (r) => {
          if (r.ok && alive) setSettings(await r.json());
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("mentora-settings", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("mentora-settings", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return (
    <SettingsContext.Provider value={settings}>
      {settings.announcementEnabled && settings.announcement && (
        <aside className="platform-announcement" aria-label="Annonce Mentora">
          {settings.announcement}
        </aside>
      )}
      {children}
    </SettingsContext.Provider>
  );
}
