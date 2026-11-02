"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { authClient } from "@/lib/auth-client";
import { featureAvailable } from "@/lib/feature-release";
import { t } from "./language";
const BetaContext = createContext({
  enabled: false,
  loading: true,
  error: "",
  setEnabled: async (_enabled: boolean) => {},
});
export function BetaProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const sequence = useRef(0);
  const [state, setState] = useState({
    userId: "",
    enabled: false,
    loading: true,
    error: "",
  });
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    if (!userId) {
      setState({ userId: "", enabled: false, loading: false, error: "" });
      return;
    }
    try {
      const r = await fetch("/api/beta", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (ticket === sequence.current)
        setState({ userId, enabled: d.enabled, loading: false, error: "" });
    } catch (e) {
      if (ticket === sequence.current)
        setState({
          userId,
          enabled: false,
          loading: false,
          error: (e as Error).message,
        });
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  async function setEnabled(enabled: boolean) {
    ++sequence.current;
    const r = await fetch("/api/beta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    ++sequence.current;
    setState({
      userId: userId || "",
      enabled: d.enabled,
      loading: false,
      error: "",
    });
  }
  return (
    <BetaContext.Provider
      value={{
        enabled: !!userId && state.userId === userId && state.enabled,
        loading: !!userId && (state.userId !== userId || state.loading),
        error: state.error,
        setEnabled,
      }}
    >
      {children}
    </BetaContext.Provider>
  );
}
export const useBeta = () => useContext(BetaContext);
export function useFeature(feature: string) {
  const beta = useBeta();
  return !beta.loading && featureAvailable(feature, beta.enabled);
}
export function BetaSettings() {
  const { enabled, loading, error: loadError, setEnabled } = useBeta();
  const dialog = useRef<HTMLDialogElement>(null);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    if (welcome) dialog.current?.showModal();
  }, [welcome]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <section className="verification-panel">
      <h2>{t("Programme bêta-testeur")}</h2>
      <p>
        {t(
          "Découvre les prochaines fonctionnalités en avant-première et aide-nous à les améliorer avant leur ouverture à tous.",
        )}
      </p>
      <label className="email-choice">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || loading || !!loadError}
          onChange={async (e) => {
            const checked = e.target.checked;
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              await setEnabled(checked);
              setSaved(true);
              if (checked) setWelcome(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {t("Je souhaite être bêta-testeur")}
      </label>
      <p className="small-text">
        {t(
          "Tu peux quitter le programme à tout moment. Ton choix est lié à ton compte, sur tous tes appareils. Les fonctionnalités déjà disponibles restent accessibles.",
        )}
      </p>
      <p className="small-text">
        {t(
          "En bêta, le bouton + permet de signaler un problème ou de proposer une idée, avec une capture facultative. Ces fonctions peuvent encore évoluer.",
        )}
      </p>
      {(error || loadError) && (
        <p role="alert" className="error">
          {t(error || loadError)}
        </p>
      )}
      {saved && (
        <p role="status">
          {t(
            enabled
              ? "Tu es maintenant bêta-testeur. Le bouton + est disponible."
              : "Programme bêta désactivé. Tu conserves l’accès aux fonctionnalités publiques.",
          )}
        </p>
      )}
      <dialog
        ref={dialog}
        className="release-notes"
        aria-labelledby="beta-welcome-title"
        onClose={() => setWelcome(false)}
      >
        <h2 id="beta-welcome-title">
          {t("Bienvenue parmi les bêta-testeurs !")}
        </h2>
        <p>
          {t(
            "Tu peux maintenant découvrir les nouvelles fonctionnalités en avant-première, avant leur ouverture à tous.",
          )}
        </p>
        <p>
          {t(
            "Le bouton violet + est disponible sur les pages de Mentora. Utilise-le pour signaler un problème ou un bug, ou proposer une idée. Tu peux joindre une capture d’écran si besoin.",
          )}
        </p>
        <p className="small-text">
          {t(
            "Tu peux désactiver le programme à tout moment dans Paramètres → Général.",
          )}
        </p>
        <button
          type="button"
          className="btn"
          autoFocus
          onClick={() => {
            dialog.current?.close();
            setWelcome(false);
          }}
        >
          {t("C’est compris")}
        </button>
      </dialog>
    </section>
  );
}
