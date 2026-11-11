export const cookieChoiceKey = "mentora-cookie-preferences";
export const cookieChoiceEvent = "mentora-cookie-choice";
export const openCookieSettingsEvent = "mentora-open-cookie-settings";
export const choiceLifetime = 180 * 86400000;
export const preferenceKeys = {
  appearance: "mentora-appearance",
  language: "mentora-language",
};
export type Preferences = Record<keyof typeof preferenceKeys, boolean>;
export const necessaryOnly: Preferences = { appearance: false, language: false };
export const allPreferences: Preferences = { appearance: true, language: true };
type Choice = Preferences & { version: 1; expiresAt: number };
let temporaryChoice: Choice | null = null;

export function readCookieChoice(): Choice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(cookieChoiceKey) || "null");
    if (value?.version === 1 && value.expiresAt > Date.now() &&
      typeof value.appearance === "boolean" && typeof value.language === "boolean")
      return value;
  } catch {}
  return temporaryChoice && temporaryChoice.expiresAt > Date.now() ? temporaryChoice : null;
}

export function saveCookieChoice(preferences: Preferences) {
  const value: Choice = { ...preferences, version: 1, expiresAt: Date.now() + choiceLifetime };
  try {
    localStorage.setItem(cookieChoiceKey, JSON.stringify(value));
    temporaryChoice = null;
    for (const key of Object.keys(preferenceKeys) as (keyof Preferences)[]) {
      if (!preferences[key]) localStorage.removeItem(preferenceKeys[key]);
    }
  } catch {
    temporaryChoice = value;
  }
  window.dispatchEvent(new Event(cookieChoiceEvent));
}
