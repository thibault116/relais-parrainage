"use client";
import { useEffect, useState, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import {
  bindingKey,
  deviceBinding,
  detachPush,
  iosDevice,
  standalone,
  workerReady,
} from "@/lib/push-client";
import { InstallMentora } from "./pwa";
import { t } from "./language";
type Data = {
  configured: boolean;
  publicKey: string | null;
  devices: { id: string; label: string; created_at: string }[];
  vacancies: boolean;
};
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Impossible de gérer les notifications.");
  return d;
}
export function PushSettings() {
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [supported, setSupported] = useState(false),
    [needsInstall, setNeedsInstall] = useState(false),
    [current, setCurrent] = useState(""),
    [permission, setPermission] = useState("default");
  const load = useCallback(async () => {
    try {
      setData(await call("/api/push/subscriptions"));
      setCurrent(deviceBinding()?.id || "");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
    setNeedsInstall(iosDevice() && !standalone());
    if ("Notification" in window) setPermission(Notification.permission);
    void load();
  }, [load]);
  async function enable() {
    if (!data?.publicKey || !session || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Permission is requested directly in the user click handler, before any network await.
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted")
        throw Error(
          "Autorisation non accordée. Tu peux la modifier dans les réglages du navigateur.",
        );
      const reg = await workerReady();
      let sub = await reg.pushManager.getSubscription();
      const key = Uint8Array.from(
        atob(data.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      if (
        sub &&
        sub.options.applicationServerKey &&
        Array.from(new Uint8Array(sub.options.applicationServerKey)).join() !==
          Array.from(key).join()
      ) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      try {
        const saved = await call("/api/push/subscriptions", "POST", {
          subscription: sub.toJSON(),
          label: iosDevice()
            ? "iPhone / iPad"
            : /Android/.test(navigator.userAgent)
              ? "Android"
              : "Ordinateur",
        });
        localStorage.setItem(
          bindingKey,
          JSON.stringify({ id: saved.id, userId: session.user.id }),
        );
      } catch (e) {
        await sub.unsubscribe();
        throw e;
      }
      setMessage("Notifications activées sur cet appareil.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id?: string) {
    setBusy(true);
    setError("");
    try {
      if (!id || id === current) await detachPush();
      await call(
        "/api/push/subscriptions",
        "DELETE",
        id ? { id } : { all: true },
      );
      setMessage("Notifications désactivées pour les appareils sélectionnés.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    try {
      await call("/api/push/test", "POST", { id: current });
      setMessage(
        "Test accepté par le service push. Vérifie les notifications de ton appareil et le mode Concentration.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = !!data?.devices.some((d) => d.id === current);
  return (
    <section className="verification-panel">
      <h2>{t("Notifications sur mes appareils")}</h2>
      <p>
        {t(
          "Reçois les nouvelles demandes, leurs réponses et le suivi de tes accompagnements, même lorsque Mentora est fermé si ton appareil le permet. Aucun nom, message privé ou justificatif n’apparaît dans la notification.",
        )}
      </p>
      {needsInstall && (
        <p className="info-box">
          {t(
            "Sur iPhone ou iPad, installe d’abord Mentora sur l’écran d’accueil, puis ouvre cette application. Les notifications nécessitent iOS/iPadOS 16.4 ou plus récent.",
          )}
        </p>
      )}
      <InstallMentora />
      {!supported && !needsInstall && (
        <p>
          {t(
            "Les notifications push ne sont pas disponibles dans ce navigateur. Le site et les e-mails restent accessibles.",
          )}
        </p>
      )}
      {data && !data.configured && (
        <p className="info-box">
          {t(
            "Les notifications push ne sont pas encore configurées sur le serveur. L’installation de Mentora reste disponible.",
          )}
        </p>
      )}
      {permission === "denied" && (
        <p>
          {t(
            "Les notifications sont bloquées. Autorise Mentora dans les réglages de notifications de ton navigateur ou de ton appareil.",
          )}
        </p>
      )}
      <div className="crm-actions">
        {!active ? (
          <button
            className="btn"
            disabled={
              busy ||
              !data?.configured ||
              !supported ||
              needsInstall ||
              permission === "denied"
            }
            onClick={() => void enable()}
          >
            {t("Activer les notifications push")}
          </button>
        ) : (
          <>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => void remove(current)}
            >
              {t("Désactiver sur cet appareil")}
            </button>
            <button
              className="btn"
              disabled={busy || !data?.configured}
              onClick={() => void test()}
            >
              {t("Envoyer une notification de test")}
            </button>
          </>
        )}
      </div>
      {data && (
        <label className="email-choice">
          <input
            type="checkbox"
            checked={data.vacancies}
            disabled={busy}
            onChange={async (e) => {
              const vacancies = e.target.checked;
              setBusy(true);
              try {
                await call("/api/push/subscriptions", "PATCH", { vacancies });
                setData({ ...data, vacancies });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          {t(
            "M’avertir par push lorsqu’une place se libère chez un parrain suivi",
          )}
        </label>
      )}
      {!!data?.devices.length && (
        <>
          <h3>{t("Mes appareils abonnés")}</h3>
          <ul className="push-devices">
            {data.devices.map((d) => (
              <li key={d.id}>
                <span>
                  {d.label}
                  {d.id === current ? " · " + t("Cet appareil") : ""} ·{" "}
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </span>
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() => void remove(d.id)}
                >
                  {t("Retirer cet appareil")}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  t(
                    "Désactiver les notifications push sur tous tes appareils ?",
                  ),
                )
              )
                void remove();
            }}
          >
            {t("Désactiver sur tous mes appareils")}
          </button>
        </>
      )}
      {message && <p role="status">{t(message)}</p>}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
    </section>
  );
}
