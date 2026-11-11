"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useOwnerPreview } from "./owner-preview";
import { cookieChoiceEvent, preferenceKeys, readCookieChoice } from "@/lib/cookie-preferences";
import english from "@/lib/en.json";
export type Language = "fr" | "en";
let activeLanguage: Language = "fr";
// Only interface strings from our catalogue are translated. Unknown text is unchanged.
export function t<T>(value: T): T {
  if (activeLanguage !== "en" || typeof value !== "string") return value;
  const normal = value.replace(/\s+/g, " ").trim();
  const result = (english as Record<string, string>)[normal];
  if (!result) return value;
  return (value.match(/^\s*/)?.[0] + result + value.match(/\s*$/)?.[0]) as T;
}
export function locale() {
  return activeLanguage === "en" ? "en-GB" : "fr-FR";
}
const LanguageContext = createContext({
  language: "fr" as Language,
  changeLanguage: (_value: Language) => {},
});
export const useLanguage = () => useContext(LanguageContext);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const restricted = useOwnerPreview();
  const [language, setLanguage] = useState<Language>("fr");
  useEffect(() => {
    const restore = () => {
      try {
        if (restricted && !readCookieChoice()?.language) return;
        const saved = localStorage.getItem(preferenceKeys.language);
        if (saved !== "fr" && saved !== "en") return;
        activeLanguage = saved;
        document.documentElement.lang = saved;
        setLanguage(saved);
      } catch {}
    };
    restore();
    window.addEventListener(cookieChoiceEvent, restore);
    return () => window.removeEventListener(cookieChoiceEvent, restore);
  }, [restricted]);
  function changeLanguage(next: Language) {
    activeLanguage = next;
    document.documentElement.lang = next;
    try {
      if (!restricted || readCookieChoice()?.language) localStorage.setItem(preferenceKeys.language, next);
    } catch {}
    setLanguage(next);
  }
  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      <LanguageTree key={language}>{children}</LanguageTree>
    </LanguageContext.Provider>
  );
}
function LanguageTree({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
