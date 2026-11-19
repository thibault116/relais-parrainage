import type { Metadata } from "next";
import { IntakeJourney } from "../components/intake-journey";
import { IntakeEntry } from "../components/intake-entry";
export const metadata: Metadata = {
  title: "Ton parcours — Mentora",
  description:
    "Quelques questions pour personnaliser ton profil Mentora, puis crée ton compte.",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  if (role !== "beginner" && role !== "mentor") return <IntakeEntry />;
  return (
    <IntakeJourney
      role={role === "mentor" ? "mentor" : "beginner"}
      registration
    />
  );
}
