"use client";
import { t as translateUi } from "@/app/components/language";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { defaultSettings, publicSettings } from "@/lib/platform-config";
const SettingsContext = createContext(publicSettings(defaultSettings));
export const usePlatformSettings = () => useContext(SettingsContext);
export function PlatformProvider({ children }: { children: ReactNode }) {
  const announcement = useRef<HTMLElement>(null);
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
  useEffect(() => {
    const update = () =>
      document.documentElement.style.setProperty(
        "--announcement-height",
        `${announcement.current?.getBoundingClientRect().height || 0}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    if (announcement.current) observer.observe(announcement.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--announcement-height");
    };
  }, [settings.announcementEnabled, settings.announcement]);
  return (
    <SettingsContext.Provider value={settings}>
      {settings.announcementEnabled && settings.announcement && (
        <aside
          ref={announcement}
          className="platform-announcement"
          aria-label={translateUi("Annonce Mentora")}
        >
          {settings.announcement}
        </aside>
      )}
      {translateUi(children)}
    </SettingsContext.Provider>
  );
}
