import { LanguageProvider } from "./components/language";
import { AppearanceProvider } from "./components/appearance";
import { PlatformProvider } from "./components/platform-settings";
import type { Metadata } from "next";
import "./globals.css";
import { SuggestionWidget } from "./components/suggestions";
import { UpdateBanner } from "./components/update-banner";
export const metadata: Metadata = {
  icons: { icon: "/mentora-logo.png", apple: "/mentora-logo.png" },
  title: "Mentora — L’entraide entre revendeurs.",
  description:
    "Progresse dans l’achat-revente de vêtements (resell) sur Vinted, Leboncoin, eBay ou Whatnot. Mentora relie revendeurs débutants et expérimentés.",
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
