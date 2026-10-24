import type { Metadata } from "next";
import "./globals.css";
import { UpdateBanner } from "./components/update-banner";
export const metadata: Metadata = {
  title: "Mentora — On avance mieux ensemble.",
  description:
    "Trouve ton parrain en achat-revente de vêtements. Une communauté d’entraide, des réponses sur Discord, et un réseau qui grandit avec toi.",
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
