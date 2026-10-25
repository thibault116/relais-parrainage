import type { Metadata } from "next";
import "./globals.css";
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
        {children}
      </body>
    </html>
  );
}
