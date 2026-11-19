"use client";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "./brand-logo";
import "../password-recovery.css";

export function PasswordRecovery({ mode, token = "", invalid = false }: {
  mode: "request" | "reset"; token?: string; invalid?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(invalid || (mode === "reset" && !token));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setError("");
    if (mode === "reset" && form.get("password") !== form.get("confirmation")) {
      setError("Les deux mots de passe doivent être identiques."); return;
    }
    setBusy(true);
    try {
      const result = mode === "request"
        ? await authClient.requestPasswordReset({
            email: String(form.get("email")).trim(),
            redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
          })
        : await authClient.resetPassword({ newPassword: String(form.get("password")), token });
      if (result.error) {
        if (mode === "reset" && result.error.code === "INVALID_TOKEN") setExpired(true);
        setError(result.error.status === 429
          ? "Trop de tentatives. Patiente une minute avant de réessayer."
          : mode === "request" ? "L’envoi est momentanément indisponible. Réessaie dans un instant."
          : "Impossible de modifier le mot de passe. Vérifie qu’il contient au moins 12 caractères ou demande un nouveau lien.");
        return;
      }
      setDone(true);
      if (mode === "reset") window.history.replaceState({}, "", "/nouveau-mot-de-passe");
    } catch { setError("Connexion impossible. Vérifie ta connexion et réessaie."); }
    finally { setBusy(false); }
  }
  return <main className="password-recovery">
    <a href="/" aria-label="Mentora, accueil" className="password-recovery-brand"><BrandLogo /><span>Mentora</span></a>
    <section className="password-recovery-card" aria-labelledby="recovery-title">
      <span className="password-recovery-icon" aria-hidden="true">{done ? <CheckCircle2 /> : mode === "request" ? <Mail /> : <KeyRound />}</span>
      <h1 id="recovery-title">{done ? mode === "request" ? "Vérifie tes e-mails" : "Mot de passe modifié" : expired ? "Ce lien n’est plus valide" : mode === "request" ? "Mot de passe oublié ?" : "Ton nouveau mot de passe"}</h1>
      {done ? <>
        <p role="status">{mode === "request"
          ? "Si un compte correspond à cette adresse, tu recevras un lien de Mentora pour choisir un nouveau mot de passe. Pense à vérifier tes courriers indésirables."
          : "Ton nouveau mot de passe est enregistré. Reconnecte-toi pour retrouver Mentora."}</p>
        <a className="btn full" href="/?connexion=1">Revenir à la connexion</a>
      </> : expired ? <>
        <p>Le lien a expiré ou a déjà été utilisé. Demande un nouvel e-mail pour recommencer.</p>
        <a className="btn full" href="/mot-de-passe-oublie">Recevoir un nouveau lien</a>
      </> : <>
        <p>{mode === "request" ? "Indique l’adresse e-mail de ton compte. Nous t’enverrons un lien valable 30 minutes." : "Choisis un mot de passe d’au moins 12 caractères."}</p>
        <form onSubmit={submit}>
          {mode === "request" ? <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} autoFocus /></label> : <>
            <label>Nouveau mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} autoFocus /></label>
            <label>Confirmer le mot de passe<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          </>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> En cours…</> : mode === "request" ? "Recevoir le lien par e-mail" : "Enregistrer mon mot de passe"}</button>
        </form>
      </>}
      {!done && <a className="password-recovery-back" href="/?connexion=1"><ArrowLeft size={16} /> Retour à la connexion</a>}
    </section>
  </main>;
}
