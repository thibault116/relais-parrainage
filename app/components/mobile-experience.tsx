"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  Home,
  Menu,
  AlertCircle,
  Hand,
  Search,
  Users,
  MessageCircle,
  UserRound,
  Bell,
  ChevronRight,
  ChevronLeft,
  Target,
  Inbox,
  CheckCircle2,
  Bookmark,
  CircleHelp,
  Send,
  MoreHorizontal,
  ImagePlus,
  Pin,
  ShieldBan,
  Flag,
  Plus,
  Megaphone,
  NotebookPen,
} from "lucide-react";
import { AdminMonetization } from "./admin-monetization";
import { AdminLegalGuide } from "./admin-legal-guide";
import { JoinOffers } from "./join-offers";
import { OwnerPlanBadge } from "./owner-billing";
import { BrandLogo } from "./brand-logo";
import { useFeature } from "./beta";
import { useMentorCompletion } from "./mentor-portfolio";
import { Community } from "./community";
import { t } from "./language";
import {
  workspaceMain, workspaceGroups, workspaceRoutes as routes, type WorkspaceItem, type WorkspaceTarget,
} from "./workspace-destinations";
import type { Profile } from "@/lib/profile";
type Row = Record<string, any>;
const BookmarkContext = createContext<{
  ids: string[];
  refresh: () => void;
} | null>(null);
export async function mobileApi(url: string, body?: unknown) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Connexion impossible. Réessaie.");
  return d;
}
export function MobileProfileActions({
  profileId,
  compact = false,
}: {
  profileId: string;
  compact?: boolean;
}) {
  const bookmarks = useContext(BookmarkContext);
  const enabled = useFeature("mobileExtras"),
    messaging = useFeature("privateMessaging");
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (bookmarks) {
      setSaved(bookmarks.ids.includes(profileId));
      return;
    }
    if (enabled && (!compact || window.matchMedia("(max-width:900px)").matches))
      mobileApi("/api/mobile")
        .then((d) => setSaved(d.bookmarks.some((p: Row) => p.id === profileId)))
        .catch(() => {});
  }, [enabled, profileId, bookmarks, compact]);
  async function act(kind: string) {
    setBusy(true);
    setError("");
    try {
      if (kind === "save") {
        await mobileApi("/api/mobile", {
          action: "bookmark",
          id: profileId,
          saved: !saved,
        });
        setSaved(!saved);
        bookmarks?.refresh();
      } else {
        const d = await mobileApi("/api/messages", {
          action: "connect",
          profileId,
        });
        window.dispatchEvent(
          new CustomEvent("mentora-mobile", {
            detail: { screen: "messages", chat: d.id },
          }),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`mobile-profile-actions ${compact ? "compact-bookmark" : ""}`}
    >
      {enabled && (
        <button
          disabled={busy}
          className="btn secondary"
          aria-label={
            saved ? "Retirer des profils enregistrés" : "Enregistrer le profil"
          }
          aria-pressed={saved}
          onClick={() => act("save")}
        >
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          {!compact && (saved ? "Enregistré" : "Enregistrer")}
        </button>
      )}
      {messaging && !compact && (
        <button
          disabled={busy}
          className="btn secondary"
          onClick={() => act("chat")}
        >
          <MessageCircle size={17} />
          Envoyer une demande de message
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
const ignoreLegacyNavigation = () => {};
export function MobileExperience({
  legacy,
  desktopScreen,
  desktopChat,
  onDesktopNavigate,
  moderator = false,
  discordUrl,
  administrator = false,
  profile,
  name,
  userId,
  view,
  profileTab,
  onNavigate = ignoreLegacyNavigation,
  onOpenProfile,
}: {
  administrator?: boolean;
  legacy?: ReactNode;
  desktopScreen?: string;
  desktopChat?: string;
  onDesktopNavigate?: (item: WorkspaceTarget, params?: Record<string, string>) => void;
  moderator?: boolean;
  discordUrl: string;
  profile: Profile | null;
  name: string;
  userId: string;
  view: string;
  profileTab: string;
  onNavigate?: (view: string, tab?: string, section?: string) => void;
  onOpenProfile: (id: string, role: string) => void;
}) {
  const completionNeeded = useMentorCompletion(profile?.role === "mentor");
  const extras = useFeature("mobileExtras"),
    dm = useFeature("privateMessaging"),
    channels = useFeature("communityChannels");
  const [mobileScreen, setScreen] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mobile") ||
        (view === "community" ? "community" : "home")
      : "home",
  );
  const screen = desktopScreen ?? mobileScreen;
  const [pairs, setPairs] = useState<Row[]>([]),
    [lists, setLists] = useState<Row[]>([]),
    [notices, setNotices] = useState<Row[]>([]),
    [bookmarks, setBookmarks] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [unreadOnly, setUnreadOnly] = useState(false),
    [channel, setChannel] = useState<string | null>(null),
    [chat, setChat] = useState(() =>
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("chat") || ""
        : "",
    );
  const [toast, setToast] = useState<Row | null>(null),
    [communityCount, setCommunityCount] = useState(0);
  const seenNotices = useRef<Set<string> | null>(null);
  const currentScreen = useRef(screen);
  currentScreen.current = screen;
  const currentChat = useRef(chat);
  currentChat.current = chat;
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void audio.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const initial = useRef(true);
  const applyNotices = useCallback((data: { notices: Row[] }) => {
    const incoming: Row[] = data.notices;
    const fresh =
      seenNotices.current &&
      incoming.find(
        (n) =>
          !n.read &&
          n.id.startsWith("chat:") &&
          !seenNotices.current!.has(n.id) &&
          !(
            currentScreen.current === "messages" &&
            n.id.startsWith("chat:" + currentChat.current + ":")
          ),
      );
    if (fresh && document.visibilityState === "visible") {
      setToast(fresh);
      try {
        const ctx = audio.current;
        if (ctx?.state === "running") {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 660;
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }
      } catch {}
    }
    seenNotices.current = new Set(incoming.map((n) => n.id));
    setNotices(incoming);
  }, []);
  useEffect(() => {
    if (!extras) return;
    let busy = false,
      active = true;
    const poll = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const data = await mobileApi("/api/mobile");
        if (active) applyNotices(data);
      } catch {
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void poll(), 7000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [extras, applyNotices]);
  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      mobileApi("/api/accompaniments"),
      mobileApi("/api/tasks"),
      ...(extras ? [mobileApi("/api/mobile")] : []),
    ]);
    if (results[0].status === "fulfilled")
      setPairs(results[0].value.accompaniments);
    if (results[1].status === "fulfilled") setLists(results[1].value.lists);
    if (results[2]?.status === "fulfilled") {
      applyNotices(results[2].value);
      setBookmarks(results[2].value.bookmarks);
    }
    setError(
      results.some((r) => r.status === "rejected")
        ? "Certaines informations n’ont pas pu être chargées. Réessaie."
        : "",
    );
    setLoading(false);
  }, [extras, applyNotices]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (desktopScreen) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        void mobileApi("/api/community?summary=1")
          .then((d) => setCommunityCount(d.messagesUnread || 0))
          .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [desktopScreen]);
  const go = useCallback(
    (next: string, params: Record<string, string> = {}) => {
      setScreen(next);
      setError("");
      setChannel(null);
      if (onDesktopNavigate) {
        onDesktopNavigate({ screen: next, ...params }, params);
        return;
      }
      if (routes[next])
        onNavigate(routes[next][0], next === "admin" ? params.adminTab : routes[next][1], params.settingsSection);
      else onNavigate(next === "community" ? "community" : "profile");
      const url = new URL(window.location.href);
      url.searchParams.set("mobile", next);
      url.hash =
        routes[next]?.[0] || (next === "community" ? "community" : "profile");
      url.searchParams.delete("chat");
      url.searchParams.delete("settingsSection");
      if (routes[next]?.[1])
        url.searchParams.set("profileTab", routes[next][1]!);
      else url.searchParams.delete("profileTab");
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      window.history.pushState(
        { mentoraDepth: (window.history.state?.mentoraDepth || 0) + 1 },
        "",
        url,
      );
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [onNavigate, onDesktopNavigate],
  );
  function back() {
    if (window.history.state?.mentoraDepth > 0) window.history.back();
    else go("menu");
  }
  useEffect(() => {
    if (desktopScreen) return;
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail;
      go(d.screen, d.chat ? { chat: d.chat } : {});
      if (d.chat) setChat(d.chat);
    };
    window.addEventListener("mentora-mobile", open);
    return () => window.removeEventListener("mentora-mobile", open);
  }, [go, desktopScreen]);
  useEffect(() => {
    if (desktopScreen) return;
    if (initial.current) {
      initial.current = false;
      const param = new URLSearchParams(window.location.search).get(
        "profileTab",
      );
      if (param && !new URLSearchParams(window.location.search).has("mobile")) {
        setScreen(
          param === "emails" ||
            param === "verification" ||
            param === "appearance"
            ? "settings"
            : param === "tasks"
              ? "tasks"
              : param === "requests"
                ? "requests"
                : "edit",
        );
      }
      return;
    }
    if (view === "moderation") setScreen("admin");
    if (view === "help") setScreen("help");
  }, [view, profileTab, desktopScreen]);
  useEffect(() => {
    if (desktopScreen) {
      setChannel(null);
      setChat(desktopChat || "");
      return;
    }
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("mobile") || "home";
      setScreen(next);
      setChannel(null);
      setChat(params.get("chat") || "");
      if (next === "admin")
        onNavigate("moderation", params.get("adminTab") || "overview");
      else if (routes[next])
        onNavigate(
          routes[next][0],
          routes[next][1],
          params.get("settingsSection") || undefined,
        );
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [onNavigate, desktopScreen, desktopChat]);
  const pending = pairs.filter((p) => p.status === "pending"),
    active = pairs.filter((p) => p.status === "active"),
    done = lists.reduce((n, l) => n + l.completed, 0),
    total = lists.reduce((n, l) => n + l.total, 0),
    percent = total ? Math.round((done / total) * 100) : 0;
  function tile(
    label: string,
    sub: string,
    icon: typeof Home,
    next: string,
    badge?: number,
  ) {
    const Icon = icon;
    return (
      <button className="mobile-tile" onClick={() => go(next)}>
        <Icon />
        <span>
          <strong>{t(label)}</strong>
          <small>{t(sub)}</small>
        </span>
        {!!badge && <b className="mobile-count">{badge}</b>}
        <ChevronRight size={18} />
      </button>
    );
  }
  const [menuSearch, setMenuSearch] = useState("");
  function openSettings(section: string) {
    go("settings", { settingsSection: section });
  }
  function openNetwork(type: string) {
    go("following", { network: type });
    if (desktopScreen) return;
    window.dispatchEvent(
      new CustomEvent("mentora-network-section", { detail: type }),
    );
  }
  const menuGroups = workspaceGroups(profile?.role === "mentor", moderator, administrator, extras);
  function openMenuItem(item: WorkspaceItem) {
    if (item.external === "discord") {
      window.open(discordUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.adminTab) {
      go("admin", { adminTab: item.adminTab });
      return;
    }
    if (item.settingsSection) openSettings(item.settingsSection);
    else go(item.screen);
  }
  const beta = (
    <section className="mobile-empty">
      <h2>En avant-première</h2>
      <p>
        Active le programme bêta dans les paramètres pour découvrir cette
        fonctionnalité.
      </p>
      <button className="btn" onClick={() => go("settings")}>
        Ouvrir les paramètres
      </button>
    </section>
  );
  const Content = desktopScreen ? "div" : "main";
  const legacyMode = !!routes[screen];
  const selected =
    screen === "discover" || screen === "requests"
      ? "discover"
      : screen === "messages"
        ? "messages"
        : screen === "community"
          ? "community"
          : [
                "joinOffers",
                "legalGuide",
                "billing",
                "credits",
                "services",
                "payouts",
                "menu",
                "profile",
                "edit",
                "settings",
                "help",
                "saved",
                "following",
                "admin",
              ].includes(screen)
            ? "menu"
            : "home";
  return (
    <BookmarkContext.Provider
      value={{ ids: bookmarks.map((p) => p.id), refresh: () => void load() }}
    >
      <div
        className={`mobile-app ${desktopScreen ? "desktop-experience" : ""} ${screen === "community" && channel !== null ? "mobile-chat-view" : ""}`}
      >
        {toast && (
          <aside className="in-app-message" role="status">
            <button
              onClick={() => {
                const id = String(toast.id).split(":")[1];
                go("messages", { chat: id });
                setChat(id);
                setToast(null);
              }}
            >
              <strong>Nouveau message</strong>
              <span>{toast.title}</span>
            </button>
            <button
              aria-label="Fermer la notification"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </aside>
        )}
        {!desktopScreen && <header className="mobile-app-header">
          <button
            className="mobile-app-brand"
            onClick={() => go("home")}
            aria-label="Accueil Mentora"
          >
            <BrandLogo />
            <strong>Mentora</strong>
            <OwnerPlanBadge enabled={administrator} />
          </button>
          <button
            className="mobile-icon"
            aria-label="Notifications"
            onClick={() => go("notifications")}
          >
            <Bell size={22} />
            {notices.some((n) => !n.read) && (
              <b className="mobile-count notification-count">
                {Math.min(99, notices.filter((n) => !n.read).length)}
              </b>
            )}
          </button>
          <button
            className="mobile-profile-access"
            onClick={() => go("profile")}
            aria-label={`Mon profil : ${name}${completionNeeded ? ", à finaliser" : ""}`}
          >
            <span className="mobile-avatar small">
              {profile?.photo ? (
                <img src={profile.photo} alt="" />
              ) : (
                name.slice(0, 1)
              )}
              {completionNeeded && (
                <span className="profile-incomplete" aria-hidden="true">
                  !
                </span>
              )}
            </span>
            <span className="mobile-profile-name">{name}</span>
          </button>
        </header>}
        {error && (
          <div role="alert" className="mobile-error">
            {error}
            <button onClick={() => void load()}>Réessayer</button>
          </div>
        )}
        <Content className="mobile-app-content">
          {screen === "legalGuide" && (
            <>
              <button className="mobile-back" onClick={back}>
                <ChevronLeft size={18} />
                Retour
              </button>
              {administrator ? <AdminLegalGuide /> : (
                <p>Accès réservé au compte administrateur principal.</p>
              )}
            </>
          )}
          {screen === "joinOffers" && (
            <>
              <button className="mobile-back" onClick={back}>
                <ChevronLeft size={18} />
                Retour
              </button>
              {administrator ? (
                <JoinOffers onManage={() => go("billing")} />
              ) : (
                <p>Accès réservé au compte administrateur principal.</p>
              )}
            </>
          )}
          {["billing", "credits", "services", "payouts"].includes(screen) && (
            <>
              <button className="mobile-back" onClick={back}>
                <ChevronLeft size={18} />
                Retour
              </button>
              {administrator &&
              (!["services", "payouts"].includes(screen) ||
                profile?.role === "mentor") ? (
                <AdminMonetization
                  key={screen}
                  dedicated
                  initialTab={
                    screen === "billing"
                      ? "plans"
                      : screen === "credits"
                        ? "wallet"
                        : screen
                  }
                />
              ) : (
                <p>Accès réservé au compte administrateur principal.</p>
              )}
            </>
          )}
          {screen === "home" && (
            <>
              <h1>
                Bonjour {name.split(" ")[0]} <span>👋</span>
              </h1>
              <p className="mobile-subtitle">
                {profile?.role === "mentor"
                  ? "Tes accompagnements et les prochaines étapes de tes binômes."
                  : "Voici ton activité et tes prochaines étapes."}
              </p>
              <button
                className="mobile-progress-card"
                onClick={() =>
                  go(total ? "tasks" : active.length ? "pairs" : "discover")
                }
              >
                <Target size={42} />
                <span>
                  <strong>
                    {!total
                      ? active.length
                        ? "Reprendre mon accompagnement"
                        : "Trouver mon prochain binôme"
                      : profile?.role === "mentor"
                        ? "La progression de tes binômes"
                        : "Ma progression"}
                  </strong>
                  <small>
                    {total
                      ? `${done}/${total} objectifs complétés`
                      : "Une prochaine étape à construire ensemble"}
                  </small>
                  {total > 0 && <progress max={100} value={percent} />}
                </span>
                <ChevronRight size={20} />
              </button>
              {active.length > 0 && <h2>En cours</h2>}
              {active.map((pair) => {
                const list = lists.find((l) => l.id === pair.id);
                return (
                  <button
                    key={pair.id}
                    className="refonte-pair-card"
                    onClick={() => go("pairs")}
                  >
                    <span className="refonte-pair-top">
                      <span className="mobile-role">Accompagnement actif</span>
                      <ChevronRight size={18} />
                    </span>
                    <strong>{pair.partner_name}</strong>
                    <span>
                      {profile?.role === "mentor"
                        ? "Accompagner sa progression"
                        : "Reprendre mon accompagnement"}
                    </span>
                    <span className="refonte-pair-bottom">
                      {list?.total
                        ? `${list.completed}/${list.total} tâches terminées`
                        : "Voir les prochaines étapes"}
                      <span>{list?.total ? `${list.progress}%` : "→"}</span>
                    </span>
                    {Boolean(list?.total) && (
                      <progress max={100} value={list?.progress ?? 0} />
                    )}
                  </button>
                );
              })}
              <h2>À retrouver</h2>
              {!active.length &&
                tile(
                  profile?.role === "mentor"
                    ? "Mes accompagnements"
                    : "Mon accompagnement",
                  active.length
                    ? active.map((a) => a.partner_name).join(", ")
                    : "Trouve ton prochain binôme",
                  Inbox,
                  "pairs",
                  active.length,
                )}
              {tile(
                "Mes demandes",
                `${pending.length} en attente de réponse`,
                MessageCircle,
                "requests",
                pending.length,
              )}
              {tile(
                "Objectifs",
                "Continue ta progression",
                CheckCircle2,
                "tasks",
              )}
              {!active.length &&
                tile(
                  "Trouver mon binôme",
                  "Parcours les profils de la communauté",
                  Search,
                  "discover",
                )}
              {loading && <p role="status">Chargement…</p>}
            </>
          )}
          {screen === "profile" && (
            <>
              <button className="mobile-back" onClick={back}>
                <ChevronLeft size={18} />
                Retour
              </button>
              <div className="mobile-profile-hero">
                <div className="mobile-avatar">
                  {profile?.photo ? (
                    <img src={profile.photo} alt="Ta photo" />
                  ) : (
                    name.slice(0, 2)
                  )}
                  <button
                    aria-label="Modifier mon profil"
                    onClick={() => go("edit")}
                  >
                    <NotebookPen size={16} />
                  </button>
                </div>
                <h1>{name}</h1>
                <OwnerPlanBadge enabled={administrator} />
                <span className="mobile-role">
                  {profile?.role === "mentor" ? "Parrain" : "Débutant"}
                </span>
                <p>
                  <i className={profile?.visible ? "available-dot" : ""} />
                  {profile?.visible
                    ? "Visible dans l’annuaire"
                    : "Profil masqué"}
                </p>
              </div>
              <div className="profile-social-counts">
                <button onClick={() => openNetwork("followers")}>
                  <strong>{profile?.followerCount ?? 0}</strong>
                  <span>Abonnés</span>
                </button>
                <button onClick={() => openNetwork("following")}>
                  <strong>{profile?.followingCount ?? 0}</strong>
                  <span>Abonnements</span>
                </button>
              </div>
              {completionNeeded && (
                <button
                  className="profile-completion-card"
                  onClick={() => openSettings("verification")}
                >
                  <AlertCircle />
                  <span>
                    <strong>Finalise ton profil parrain</strong>
                    <small>
                      Présente ton parcours pour inspirer confiance.
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              )}
              {tile(
                "Mes profils enregistrés",
                extras ? `${bookmarks.length} membre(s)` : "En avant-première",
                Bookmark,
                "saved",
              )}
              {tile(
                "Mes demandes de message",
                "Retrouver mes conversations et invitations",
                MessageCircle,
                "messages",
              )}
              {tile(
                "Modifier mon profil",
                "Photo, présentation et spécialités",
                UserRound,
                "edit",
              )}
            </>
          )}
          {screen === "menu" && (
            <>
              <h1>Menu</h1>
              <label className="mobile-search">
                <Search size={18} />
                <input
                  type="search"
                  aria-label="Rechercher dans le menu"
                  placeholder="Rechercher un menu ou un paramètre"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </label>
              {menuGroups.map((group) => {
                const items = group.items.filter((item) =>
                  `\${item.label} \${item.keywords || ""}`.toLowerCase().includes(menuSearch.toLowerCase()),
                );
                return items.length ? (
                  <section className="mobile-menu-category" key={group.title}>
                    <h2>{group.title}</h2>
                    <div className="mobile-menu-grid">
                      {items.map((item) => (
                        <button key={item.label} onClick={() => openMenuItem(item)}>
                          <item.icon size={23} />
                          <span>{t(item.label)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null;
              })}
            </>
          )}
          {screen === "notifications" &&
            (extras ? (
              <>
                <div className="mobile-title">
                  <button
                    className="mobile-icon"
                    aria-label="Retour"
                    onClick={back}
                  >
                    <ChevronLeft />
                  </button>
                  <h1>Notifications</h1>
                </div>
                <div className="mobile-segments">
                  <button
                    className={!unreadOnly ? "selected" : ""}
                    onClick={() => setUnreadOnly(false)}
                  >
                    Tout
                  </button>
                  <button
                    className={unreadOnly ? "selected" : ""}
                    onClick={() => setUnreadOnly(true)}
                  >
                    Non lues ({notices.filter((n) => !n.read).length})
                  </button>
                </div>
                {notices
                  .filter((n) => !unreadOnly || !n.read)
                  .map((n) => (
                    <button
                      key={n.id}
                      className={`mobile-tile ${!n.read ? "unread" : ""}`}
                      onClick={async () => {
                        try {
                          await mobileApi("/api/mobile", {
                            action: "read",
                            ids: [n.id],
                          });
                          setNotices((v) =>
                            v.map((x) =>
                              x.id === n.id ? { ...x, read: true } : x,
                            ),
                          );
                          go(n.destination);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Bell />
                      <span>
                        <strong>{n.title}</strong>
                        <small>
                          {new Date(n.date).toLocaleString("fr-FR")}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                {!notices.length && <p>Aucune notification pour le moment.</p>}
              </>
            ) : (
              beta
            ))}
          {screen === "saved" &&
            (extras ? (
              <>
                <button className="mobile-back" onClick={back}>
                  <ChevronLeft size={18} />
                  Retour
                </button>
                <h1>Profils enregistrés</h1>
                {!bookmarks.length && (
                  <p>
                    Enregistre des profils depuis leur fiche pour les retrouver
                    ici.
                  </p>
                )}
                {bookmarks.map((p) => (
                  <div className="mobile-tile" key={p.id}>
                    <Bookmark />
                    <button
                      onClick={() => {
                        setScreen("discover");
                        onOpenProfile(p.id, p.role);
                      }}
                    >
                      {p.name}
                    </button>
                    <button
                      className="mobile-icon"
                      aria-label={`Retirer ${p.name}`}
                      onClick={async () => {
                        try {
                          await mobileApi("/api/mobile", {
                            action: "bookmark",
                            id: p.id,
                            saved: false,
                          });
                          void load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Bookmark fill="currentColor" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              beta
            ))}
          {screen === "community" &&
            (channel === null ? (
              <>
                <div className="mobile-room-note">
                  {profile?.role === "mentor"
                    ? "Entre parrains"
                    : "Entre débutants"}{" "}
                  · Ton espace d’entraide
                </div>
                <CommunityRooms
                  enabled={channels}
                  onSelect={setChannel}
                  onSettings={() => go("settings")}
                />
              </>
            ) : (
              <>
                <button
                  className="mobile-back"
                  onClick={() => setChannel(null)}
                >
                  <ChevronLeft size={18} />
                  Rubriques de la communauté
                </button>
                <Community
                  key={channel}
                  channel={channels ? channel : undefined}
                  onOpenProfile={(id, role) => {
                    go("discover");
                    onOpenProfile(id, role);
                  }}
                />
              </>
            ))}
          {screen === "messages" &&
            (dm ? (
              <PrivateMessages
                userId={userId}
                chatId={chat}
                setChatId={setChat}
                pairs={active}
                onProfile={(id, role) => {
                  go("discover");
                  onOpenProfile(id, role);
                }}
              />
            ) : (
              beta
            ))}
          {legacyMode && (
            <>
              <button className="mobile-back" onClick={back}>
                <ChevronLeft size={18} />
                Retour
              </button>
              {screen === "pairs" && (
                <>
                  <h1>
                    {profile?.role === "mentor"
                      ? "Mes accompagnements"
                      : "Mon accompagnement"}
                  </h1>
                  {active.map((pair) => {
                    const list = lists.find((l) => l.id === pair.id);
                    return (
                      <section key={pair.id} className="mobile-note">
                        <strong>{pair.partner_name}</strong>
                        <small className="mobile-subtitle">
                          {" "}
                          · Depuis le{" "}
                          {new Date(pair.created_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </small>
                        <button
                          className="mobile-pair-progress"
                          onClick={() => go("tasks")}
                        >
                          <span
                            className="mobile-progress-ring"
                            style={{
                              background: `conic-gradient(var(--purple) ${list?.progress || 0}%, var(--line) 0)`,
                            }}
                          >
                            <b>{list?.progress || 0}%</b>
                          </span>
                          <span>
                            <strong>
                              {list?.completed || 0}/{list?.total || 0}{" "}
                              objectifs
                            </strong>
                            <small>Voir la progression et les tâches</small>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                      </section>
                    );
                  })}
                </>
              )}
              {screen === "pairs" && (
                <div className="mobile-segments">
                  <button onClick={() => go("tasks")}>
                    Progression & tâches
                  </button>
                  {extras && (
                    <button onClick={() => go("notes")}>Notes partagées</button>
                  )}
                </div>
              )}
              {screen === "help" && (
                <section className="mobile-note">
                  <h2>Ton espace mobile</h2>
                  <p>
                    <strong>Accueil</strong> rassemble tes actions et ta
                    progression. <strong>Découvrir</strong> permet de chercher
                    un binôme et de retrouver tes demandes.
                  </p>
                  <p>
                    Dans <strong>Communauté</strong>, tu échanges uniquement
                    avec les membres de ton rôle. Les nouvelles rubriques, les
                    profils enregistrés, les notifications et les notes
                    partagées sont disponibles en bêta.
                  </p>
                  <p>
                    <strong>Messages</strong> permet aux bêta-testeurs de
                    discuter avec leurs binômes ou des contacts acceptés. Le
                    menu d’une conversation permet d’épingler, de bloquer ou de
                    signaler un membre.
                  </p>
                  <p>
                    Retrouve les réglages, l’aide et le programme bêta dans{" "}
                    <strong>Profil → Paramètres</strong>.
                  </p>
                </section>
              )}
              <div className="mobile-legacy">{legacy}</div>
              {screen === "discover" &&
                tile(
                  "Mes demandes",
                  `${pending.length} en attente`,
                  Inbox,
                  "requests",
                  pending.length,
                )}
            </>
          )}
          {screen === "notes" && (extras ? <PairNotes pairs={active} /> : beta)}
        </Content>
        {!desktopScreen && <nav className="mobile-app-dock" aria-label="Navigation mobile">
          {workspaceMain.map(({ screen: id, label, icon: Icon }) => (
            <button
              key={id}
              className={selected === id ? "selected" : ""}
              aria-current={selected === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={22} />
              {id === "community" && communityCount > 0 && (
                <b className="mobile-count dock-count">
                  {communityCount > 99 ? "99+" : communityCount}
                </b>
              )}
              <span>{t(label)}</span>
              {id === "community" && <small>Bêta</small>}
            </button>
          ))}
        </nav>}
      </div>
    </BookmarkContext.Provider>
  );
}
function PairNotes({ pairs }: { pairs: Row[] }) {
  const [selectedPair, setPair] = useState(""),
    [notes, setNotes] = useState<Row[]>([]),
    [body, setBody] = useState(""),
    [error, setError] = useState("");
  const pair = pairs.some((p) => p.id === selectedPair) ? selectedPair : pairs[0]?.id || "";
  useEffect(() => {
    if (pair)
      mobileApi("/api/mobile?pair=" + pair)
        .then((d) => setNotes(d.notes))
        .catch((e) => setError(e.message));
  }, [pair]);
  return (
    <>
      <h1>Notes partagées</h1>
      {!pairs.length ? (
        <p>Un binôme actif est nécessaire pour partager des notes.</p>
      ) : (
        <>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            aria-label="Choisir un binôme"
          >
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.partner_name}
              </option>
            ))}
          </select>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await mobileApi("/api/mobile", {
                  action: "note",
                  id: pair,
                  body,
                });
                setBody("");
                setNotes((await mobileApi("/api/mobile?pair=" + pair)).notes);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <textarea
              required
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Une note pour votre accompagnement…"
              aria-label="Note partagée"
            />
            <button className="btn" type="submit">
              Ajouter la note
            </button>
          </form>
          {notes.map((n) => (
            <article className="mobile-note" key={n.id}>
              <strong>{n.name}</strong>
              <p>{n.body}</p>
              <small>
                {new Date(n.created_at).toLocaleDateString("fr-FR")}
              </small>
            </article>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function PrivateMessages({
  userId,
  chatId,
  setChatId,
  pairs,
  onProfile,
}: {
  userId: string;
  chatId: string;
  setChatId: (s: string) => void;
  pairs: Row[];
  onProfile: (id: string, role: string) => void;
}) {
  const [chats, setChats] = useState<Row[]>([]),
    [messages, setMessages] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [canSend, setCanSend] = useState(false),
    [older, setOlder] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  const dmContainer = useRef<HTMLElement>(null);
  const bottom = useRef<HTMLDivElement>(null),
    feed = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    archived = useRef(false);
  useEffect(() => {
    if (!chatId) return;
    const app = dmContainer.current?.closest<HTMLElement>(".mobile-app");
    const baseline = window.innerHeight;
    const resize = () => {
      const v = window.visualViewport;
      const height = v?.height || window.innerHeight;
      document.body.classList.toggle(
        "private-keyboard",
        height < baseline - 120,
      );
      app?.style.setProperty("--mobile-visible-height", height + "px");
      app?.style.setProperty(
        "--mobile-visible-top",
        (v?.offsetTop || 0) + "px",
      );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      document.body.classList.remove("private-keyboard");
      app?.style.removeProperty("--mobile-visible-height");
      app?.style.removeProperty("--mobile-visible-top");
    };
  }, [chatId]);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const c = await mobileApi("/api/messages");
      if (ticket !== generation.current) return;
      setChats(c.chats);
      if (chatId && !archived.current) {
        const d = await mobileApi("/api/messages?chat=" + chatId);
        if (ticket !== generation.current) return;
        const near =
          !feed.current ||
          feed.current.scrollHeight -
            feed.current.scrollTop -
            feed.current.clientHeight <
            100;
        setMessages(d.messages);
        setCanSend(d.chat.canSend);
        setOlder(d.hasOlder);
        await mobileApi("/api/messages", { action: "read", id: chatId });
        if (near)
          requestAnimationFrame(() =>
            feed.current?.scrollTo({
              top: feed.current.scrollHeight,
              behavior: "instant",
            }),
          );
      }
      setError("");
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    }
  }, [chatId]);
  useEffect(() => {
    archived.current = false;
    setMessages([]);
    setMenu(false);
    setReport(false);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 7000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh]);
  const selected = chats.find((c) => c.id === chatId);
  async function action(action: string, value?: boolean) {
    try {
      await mobileApi("/api/messages", { action, id: chatId, value });
      setMenu(false);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (file) {
        const f = new FormData();
        f.set("chat", chatId);
        f.set("file", file);
        f.set("body", body);
        await mobileApi("/api/messages", f);
      } else
        await mobileApi("/api/messages", { action: "send", id: chatId, body });
      setBody("");
      const field = dmContainer.current?.querySelector("textarea");
      if (field) field.style.height = "40px";
      setFile(null);
      archived.current = false;
      await refresh();
      requestAnimationFrame(() =>
        feed.current?.scrollTo({
          top: feed.current.scrollHeight,
          behavior: "instant",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      ref={dmContainer}
      className={chatId ? "mobile-dm open" : "mobile-dm"}
    >
      {error && (
        <p role="alert" className="mobile-error">
          {error}
          <button onClick={() => void refresh()}>Réessayer</button>
        </p>
      )}
      {!chatId ? (
        <>
          <div className="mobile-segments">
            {[
              ["all", "Tous"],
              ["pairs", "Binômes"],
              ["others", "Autres"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "selected" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mobile-search">
            <Search size={17} />
            <input
              placeholder="Rechercher une conversation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {chats
            .filter(
              (c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) &&
                (filter === "all" ||
                  (filter === "pairs"
                    ? Number(c.is_pair)
                    : !Number(c.is_pair))),
            )
            .map((c) => (
              <button
                className="mobile-chat-row"
                key={c.id}
                onClick={() => setChatId(c.id)}
              >
                <span className="mobile-avatar small">
                  {c.photo ? (
                    <img src={"/api/profile-photo?id=" + c.profile_id} alt="" />
                  ) : (
                    c.name.slice(0, 1)
                  )}
                </span>
                <span>
                  <strong>
                    {c.name} {Number(c.pinned) ? "📌" : ""}
                  </strong>
                  <small>
                    {c.status === "pending"
                      ? "Demande de contact en attente"
                      : c.status === "declined"
                        ? "Demande refusée"
                        : c.last_body || "Commencer la discussion"}
                  </small>
                </span>
                {Number(c.unread) > 0 && (
                  <b className="mobile-count">{c.unread}</b>
                )}
              </button>
            ))}
          {pairs
            .filter(
              (p) =>
                filter !== "others" &&
                !chats.some((c) => c.profile_id === p.partner_profile_id) &&
                p.partner_name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((p) => (
              <button
                key={p.id}
                className="mobile-tile"
                onClick={async () => {
                  try {
                    const d = await mobileApi("/api/messages", {
                      action: "connect",
                      profileId: p.partner_profile_id,
                    });
                    setChatId(d.id);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Users />
                <span>
                  <strong>{p.partner_name}</strong>
                  <small>Ouvrir la discussion du binôme</small>
                </span>
                <ChevronRight />
              </button>
            ))}
          {!chats.length && !pairs.length && (
            <p>
              Retrouve ici tes binômes et tes contacts acceptés. Tu peux
              demander à contacter un membre depuis sa fiche.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mobile-dm-heading">
            <button
              className="mobile-icon"
              aria-label="Retour aux messages"
              onClick={() => setChatId("")}
            >
              <ChevronLeft />
            </button>
            {selected && (
              <button
                className="mobile-avatar small"
                aria-label="Voir le profil"
                onClick={() => onProfile(selected.profile_id, selected.role)}
              >
                {selected.photo ? (
                  <img
                    src={"/api/profile-photo?id=" + selected.profile_id}
                    alt=""
                  />
                ) : (
                  selected.name.slice(0, 1)
                )}
              </button>
            )}
            <strong>{selected?.name || "Conversation"}</strong>
            <button
              className="mobile-icon"
              aria-label="Options de conversation"
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal />
            </button>
          </div>
          {menu && selected && (
            <div className="mobile-chat-menu">
              <button
                onClick={() => onProfile(selected.profile_id, selected.role)}
              >
                <UserRound />
                Voir le profil
              </button>
              <button onClick={() => action("pin", !Number(selected.pinned))}>
                <Pin />
                {Number(selected.pinned)
                  ? "Désépingler"
                  : "Épingler la conversation"}
              </button>
              <button
                onClick={() =>
                  action(Number(selected.blocked) ? "unblock" : "block")
                }
              >
                <ShieldBan />
                {Number(selected.blocked) ? "Débloquer" : "Bloquer le membre"}
              </button>
              <button
                onClick={() => {
                  setReport(true);
                  setMenu(false);
                }}
              >
                <Flag />
                Signaler un problème
              </button>
            </div>
          )}
          {report && selected && (
            <form
              className="mobile-note"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await mobileApi("/api/reports", {
                    profileId: selected.profile_id,
                    reason: "Comportement inapproprié",
                    details: reason,
                  });
                  setReport(false);
                  setReason("");
                  setError("Signalement envoyé à l’administration.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <textarea
                required
                minLength={20}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Décrire le problème"
                placeholder="Décris le problème (20 caractères minimum)"
              />
              <button className="btn">Envoyer le signalement</button>
              <button type="button" onClick={() => setReport(false)}>
                Annuler
              </button>
            </form>
          )}
          {selected?.status === "pending" && (
            <div className="mobile-note">
              <p>
                {selected.requested_by === userId
                  ? "Ta demande de contact attend une réponse."
                  : "Ce membre souhaite discuter avec toi."}
              </p>
              {selected.requested_by !== userId && (
                <>
                  <button className="btn" onClick={() => action("accept")}>
                    Accepter
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => action("decline")}
                  >
                    Refuser
                  </button>
                </>
              )}
            </div>
          )}
          <div className="mobile-dm-feed" ref={feed}>
            {older && (
              <button
                onClick={async () => {
                  try {
                    const d = await mobileApi(
                      "/api/messages?chat=" +
                        chatId +
                        "&before=" +
                        messages[0].id,
                    );
                    archived.current = true;
                    setMessages((m) => [...d.messages, ...m]);
                    setOlder(d.hasOlder);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Messages précédents
              </button>
            )}
            {archived.current && (
              <button
                onClick={() => {
                  archived.current = false;
                  void refresh();
                }}
              >
                Revenir aux derniers messages
              </button>
            )}
            {messages.map((m) => (
              <article key={m.id} className={Number(m.mine) ? "mine" : ""}>
                {m.image === 1 && (
                  <img
                    src={"/api/messages?file=" + m.id}
                    alt="Image partagée"
                    loading="lazy"
                  />
                )}
                <p>{m.body}</p>
                <small>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </article>
            ))}
            <div ref={bottom} />
          </div>
          {canSend ? (
            <form className="mobile-dm-compose" onSubmit={send}>
              {file && (
                <button type="button" onClick={() => setFile(null)}>
                  {file.name} ×
                </button>
              )}
              <label className="mobile-icon" aria-label="Joindre une photo">
                <ImagePlus />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 4000000)
                      setError("Image trop volumineuse (4 Mo maximum).");
                    else setFile(f || null);
                  }}
                />
              </label>
              <textarea
                aria-label="Écrire un message"
                placeholder="Écrire un message…"
                rows={1}
                maxLength={3000}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  e.target.style.height = "40px";
                  e.target.style.height =
                    Math.min(88, e.target.scrollHeight) + "px";
                }}
              />
              <button
                className="mobile-send"
                onPointerDown={(e) => e.preventDefault()}
                disabled={busy || (!body.trim() && !file)}
                aria-label="Envoyer le message"
              >
                <Send size={19} />
              </button>
            </form>
          ) : (
            <p className="mobile-subtitle">
              L’envoi est indisponible tant que le contact n’est pas accepté ou
              qu’un blocage est actif.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function CommunityRooms({
  enabled,
  onSelect,
  onSettings,
}: {
  enabled: boolean;
  onSelect: (id: string) => void;
  onSettings: () => void;
}) {
  const [rooms, setRooms] = useState<Row[]>([]),
    [admin, setAdmin] = useState(false),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      mobileApi("/api/community?channels=1")
        .then((d) => {
          setRooms(
            d.channels.map((c: Row) => ({
              ...c,
              unread: d.counts?.find((n: Row) => n.id === c.id)?.unread || 0,
            })),
          );
          setAdmin(d.canManage);
        })
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [load]);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {rooms.map((room) => (
        <button
          key={room.id}
          className="mobile-tile"
          onClick={() =>
            enabled || room.id === "general" ? onSelect(room.id) : onSettings()
          }
        >
          {room.id === "questions" ? (
            <CircleHelp />
          ) : room.id === "presentations" ? (
            <Hand />
          ) : (
            <MessageCircle />
          )}
          <span>
            <strong>{room.name}</strong>
            <small>{room.description}</small>
          </span>
          {Number(room.unread) > 0 && (
            <b className="mobile-count">
              {Number(room.unread) > 99 ? "99+" : room.unread}
            </b>
          )}
          {!enabled && room.id !== "general" ? (
            <small>Bêta</small>
          ) : (
            <ChevronRight />
          )}
        </button>
      ))}
      {admin && (
        <button className="btn secondary" onClick={() => setAdding(!adding)}>
          <Plus size={18} />
          Ajouter un salon
        </button>
      )}
      {admin && adding && (
        <form
          className="mobile-note"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await mobileApi("/api/community", {
                action: "createChannel",
                name,
                description,
              });
              setName("");
              setDescription("");
              setAdding(false);
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nom du salon
            <input
              required
              minLength={2}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Description
            <input
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p>Ce salon sera proposé séparément aux parrains et aux débutants.</p>
          <button className="btn" disabled={busy}>
            Créer le salon
          </button>
        </form>
      )}
    </>
  );
}
