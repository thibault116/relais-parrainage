import { LanguageProvider } from "./components/language";
import { AppearanceProvider } from "./components/appearance";
import { PlatformProvider } from "./components/platform-settings";
import { PwaProvider } from "./components/pwa";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-refinements.css";
import { SuggestionWidget } from "./components/suggestions";
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
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" data-neon="true" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=JSON.parse(localStorage.getItem("mentora-appearance")||"{}");document.documentElement.dataset.reduceMotion=String(a?.reduceMotion===true);document.documentElement.dataset.theme=a?.dark!==false?"dark":"light";document.documentElement.dataset.neon=a?.neon!==false?"true":"false";}catch(e){}`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <AppearanceProvider>
            <PwaProvider />
            <UpdateBanner />
            <PlatformProvider>
              {children}
              <SuggestionWidget />
            </PlatformProvider>
          </AppearanceProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
