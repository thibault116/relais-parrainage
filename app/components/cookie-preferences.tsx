"use client";

import { useOwnerPreview } from "./owner-preview";
import { useEffect, useState } from "react";
import {
  allPreferences,
  necessaryOnly,
  openCookieSettingsEvent,
  readCookieChoice,
  saveCookieChoice,
  type Preferences,
} from "@/lib/cookie-preferences";

export function CookieSettingsButton() {
  return (
    <button type="button" className="cookie-settings-link" onClick={() => {
      window.dispatchEvent(new Event(openCookieSettingsEvent));
    }}>
      Gérer mes cookies
    </button>
  );
}

export function CookieBanner() {
  const enabled = useOwnerPreview();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choices, setChoices] = useState<Preferences>(necessaryOnly);
  useEffect(() => {
    if (!enabled) return;
    if (!readCookieChoice()) setOpen(true);
    const manage = () => {
      setChoices(readCookieChoice() || necessaryOnly);
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(openCookieSettingsEvent, manage);
    return () => window.removeEventListener(openCookieSettingsEvent, manage);
  }, [enabled]);

  function choose(value: Preferences) {
    saveCookieChoice(value);
    setOpen(false);
    setCustom(false);
  }

  if (!enabled || !open) return null;
  return (
    <section className="cookie-banner" role="region" aria-labelledby="cookie-banner-title">
      <h2 id="cookie-banner-title">Tes choix de cookies</h2>
      <p>Les traceurs essentiels permettent à Mentora de fonctionner. Tu peux choisir si ton navigateur mémorise ton apparence et ta langue. <a href="/juridique/cookies">En savoir plus</a>.</p>
      {custom && (
        <fieldset>
          <legend>Préférences facultatives</legend>
          <label className="legal-check">
            <input type="checkbox" checked={choices.appearance}
              onChange={(event) => setChoices({ ...choices, appearance: event.target.checked })} />
            Mémoriser mon apparence
          </label>
          <label className="legal-check">
            <input type="checkbox" checked={choices.language}
              onChange={(event) => setChoices({ ...choices, language: event.target.checked })} />
            Mémoriser ma langue
          </label>
        </fieldset>
      )}
      <div className="cookie-actions">
        <button type="button" className="btn secondary" onClick={() => choose(necessaryOnly)}>Tout refuser</button>
        <button type="button" className="btn secondary" onClick={() => choose(allPreferences)}>Tout accepter</button>
        {custom ? (
          <button type="button" className="btn" onClick={() => choose(choices)}>Enregistrer mes choix</button>
        ) : (
          <button type="button" className="btn secondary" onClick={() => {
            setChoices(readCookieChoice() || necessaryOnly);
            setCustom(true);
          }}>Personnaliser</button>
        )}
      </div>
    </section>
  );
}
