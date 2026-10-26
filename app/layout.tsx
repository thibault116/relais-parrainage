import { PlatformProvider } from "./components/platform-settings";
import type { Metadata } from "next";
import "./globals.css";
import { SuggestionWidget } from "./components/suggestions";
import { UpdateBanner } from "./components/update-banner";
export const metadata: Metadata = {
  title: "Mentora — L’entraide entre revendeurs.",
  description:
    "Progresse dans l’achat-revente de vêtements (resell) sur Vinted, Leboncoin, eBay ou Whatnot. Mentora relie revendeurs débutants et expérimentés.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <UpdateBanner />
        <PlatformProvider>
          {children}
          <SuggestionWidget />
        </PlatformProvider>
      </body>
    </html>
  );
}
