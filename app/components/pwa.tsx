"use client";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  detachPush,
  deviceBinding,
  iosDevice,
  standalone,
  workerReady,
} from "@/lib/push-client";
import { t } from "./language";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let installation: InstallEvent | null = null;
function rememberInstalled() {
  try {
    localStorage.setItem("mentora-installed", "true");
  } catch {}
}
function installedBefore() {
  try {
    return localStorage.getItem("mentora-installed") === "true";
  } catch {
    return false;
  }
}
export function PwaProvider() {
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => {
    const install = (e: Event) => {
      e.preventDefault();
      installation = e as InstallEvent;
      window.dispatchEvent(new Event("mentora-install-ready"));
    };
    const installed = () => {
      installation = null;
      rememberInstalled();
      window.dispatchEvent(new Event("mentora-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    if (standalone()) rememberInstalled();
    if ("serviceWorker" in navigator) {
      void workerReady().catch(() => {});
    }
    const update = () => {
      if (document.visibilityState === "visible")
        void navigator.serviceWorker
          ?.getRegistration("/")
          .then((r) => r?.update())
          .catch(() => {});
    };
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (isPending) return;
    const binding = deviceBinding();
    if (binding && binding.userId !== session?.user.id) void detachPush();
  }, [session?.user.id, isPending]);
  return null;
}
export function InstallMentora() {
  const [visible, setVisible] = useState(false),
    [ios, setIos] = useState(false),
    [guide, setGuide] = useState(false),
    [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const update = () => {
      setIos(iosDevice());
      setVisible(!standalone() && (!!installation || !installedBefore()));
    };
    update();
    window.addEventListener("mentora-install-ready", update);
    return () => window.removeEventListener("mentora-install-ready", update);
  }, []);
  useEffect(() => {
    if (guide) dialog.current?.showModal();
  }, [guide]);
  async function install() {
    if (installation) {
      try {
        const event = installation;
        installation = null;
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
          rememberInstalled();
        }
      } catch {
        setMessage("Utilise le menu de ton navigateur pour installer Mentora.");
        setGuide(true);
      }
    } else setGuide(true);
  }
  if (!visible) return null;
  return (
    <>
      <button
        className="btn secondary pwa-install"
        onClick={() => void install()}
      >
        {t("Installer Mentora")}
      </button>
      {guide && (
        <dialog
          ref={dialog}
          className="pwa-guide"
          aria-label={t("Installer Mentora")}
          onClose={() => setGuide(false)}
        >
          <button className="text-btn" onClick={() => dialog.current?.close()}>
            {t("Fermer")}
          </button>
          <img src="/icons/icon-192.png" width="72" height="72" alt="Mentora" />
          <h2>{t("Mentora, sur ton écran d’accueil")}</h2>
          <p>{t("Installation gratuite, sans App Store ni Google Play.")}</p>
          {ios ? (
            <ol>
              <li>{t("Ouvre Mentora dans Safari.")}</li>
              <li>{t("Appuie sur Partager (le carré avec une flèche).")}</li>
              <li>
                {t("Choisis « Sur l’écran d’accueil », puis « Ajouter ».")}
              </li>
              <li>
                {t(
                  "Ouvre Mentora avec sa nouvelle icône pour activer les notifications.",
                )}
              </li>
            </ol>
          ) : (
            <ol>
              <li>
                {t(
                  "Ouvre le menu de Chrome, Edge ou de ton navigateur compatible.",
                )}
              </li>
              <li>
                {t(
                  "Choisis « Installer Mentora » ou « Ajouter à l’écran d’accueil ». Sur Safari Mac : Fichier → Ajouter au Dock.",
                )}
              </li>
              <li>
                {t("Confirme, puis ouvre Mentora depuis sa nouvelle icône.")}
              </li>
            </ol>
          )}
          <p>{message}</p>
          <p className="small-text">
            {t(
              "Tes comptes et tes données restent les mêmes. Si l’option n’apparaît pas, mets ton navigateur à jour. Tu peux toujours utiliser le site normalement.",
            )}
          </p>
        </dialog>
      )}
    </>
  );
}
