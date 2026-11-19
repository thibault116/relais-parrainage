import type { Metadata } from "next";
import { PasswordRecovery } from "../components/password-recovery";
export const metadata: Metadata = { title: "Nouveau mot de passe — Mentora", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ searchParams }: { searchParams: Promise<{token?: string | string[]; error?: string | string[]}> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" && /^[a-zA-Z0-9_-]{20,200}$/.test(params.token) ? params.token : "";
  return <PasswordRecovery mode="reset" token={token} invalid={!!params.error} />;
}
