"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {useMobileChatViewport} from "./use-mobile-chat-viewport";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
type Message = {
  id: string;
  role: string;
  kind: string;
  body: string;
  revision: number;
  created_at: string;
};
type Thread = { id: string; snapshot: { title: string }; status: string };
type Detail = {
  mode: "test" | "live";
  viewerRole:"mentor"|"buyer";selfTest:boolean;canConfirm:boolean;
  booking: {
    id: string;
    title: string;
    status: string;
    revision: number;
    credits: number;
    payoutCents: number;
  };
  messages: Message[];
};
async function api(id?: string, body?: unknown) {
  const r = await fetch(`/api/admin/prestations/chat${id ? `?id=${id}` : ""}`, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Conversation indisponible.");
  return d;
}
export function openServiceChat(id: string) {
  window.dispatchEvent(
    new CustomEvent("mentora-mobile", {
      detail: { screen: "messages", chat: `service:${id}` },
    }),
  );
}
export function ServiceConversationList({
  onOpen,
}: {
  onOpen: (id: string) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      void api()
        .then((d) => {
          if (live) setThreads(d.threads);
        })
        .catch(() => {
          if (live) setError("Conversations de prestations indisponibles.");
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="service-threads">
      {threads.length > 0 && <h2>Mes prestations</h2>}
      {threads.map((t) => (
        <button
          key={t.id}
          className="commerce-row"
          onClick={() => onOpen(`service:${t.id}`)}
        >
          <MessageCircle size={20} />
          <span>
            {t.snapshot.title}
            <small>
              {t.status === "completion_pending"
                ? "Confirmation attendue"
                : t.status === "completed"
                  ? "Prestation terminée"
                  : "Échanger sur la prestation"}
            </small>
          </span>
        </button>
      ))}
      {error && <p role="status">{error}</p>}
    </section>
  );
}
export function ServiceConversation({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [role, setRole] = useState("mentor"),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  const feed = useRef<HTMLDivElement>(null),
    key = useRef<string | null>(null);
  const load = useCallback(async () => setData(await api(id)), [id]);
  useEffect(()=>{if(data&&!data.selfTest)setRole(data.viewerRole);},[data?.viewerRole,data?.selfTest]);
  const container = useRef<HTMLElement>(null);
  useMobileChatViewport(container,true);

  useEffect(() => {
    let live = true;
    const refresh = () =>
      void api(id)
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [data?.messages.length]);
  async function act(payload: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(undefined, payload);
      await load();
      window.dispatchEvent(new Event("mentora-bank-changed"));
      window.dispatchEvent(new Event("mentora-billing-updated"));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section ref={container} className="service-chat">
      <header>
        <button
          className="commerce-icon"
          onClick={onBack}
          aria-label="Retour aux messages"
        >
          <ArrowLeft />
        </button>
        <strong>{data?.booking.title || "Prestation"}</strong>
      </header>
      {data?.selfTest&&<small>Essai administrateur · rémunération non retirable</small>}
      {data?.selfTest && (
        <nav className="service-request-tabs" aria-label="Rôle du test privé">
          <button
            className={role === "mentor" ? "selected" : ""}
            onClick={() => setRole("mentor")}
          >
            Vue Parrain
          </button>
          <button
            className={role === "buyer" ? "selected" : ""}
            onClick={() => setRole("buyer")}
          >
            Vue Débutant
          </button>
        </nav>
      )}
      <div className="service-chat-feed" ref={feed}>
        {data?.messages.map((m) => (
          <article
            key={m.id}
            className={`service-chat-bubble ${m.role === "system" ? "system" : m.role === role ? "mine" : ""}`}
          >
            <small>
              {m.role === "system"
                ? "Suivi de la prestation"
                : m.role === "mentor"
                  ? "Parrain"
                  : "Débutant"}
            </small>
            <p>{m.body}</p>
            {m.kind === "completion" &&
              data.booking.status === "completion_pending" &&
              m.revision === data.booking.revision &&
              data.canConfirm && (role === "buyer" || !data.selfTest) && (
                <div className="service-confirm-actions">
                  <button
                    className="commerce-primary"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "confirm",
                        id,
                        revision: m.revision,
                        yes: true,
                      })
                    }
                  >
                    Oui, c’est terminé
                  </button>
                  <button
                    className="commerce-row"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "confirm",
                        id,
                        revision: m.revision,
                        yes: false,
                      })
                    }
                  >
                    Non, continuer
                  </button>
                </div>
              )}
            <time>
              {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </article>
        ))}
      </div>
      {data?.booking.status === "accepted" && role === "mentor" && (
        <button
          className="commerce-row"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              const r = await fetch("/api/admin/prestations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "decision",
                  id,
                  transition: "complete",
                }),
              });
              const d = await r.json();
              if (!r.ok) throw Error(d.error);
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Prestation terminée
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <form
        className="service-chat-composer"
        onSubmit={async (e) => {
          e.preventDefault();
          key.current ||= crypto.randomUUID();
          if (await act({ action: "send", id, role, body, key: key.current })) {
            setBody("");
            key.current = null;
          }
        }}
      >
        <input
          aria-label="Écrire un message sur la prestation"
          placeholder="Écrire un message…"
          value={body}
          maxLength={3000}
          onChange={(e) => {setBody(e.target.value);key.current=null;}}
        />
        <button
          className="commerce-icon"
          aria-label="Envoyer"
          disabled={busy || !body.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </section>
  );
}
