"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
  const [language, setLanguage] = useState<Language>("fr");
  useEffect(() => {
    let saved: Language = "fr";
    try {
      if (localStorage.getItem("mentora-language") === "en") saved = "en";
    } catch {}
    activeLanguage = saved;
    document.documentElement.lang = saved;
    setLanguage(saved);
  }, []);
  function changeLanguage(next: Language) {
    activeLanguage = next;
    document.documentElement.lang = next;
    try {
      localStorage.setItem("mentora-language", next);
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
