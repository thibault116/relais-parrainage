"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  AtSign,
  Send,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Reply,
  Pencil,
  X,
  Bell,
} from "lucide-react";
import { useFeature } from "./beta";
import { t } from "./language";
type Member = { user_id: string; name: string };
type Message = {
  id: string;
  body: string;
  editedAt?: string;
  reply?: { id: string; name: string; body: string } | null;
  createdAt: string;
  name: string;
  profileId?: string | null;
  role?: string;
  photo?: string | null;
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
export function Community({
  channel,
  onOpenProfile,
}: {
  channel?: string;
  onOpenProfile?: (id: string, role: string) => void;
} = {}) {
  const repliesEnabled = useFeature("communityReplies"),
    editingEnabled = useFeature("communityEditing");
  const [reply, setReply] = useState<Message | null>(null),
    [editing, setEditing] = useState<Message | null>(null);
  const priorDraft = useRef({
    draft: "",
    selected: [] as Member[],
    reply: null as Message | null,
  });
  const container = useRef<HTMLElement>(null),
    thread = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const scrollPlan = useRef<{
    bottom?: boolean;
    height?: number;
    top?: number;
  }>({ bottom: true });
  const swipe = useRef<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const baseline = window.innerHeight;
    const resize = () => {
      const el = container.current;
      if (!el) return;
      const viewport = window.visualViewport;
      const keyboard = !!viewport && viewport.height < baseline - 120;
      document.body.classList.toggle("community-keyboard", keyboard);
      const app = el.closest<HTMLElement>(".mobile-app");
      app?.style.setProperty(
        "--mobile-visible-height",
        (viewport?.height || window.innerHeight) + "px",
      );
      app?.style.setProperty(
        "--mobile-visible-top",
        (viewport?.offsetTop || 0) + "px",
      );
      const nav = document.querySelector<HTMLElement>(
        ".mobile-app-dock, .workspace-bottom-nav",
      );
      const navHeight = keyboard ? 0 : nav?.getBoundingClientRect().height || 0;
      el.style.height =
        Math.max(
          120,
          (viewport?.height || window.innerHeight) +
            (viewport?.offsetTop || 0) -
            el.getBoundingClientRect().top -
            navHeight,
        ) + "px";
    };
    resize();
    const observer = new ResizeObserver(resize);
    for (const el of document.querySelectorAll(
      ".workspace-topbar,.mobile-app-header,.platform-announcement,.update-banner",
    ))
      observer.observe(el);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      document.body.classList.remove("community-keyboard");
    };
  }, []);

  const [messages, setMessages] = useState<Message[]>([]),
    [role, setRole] = useState(""),
    [canPost, setCanPost] = useState(true),
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
  const [admin, setAdmin] = useState(false),
    [room, setRoom] = useState("");
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
          `?room=${room}&channel=${encodeURIComponent(channel || "")}&mentions=${mentionsOnly ? "1" : "0"}${before ? "&before=" + encodeURIComponent(before) : ""}`,
        );
        if (!alive.current || ticket !== sequence.current) return;
        const feed = thread.current;
        scrollPlan.current = append
          ? { height: feed?.scrollHeight || 0, top: feed?.scrollTop || 0 }
          : {
              bottom:
                !feed ||
                feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100,
            };
        setRole(data.role);
        setAdmin(!!data.canManage);
        if (
          data.messages.length &&
          !append &&
          scrollPlan.current.bottom &&
          data.canPost !== false &&
          document.visibilityState === "visible"
        )
          void request("", {
            action: "readChannel",
            messageId: data.messages[data.messages.length - 1].id,
          }).catch(() => {});
        setCanPost(data.canPost !== false);
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
    [mentionsOnly, channel, room],
  );
  useLayoutEffect(() => {
    const feed = thread.current;
    if (!feed) return;
    const plan = scrollPlan.current;
    if (plan.height !== undefined)
      feed.scrollTop = (plan.top || 0) + feed.scrollHeight - plan.height;
    else if (plan.bottom) feed.scrollTop = feed.scrollHeight;
  }, [messages]);
  function chooseReply(message: Message) {
    if (!repliesEnabled) return;
    setReply(message);
    input.current?.focus();
  }
  function cancelEdit() {
    setEditing(null);
    setDraft(priorDraft.current.draft);
    setSelected(priorDraft.current.selected);
    setReply(priorDraft.current.reply);
  }
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
      if (editing) {
        await request("", { id: editing.id, body: draft }, "PUT");
        cancelEdit();
        await load();
        return;
      }
      await request("", {
        body: draft,
        mentions: selected.map((m) => m.user_id),
        ...(reply ? { replyTo: reply.id } : {}),
        ...(channel ? { channel } : {}),
      });
      setReply(null);
      if (thread.current)
        thread.current.scrollTop = thread.current.scrollHeight;
      setDraft("");
      if (input.current) input.current.style.height = "40px";
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
    <section ref={container} className="wrap community-page">
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
        <a
          className="community-icon"
          href="/?profileTab=emails#profile"
          aria-label={t("Vérifier mes notifications")}
          title={t("Vérifier mes notifications")}
        >
          <Bell size={18} />
        </a>
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
      {admin && (
        <div className="community-filters" aria-label="Communauté à consulter">
          {[
            ["mentor", "Parrains"],
            ["beginner", "Débutants"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={role === id ? "btn" : "btn secondary"}
              onClick={() => {
                setRoom(id);
                setMessages([]);
                setArchived(false);
                setMentionsOnly(false);
                scrollPlan.current = { bottom: true };
              }}
            >
              {label}
            </button>
          ))}
        </div>
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
        ref={thread}
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
            onTouchStart={(e) => {
              if (repliesEnabled && !editing && e.touches.length === 1)
                swipe.current = {
                  id: message.id,
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
            }}
            onTouchEnd={(e) => {
              const start = swipe.current;
              swipe.current = null;
              if (!start || start.id !== message.id) return;
              const end = e.changedTouches[0];
              if (
                start.x - end.clientX > 65 &&
                Math.abs(start.y - end.clientY) < 45
              )
                chooseReply(message);
            }}
            onTouchCancel={() => {
              swipe.current = null;
            }}
            id={`message-${message.id}`}
            key={message.id}
            className={`community-message${message.mine ? " is-mine" : ""}`}
          >
            <header>
              {onOpenProfile && (
                <button
                  className="community-profile-avatar"
                  disabled={!message.profileId}
                  aria-label={`Voir le profil de ${message.name}`}
                  onClick={() =>
                    message.profileId &&
                    onOpenProfile(message.profileId, message.role || "mentor")
                  }
                >
                  {message.photo ? (
                    <img src={message.photo} alt="" />
                  ) : (
                    message.name.slice(0, 1)
                  )}
                </button>
              )}
              <strong>{message.name}</strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {message.editedAt && <small>{t("modifié")}</small>}
              {repliesEnabled && (
                <button
                  className="community-icon"
                  aria-label={t("Répondre au message")}
                  onClick={() => chooseReply(message)}
                >
                  <Reply size={16} />
                </button>
              )}
              {message.mine && editingEnabled && (
                <button
                  className="community-icon"
                  aria-label={t("Modifier mon message")}
                  onClick={() => {
                    if (!editing)
                      priorDraft.current = { draft, selected, reply };
                    setEditing(message);
                    setReply(null);
                    setDraft(message.body);
                    setSelected(message.mentions);
                    setPicker(false);
                    input.current?.focus();
                  }}
                >
                  <Pencil size={16} />
                </button>
              )}
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
            {message.reply && (
              <blockquote className="community-quote">
                <strong>{message.reply.name}</strong>
                <p>{message.reply.body.slice(0, 200)}</p>
              </blockquote>
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
      {role && !canPost && (
        <p className="mobile-room-note">
          Consultation administrateur de cet espace.
        </p>
      )}
      {role && canPost && (
        <form className="community-composer" onSubmit={send}>
          {editing && (
            <div className="community-reply-draft">
              <span>{t("Modification de ton message")}</span>
              <button
                type="button"
                className="community-icon"
                aria-label={t("Annuler la modification")}
                onClick={cancelEdit}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {reply && (
            <div className="community-reply-draft">
              <span>
                <strong>
                  {t("Réponse à")} {reply.name}
                </strong>
                <br />
                {reply.body.slice(0, 100)}
              </span>
              <button
                type="button"
                className="community-icon"
                aria-label={t("Annuler la réponse")}
                onClick={() => setReply(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <label htmlFor="community-draft">{t("Ton message")}</label>
          <textarea
            ref={input}
            id="community-draft"
            value={draft}
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              e.target.style.height = "40px";
              e.target.style.height =
                Math.min(88, e.target.scrollHeight) + "px";
              if (!editing) {
                const match = value.match(/(?:^|\s)@([^@\n]{0,40})$/);
                if (
                  match &&
                  !selected.some((member) =>
                    match[1].startsWith(member.name + " "),
                  )
                ) {
                  setSearch(match[1]);
                  setPicker(true);
                } else {
                  setPicker(false);
                  setSearch("");
                }
              }
            }}
            maxLength={3000}
            rows={1}
            placeholder={t("Écrire un message…")}
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
                      if (/(?:^|\s)@[^@\n]{0,40}$/.test(draft))
                        setDraft((d) =>
                          d.replace(/@[^@\n]{0,40}$/, `@${member.name} `),
                        );
                      setPicker(false);
                      setSearch("");
                      input.current?.focus();
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
              disabled={!!editing}
              aria-label={t("Mentionner")}
              aria-expanded={picker}
              onClick={() => setPicker(!picker)}
            >
              <AtSign size={18} />
            </button>

            <button
              type="submit"
              onPointerDown={(e) => e.preventDefault()}
              className="btn"
              aria-label={t(editing ? "Enregistrer" : "Envoyer")}
              disabled={busy || !draft.trim()}
            >
              <Send size={18} />
            </button>
          </div>
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
        if (active) setCount(result.messagesUnread ?? result.unread);
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
