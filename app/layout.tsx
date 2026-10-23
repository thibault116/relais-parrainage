import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Relais — On avance mieux ensemble.",
  description:
    "Trouve ton parrain en achat-revente de vêtements. Une communauté d’entraide, des réponses sur Discord, et un réseau qui grandit avec toi.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
