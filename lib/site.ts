/** Canonical public links shared by the app, guides, emails and Discord. */
export const SITE_ORIGIN = "https://www.mentora-resell.app";
export const SITE_HOST = "www.mentora-resell.app";
export const LEGACY_SITE_ORIGINS = [
  "https://mentora-resell.vercel.app",
  "https://relais-parrainage.vercel.app",
] as const;
export function updateSiteLinks(text: string) {
  return text
    .replace(/https?:\/\/(?:mentora-resell\.vercel\.app|relais-parrainage\.vercel\.app)(?![\w-]|\.[\w-])/gi, SITE_ORIGIN)
    .replace(/(?<![\w@./-])(?:mentora-resell\.vercel\.app|relais-parrainage\.vercel\.app)(?![\w-]|\.[\w-])/gi, SITE_HOST);
}
export function updateLinkValues<T>(value: T): T {
  if (typeof value === "string") return updateSiteLinks(value) as T;
  if (Array.isArray(value)) return value.map(updateLinkValues) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, updateLinkValues(v)])) as T;
  return value;
}
