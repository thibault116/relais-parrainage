"use client";
import { t as translateUi } from "@/app/components/language";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Sun, Moon, Sparkles } from "lucide-react";
type Appearance = {
  dark: boolean;
  neon: boolean;
  reduceMotion: boolean;
};
const defaults: Appearance = { dark: true, neon: true, reduceMotion: false };
const AppearanceContext = createContext({
  appearance: defaults,
  change: (_next: Appearance) => {},
});
const key = "mentora-appearance";
function read(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      dark: v?.dark !== false,
      neon: v?.neon !== false,
      reduceMotion: v?.reduceMotion === true,
    };
  } catch {
    return defaults;
  }
}
function apply(v: Appearance) {
  document.documentElement.dataset.reduceMotion = String(v.reduceMotion);
  document.documentElement.dataset.theme = v.dark ? "dark" : "light";
  document.documentElement.dataset.neon = v.neon ? "true" : "false";
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(defaults);
  useEffect(() => {
    const sync = () => {
      const value = read();
      setAppearance(value);
      apply(value);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function change(v: Appearance) {
    setAppearance(v);
    apply(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* Appearance still works when storage is unavailable. */
    }
  }
  return (
    <AppearanceContext.Provider value={{ appearance, change }}>
      {translateUi(children)}
    </AppearanceContext.Provider>
  );
}
export function AppearanceSettings() {
  const { appearance, change } = useContext(AppearanceContext);
  return (
    <section className="verification-panel appearance-settings">
      <span className="eyebrow">{translateUi("\u00C0 TON GO\u00DBT")}</span>
      <h2>{translateUi("Apparence de Mentora")}</h2>
      <p>
        {translateUi(
          "Choisis ton ambiance. Les changements s\u2019appliquent imm\u00E9diatement sur tout le site.",
        )}
      </p>
      <div
        className="appearance-options"
        role="group"
        aria-label={translateUi("Mode d’affichage")}
      >
        <button
          className={!appearance.dark ? "selected" : ""}
          aria-pressed={!appearance.dark}
          onClick={() => change({ ...appearance, dark: false })}
        >
          <Sun size={26} />
          <strong>{translateUi("Mode clair")}</strong>
          <span>{translateUi("Blanc et violet")}</span>
        </button>
        <button
          className={appearance.dark ? "selected" : ""}
          aria-pressed={appearance.dark}
          onClick={() => change({ ...appearance, dark: true })}
        >
          <Moon size={26} />
          <strong>{translateUi("Mode sombre")}</strong>
          <span>{translateUi("Noir, violet et textes clairs")}</span>
        </button>
      </div>
      <label className="appearance-neon">
        <input
          type="checkbox"
          checked={appearance.neon}
          onChange={(e) => change({ ...appearance, neon: e.target.checked })}
        />
        <Sparkles size={23} />
        <span>
          <strong>{translateUi("Violet n\u00E9on")}</strong>
          <small>
            {translateUi(
              "Des accents violets plus lumineux, avec une l\u00E9g\u00E8re lueur.",
            )}
          </small>
        </span>
      </label>
      <label className="appearance-neon">
        <input
          type="checkbox"
          checked={appearance.reduceMotion}
          onChange={(e) =>
            change({ ...appearance, reduceMotion: e.target.checked })
          }
        />
        <span>
          <strong>{translateUi("R\u00E9duire les animations")}</strong>
          <small>
            {translateUi(
              "Une navigation plus calme, avec moins de mouvements.",
            )}
          </small>
        </span>
      </label>
      <p className="small-text">
        {translateUi(
          "Ton choix est conserv\u00E9 dans ce navigateur, sur cet appareil. Aucun bouton d\u2019enregistrement n\u00E9cessaire.",
        )}
      </p>
    </section>
  );
}
