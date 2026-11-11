import { after } from "next/server";
import { automaticProductionCheck } from "@/lib/changelog/service";
import { ownerPreviewUserId } from "@/lib/owner-preview";
import { OwnerPreviewProvider } from "./components/owner-preview";
import { CookieBanner } from "./components/cookie-preferences";
import { cookieChoiceKey, preferenceKeys } from "@/lib/cookie-preferences";
import { BetaProvider } from "./components/beta";
import "./community.css";
import { LanguageProvider } from "./components/language";
import { AppearanceProvider } from "./components/appearance";
import { PlatformProvider } from "./components/platform-settings";
import { PwaProvider } from "./components/pwa";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-refinements.css";
import "./mobile-app.css";
import "./refonte-kit.css";
import "./brand-violet.css";
import "./workspace-desktop.css";
import "./legal.css";
import { SuggestionWidget } from "./components/suggestions";
import { ReleaseNotes } from "./components/release-notes";
import { UpdateBanner } from "./components/update-banner";
export const metadata: Metadata = {
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  applicationName: "Mentora",
  appleWebApp: {
    capable: true,
    title: "Mentora",
    statusBarStyle: "black-translucent",
  },
  title: "Mentora — L’entraide entre revendeurs.",
  description:
    "Progresse dans l’achat-revente de vêtements (resell) sur Vinted, Leboncoin, eBay ou Whatnot. Mentora relie revendeurs débutants et expérimentés.",
};
export const viewport: Viewport = {
  themeColor: "#0b0612",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const maxDuration = 60;

export default async function Layout({ children }: { children: React.ReactNode }) {
  const initialUserId = await ownerPreviewUserId();
  if (process.env.VERCEL_ENV === "production") after(automaticProductionCheck);
  const ownerPreview = initialUserId !== null;
  return (
    <html lang="fr" data-theme="dark" data-neon="true" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem("${cookieChoiceKey}")||"null");var a=(!${ownerPreview}||c?.version===1&&c.expiresAt>Date.now()&&c.appearance===true)?JSON.parse(localStorage.getItem("${preferenceKeys.appearance}")||"{}"):{};document.documentElement.dataset.reduceMotion=String(a?.reduceMotion===true);document.documentElement.dataset.theme=a?.dark!==false?"dark":"light";document.documentElement.dataset.neon=a?.neon!==false?"true":"false";}catch(e){}`,
          }}
        />
      </head>
      <body>
        <OwnerPreviewProvider initialUserId={initialUserId}>
        <LanguageProvider>
          <AppearanceProvider>
            <PwaProvider />
            <UpdateBanner />
            <CookieBanner />
            <ReleaseNotes />
            <PlatformProvider>
              <BetaProvider>
              {children}
              <SuggestionWidget />
            </BetaProvider>
            </PlatformProvider>
          </AppearanceProvider>
        </LanguageProvider>
        </OwnerPreviewProvider>
      </body>
    </html>
  );
}
