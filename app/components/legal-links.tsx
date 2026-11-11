"use client";

import { useOwnerPreview } from "./owner-preview";
import { CookieSettingsButton } from "./cookie-preferences";
import { legalPages } from "@/lib/legal-versions";

export function LegalLinks({ short = false }: { short?: boolean }) {
  const enabled = useOwnerPreview();
  if (!enabled) return null;
  return (
    <nav className="legal-links" aria-label="Informations légales">
      {(short ? legalPages.filter(([slug]) => ["cgu", "confidentialite", "communaute"].includes(slug)) : legalPages)
        .map(([slug, label]) => <a key={slug} href={`/juridique/${slug}`}>{label}</a>)}
      <CookieSettingsButton />
    </nav>
  );
}
