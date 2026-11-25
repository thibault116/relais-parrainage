import {SITE_ORIGIN} from "@/lib/site";
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
import "./public-home.css";
import "./motion.css";
import "./discovery.css";
import "./service-detail.css";
import "./chat-composer.css";
import "./ambassadors.css";
import "./wallet.css";
import "./mentor-profile.css";
import "./mobile-safe-area.css";
import { MotionProvider } from "./components/motion-system";
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
  title: "Mentora — La marketplace des resellers.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    title: "Mentora — La marketplace des resellers.",
    description:
      "Revendeurs expérimentés, communauté et guides gratuits pour progresser dans l’achat-revente.",
    type: "website",
    locale: "fr_FR",
    siteName: "Mentora",
    images: [{ url: "/mentora-logo.png", alt: "Mentora" }],
  },
  description:
    "Découvre des revendeurs expérimentés, une communauté d’entraide et quatre guides gratuits pour progresser dans l’achat-revente avec Mentora.",
};
export const viewport: Viewport = {
  themeColor: "#0b0612",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const maxDuration = 60;

export default async function Layout({
  children,member,
}: {
  children: React.ReactNode;member:React.ReactNode;
}) {
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
              <MotionProvider>
                <PwaProvider />
                <UpdateBanner />
                <CookieBanner />
                <ReleaseNotes />
                <PlatformProvider>
                  <BetaProvider>
                    <div id="workspace-route">{children}</div>
                    {member}
                    <SuggestionWidget />
                  </BetaProvider>
                </PlatformProvider>
              </MotionProvider>
            </AppearanceProvider>
          </LanguageProvider>
        </OwnerPreviewProvider>
      </body>
    </html>
  );
}
