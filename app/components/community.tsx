"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Send, Trash2, RefreshCw, ShieldCheck } from "lucide-react";
import { t } from "./language";
type Member = { user_id: string; name: string };
type Message = {
  id: string;
  body: string;
  createdAt: string;
  name: string;
  mine: boolean;
  mentions: Member[];
};
async function request(path = "", data?: object, method = "POST") {
  const response = await fetch(
    `/api/community${path}`,
    data
      ? {
          signal: AbortSignal.timeout(15000),
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Impossible de charger la communauté.");
  return result;
}
export function Community() {
  const [messages, setMessages] = useState<Message[]>([]),
    [role, setRole] = useState(""),
    [error, setError] = useState("");
  const [draft, setDraft] = useState(""),
    [selected, setSelected] = useState<Member[]>([]),
    [members, setMembers] = useState<Member[]>([]);
  const [picker, setPicker] = useState(false),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [older, setOlder] = useState(false),
    [archived, setArchived] = useState(false);
  const [unread, setUnread] = useState(0);
  const [deleteId, setDeleteId] = useState("");
  const reading = useRef(false),
    alive = useRef(true),
    sequence = useRef(0);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  useEffect(() => {
    setMentionsOnly(
      new URLSearchParams(window.location.search).has("communityMentions"),
    );
  }, []);
  const load = useCallback(
    async (before = "", append = false) => {
      const ticket = ++sequence.current;
      reading.current = true;
      try {
        const data = await request(
          `?mentions=${mentionsOnly ? "1" : "0"}${before ? "&before=" + encodeURIComponent(before) : ""}`,
        );
        if (!alive.current || ticket !== sequence.current) return;
        setRole(data.role);
        setMessages((previous) =>
          append
            ? [...data.messages, ...previous].filter(
                (m, i, all) => all.findIndex((x) => x.id === m.id) === i,
              )
            : data.messages,
        );
        setOlder(data.hasOlder);
        setUnread(data.unread);
        setError("");
      } catch (e) {
        if (alive.current && ticket === sequence.current)
          setError((e as Error).message);
      } finally {
        if (ticket === sequence.current) {
          reading.current = false;
          if (alive.current) setLoading(false);
        }
      }
    },
    [mentionsOnly],
  );
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !archived &&
        !reading.current
      )
        void load();
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load, archived]);
  useEffect(() => {
    if (!picker) return;
    let active = true;
    const timer = setTimeout(() => {
      void request(`?members=${encodeURIComponent(search)}`)
        .then((data) => {
          if (active) setMembers(data.members);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [picker, search]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      await request("", {
        body: draft,
        mentions: selected.map((m) => m.user_id),
      });
      setDraft("");
      setSelected([]);
      setPicker(false);
      setArchived(false);
      setMentionsOnly(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await request("", { id }, "DELETE");
      setMessages((previous) => previous.filter((m) => m.id !== id));
      setDeleteId("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function markRead() {
    try {
      await request("", { ids: messages.map((m) => m.id).slice(-50) }, "PATCH");
      setUnread((await request("?summary=1")).unread);
      window.dispatchEvent(new Event("community-read"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="wrap community-page">
      <div className="community-intro">
        <ShieldCheck size={21} />
        <div>
          <strong>
            {t(
              role === "mentor"
                ? "Entre parrains"
                : role === "beginner"
                  ? "Entre débutants"
                  : "Ta communauté",
            )}
          </strong>
          <p>
            {t(
              "Échange des conseils d’achat-revente avec les membres de ton espace. Les deux communautés restent séparées.",
            )}
          </p>
        </div>
        <button
          type="button"
          className="community-icon"
          onClick={() => {
            setArchived(false);
            void load();
          }}
          title={t("Actualiser")}
          aria-label={t("Actualiser")}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="community-error">
          {t(error)}
        </p>
      )}
      <div className="community-filters">
        <button
          className={!mentionsOnly ? "btn" : "btn secondary"}
          onClick={() => {
            setArchived(false);
            setMentionsOnly(false);
          }}
        >
          {t("Tous les messages")}
        </button>
        <button
          className={mentionsOnly ? "btn" : "btn secondary"}
          onClick={() => {
            setArchived(false);
            setMentionsOnly(true);
          }}
        >
          {t("Mes mentions")} {unread > 0 ? `(${unread})` : ""}
        </button>
      </div>
      {unread > 0 && (
        <div className="community-notice">
          <span>
            {unread} {t("mention(s) non lue(s)")}
          </span>
          <button onClick={markRead}>
            {t("Marquer les messages affichés comme lus")}
          </button>
        </div>
      )}
      <div
        className="community-thread"
        aria-label={t("Messages de la communauté")}
        aria-busy={loading}
      >
        {older && (
          <button
            className="btn secondary"
            onClick={() => {
              setArchived(true);
              void load(messages[0]?.id, true);
            }}
          >
            {t("Messages précédents")}
          </button>
        )}
        {loading ? (
          <p role="status">{t("Chargement…")}</p>
        ) : !messages.length && !error ? (
          <p>
            {t(
              mentionsOnly
                ? "Aucune mention non lue."
                : "Bienvenue ! Lance la discussion avec une question ou un conseil.",
            )}
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            id={`message-${message.id}`}
            key={message.id}
            className={`community-message${message.mine ? " is-mine" : ""}`}
          >
            <header>
              <strong>{message.name}</strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {message.mine && (
                <button
                  className="community-icon"
                  title={t("Supprimer mon message")}
                  aria-label={t("Supprimer mon message")}
                  onClick={() => setDeleteId(message.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </header>
            {!!message.mentions.length && (
              <div className="community-mentions">
                {message.mentions.map((member) => (
                  <span key={member.user_id}>@{member.name}</span>
                ))}
              </div>
            )}
            <p>{message.body}</p>
            {deleteId === message.id && (
              <div className="community-notice">
                <span>{t("Supprimer ce message ?")}</span>
                <button onClick={() => void remove(message.id)}>
                  {t("Supprimer")}
                </button>
                <button onClick={() => setDeleteId("")}>{t("Annuler")}</button>
              </div>
            )}
          </article>
        ))}
      </div>
      {archived && (
        <button
          className="btn secondary"
          onClick={() => {
            setArchived(false);
            void load();
          }}
        >
          {t("Revenir aux derniers messages")}
        </button>
      )}
      {role && (
        <form className="community-composer" onSubmit={send}>
          <label htmlFor="community-draft">{t("Ton message")}</label>
          <textarea
            id="community-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={3000}
            rows={3}
            placeholder={t(
              "Une question, une astuce ou un retour d’expérience…",
            )}
            required
          />
          {!!selected.length && (
            <div className="community-mentions">
              {selected.map((member) => (
                <button
                  type="button"
                  key={member.user_id}
                  onClick={() =>
                    setSelected((previous) =>
                      previous.filter((m) => m.user_id !== member.user_id),
                    )
                  }
                  aria-label={`${t("Retirer la mention")} ${member.name}`}
                >
                  @{member.name} ×
                </button>
              ))}
            </div>
          )}
          {picker && (
            <div className="community-picker">
              <label htmlFor="community-search">
                {t("Rechercher un membre de cet espace")}
              </label>
              <input
                id="community-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
              {members
                .filter(
                  (member) =>
                    !selected.some((m) => m.user_id === member.user_id),
                )
                .map((member) => (
                  <button
                    type="button"
                    key={member.user_id}
                    disabled={selected.length >= 10}
                    onClick={() => {
                      setSelected((previous) => [...previous, member]);
                      setPicker(false);
                      setSearch("");
                    }}
                  >
                    @{member.name}
                  </button>
                ))}
              {!members.length && <p>{t("Aucun membre trouvé.")}</p>}
            </div>
          )}
          <div className="community-compose-actions">
            <button
              type="button"
              className="btn secondary"
              aria-expanded={picker}
              onClick={() => setPicker(!picker)}
            >
              <AtSign size={18} />
              {t("Mentionner")}
            </button>
            <small>{draft.length}/3 000</small>
            <button
              type="submit"
              className="btn"
              disabled={busy || !draft.trim()}
            >
              <Send size={18} />
              {t(busy ? "Envoi…" : "Envoyer")}
            </button>
          </div>
          <small>
            {t(
              "Reste bienveillant. Les mentions avertissent les membres concernés ; les notifications push doivent être activées dans Paramètres.",
            )}
          </small>
        </form>
      )}
    </section>
  );
}
export function CommunityBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true,
      running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const result = await request("?summary=1");
        if (active) setCount(result.unread);
      } catch {
        if (active) setCount(0);
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("community-read", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("community-read", refresh);
    };
  }, []);
  return count > 0 ? (
    <span
      className="community-count"
      aria-label={`${count} ${t("mention(s) non lue(s)")}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
