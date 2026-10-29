"use client";
import { useState, useEffect, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { AppearanceSettings } from "./appearance";
import { VerificationForm } from "./verification";
import { PushSettings } from "./push-settings";
import { InstallMentora } from "./pwa";
import { EmailPreferences } from "./emails";
import { useLanguage, t } from "./language";
export function MemberSettings({
  initialSection = "general",
  mentor = false,
  onVerificationChange,
}: {
  initialSection?: string;
  mentor?: boolean;
  onVerificationChange: () => Promise<void>;
}) {
  const { language, changeLanguage } = useLanguage();
  const [section, setSection] = useState(initialSection);
  useEffect(() => setSection(initialSection), [initialSection]);
  return (
    <div className="member-settings">
      <nav
        className="settings-sections"
        aria-label={t("Sections des paramètres")}
      >
        {[
          ["general", "Général"],
          ["security", "Sécurité"],
          ["notifications", "Notifications"],
          ...(mentor ? [["verification", "Vérification du compte"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={section === id ? "selected" : ""}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {section === "general" && (
        <>
          <section className="verification-panel">
            <h2>{t("Langue du site")}</h2>
            <label>
              {t("Langue d’affichage")}
              <select
                value={language}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("profileTab", "appearance");
                  url.hash = "profile";
                  window.history.replaceState(null, "", url);
                  changeLanguage(e.target.value === "en" ? "en" : "fr");
                }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <p className="small-text">
              {t(
                "Ce choix est conservé sur cet appareil. Les messages des membres restent dans leur langue d’origine.",
              )}
            </p>
          </section>
          <AppearanceSettings />
          <InstallMentora />
        </>
      )}
      {section === "security" && <PasswordSettings />}
      {section === "notifications" && (
        <>
          <PushSettings />
          <EmailPreferences />
        </>
      )}
      {section === "verification" &&
        (mentor ? (
          <VerificationForm onChange={onVerificationChange} />
        ) : (
          <section className="verification-panel">
            <h2>{t("Vérification du compte")}</h2>
            <p>
              {t("La vérification concerne uniquement les comptes parrains.")}
            </p>
          </section>
        ))}
    </div>
  );
}
function PasswordSettings() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || ""),
      newPassword = String(data.get("newPassword") || "");
    setError("");
    setSuccess("");
    if (newPassword !== data.get("confirmPassword")) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choisis un mot de passe différent de l’ancien.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.changePassword(
        {
          currentPassword,
          newPassword,
          revokeOtherSessions: data.get("revoke") === "on",
        },
        { signal: AbortSignal.timeout(20000) },
      );
      if (result.error) {
        setError(
          result.error.code === "INVALID_PASSWORD"
            ? "Le mot de passe actuel est incorrect."
            : result.error.status === 429
              ? "Trop de tentatives. Patiente une minute avant de réessayer."
              : result.error.status === 401
                ? "Reconnecte-toi pour modifier ton mot de passe."
                : "Le changement a échoué. Vérifie ton mot de passe actuel et réessaie.",
        );
      } else {
        form.reset();
        setSuccess("Ton mot de passe a été modifié.");
      }
    } catch {
      setError("Connexion impossible. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-panel">
      <h2>{t("Changer mon mot de passe")}</h2>
      <p>{t("Utilise un mot de passe unique de 12 à 128 caractères.")}</p>
      <form onSubmit={submit} className="password-settings">
        <label>
          {t("Mot de passe actuel")}
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            disabled={busy}
          />
        </label>
        <label>
          {t("Nouveau mot de passe")}
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            disabled={busy}
          />
        </label>
        <label>
          {t("Confirmer le nouveau mot de passe")}
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            disabled={busy}
          />
        </label>
        <label className="email-choice">
          <input name="revoke" type="checkbox" defaultChecked disabled={busy} />
          {t("Déconnecter mes autres appareils")}
        </label>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {success && <p role="status">{t(success)}</p>}
        <button className="btn" disabled={busy}>
          {t(busy ? "Modification…" : "Modifier mon mot de passe")}
        </button>
      </form>
    </section>
  );
}
