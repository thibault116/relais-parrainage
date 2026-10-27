"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Sun, Moon, Sparkles } from "lucide-react";
type Appearance = { dark: boolean; neon: boolean };
const defaults: Appearance = { dark: false, neon: false };
const AppearanceContext = createContext({
  appearance: defaults,
  change: (_next: Appearance) => {},
});
const key = "mentora-appearance";
function read(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return { dark: v.dark === true, neon: v.neon === true };
  } catch {
    return defaults;
  }
}
function apply(v: Appearance) {
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
      {children}
    </AppearanceContext.Provider>
  );
}
export function AppearanceSettings() {
  const { appearance, change } = useContext(AppearanceContext);
  return (
    <section className="verification-panel appearance-settings">
      <span className="eyebrow">À TON GOÛT</span>
      <h2>Apparence de Mentora</h2>
      <p>
        Choisis ton ambiance. Les changements s’appliquent immédiatement sur
        tout le site.
      </p>
      <div
        className="appearance-options"
        role="group"
        aria-label="Mode d’affichage"
      >
        <button
          className={!appearance.dark ? "selected" : ""}
          aria-pressed={!appearance.dark}
          onClick={() => change({ ...appearance, dark: false })}
        >
          <Sun size={26} />
          <strong>Mode clair</strong>
          <span>Blanc et violet</span>
        </button>
        <button
          className={appearance.dark ? "selected" : ""}
          aria-pressed={appearance.dark}
          onClick={() => change({ ...appearance, dark: true })}
        >
          <Moon size={26} />
          <strong>Mode sombre</strong>
          <span>Noir, violet et textes clairs</span>
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
          <strong>Violet néon</strong>
          <small>
            Des accents violets plus lumineux, avec une légère lueur.
          </small>
        </span>
      </label>
      <p className="small-text">
        Ton choix est conservé dans ce navigateur, sur cet appareil. Aucun
        bouton d’enregistrement nécessaire.
      </p>
    </section>
  );
}
