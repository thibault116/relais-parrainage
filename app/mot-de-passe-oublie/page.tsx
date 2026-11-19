import type { Metadata } from "next";
import { PasswordRecovery } from "../components/password-recovery";
export const metadata: Metadata = { title: "Mot de passe oublié — Mentora", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <PasswordRecovery mode="request" />; }
