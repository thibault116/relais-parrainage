"use client";
import {currentProfileSections} from "@/lib/profile-modern";
import {MentorProfileCard} from "./components/mentor-profile";
import {useScreenMotion} from "./components/motion-system";
import { PrivateServiceCatalog, PrivateServiceRequests } from "./components/private-services";
import { useOwnerPreview } from "./components/owner-preview";
import { PricingPreview } from "./components/pricing-preview";
import { LegalLinks } from "./components/legal-links";
import { OwnerPlanBadge } from "./components/owner-billing";
import { PublicLanding, PublicFAQ, HowMentoraWorks } from "./components/public-home";
import {
  MobileExperience,
  MobileProfileActions, ProfileBookmarkScope,
} from "./components/mobile-experience";
import { useFeature, BetaSettings } from "./components/beta";
import { OnboardingSummary } from "./components/onboarding-summary";
import { ProfileForm as NewProfileForm } from "./components/intake-journey";
import { t as translateUi } from "@/app/components/language";
import { BrandLogo } from "./components/brand-logo";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Users,
  MessageCircle,
  Sparkles,
  Check,
  CheckCheck,
  Search,
  X,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  ChevronDown,
  LogOut,
  Compass,
  Sprout,
  ShieldCheck,
  Copy,
  ChevronLeft,
  SlidersHorizontal,
  LoaderCircle,
  CircleHelp,
  Menu,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  initialProfile,
  specialties,
  times,
  profileExperienceLabel,
  type Profile,
  type ProfileInput,
  type PublicProfile,
} from "@/lib/profile";
import { discoveryFilters, discoveryTags } from "@/lib/profile-discovery";
import {
  Accompaniments,
  RatingSummary,
  RequestAccompaniment,
} from "./components/accompaniments";
import { MentorPortfolio } from "./components/mentor-portfolio";
import { VerificationBadge } from "./components/verification";
import { AdminDashboard, ReportProfile } from "./components/admin";
import { Avatar, ProfilePhoto } from "./components/profile-photo";
import { Help } from "./components/help";
import {
  FollowButton,
  FollowCounts,
  FollowNetwork,
} from "./components/follows";
import { InstallMentora } from "./components/pwa";
import { detachPush } from "@/lib/push-client";
import { MemberSettings } from "./components/member-settings";
import {
  AvailabilityBadge,
  ProfileDates,
  ActivityTracker,
} from "./components/profile-dates";
import { usePlatformSettings } from "./components/platform-settings";
type View =
  | "home"
  | "directory"
  | "guide"
  | "faq"
  | "profile"
  | "moderation"
  | "help"
  | "menu"
  | "community"
  | "workspace"
  | "pricing";
const views: Record<View, string> = {
  workspace: "Mon espace",
  pricing: "Tarifs",
  community: "Communauté",
  menu: "Menu",
  help: "Aide",
  home: "Accueil",
  directory: "Trouver mon binôme",
  guide: "Comment ça marche",
  faq: "FAQ",
  profile: "Mon profil",
  moderation: "Administration",
};
const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="icon-box">{translateUi(children)}</span>
);
const Button = ({
  children,
  onClick,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) => (
  <button className={`btn ${secondary ? "secondary" : ""}`} onClick={onClick}>
    {translateUi(children)}
  </button>
);
async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Une erreur est survenue. Réessaie.");
  return data;
}
import { TodoLists } from "./components/todo-lists";
import { WorkspaceNav } from "./components/workspace-nav";
import {
  desktopExperienceScreens, memberScreen, workspaceRoutes, type WorkspaceTarget,
} from "./components/workspace-destinations";
export default function App() {
  const ownerPreview = useOwnerPreview();
  const { discordUrl: DISCORD_GROUP } = usePlatformSettings();
  const [requestedView, setView] = useState<View>("home");
  const [mobile, setMobile] = useState(false);
  const [phoneLayout, setPhoneLayout] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setPhoneLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const { data: session, isPending } = authClient.useSession();
  const [moderator, setModerator] = useState(false);
  const [previewRole, setPreviewRole] = useState<"mentor" | "beginner" | null>(
    null,
  );
  const preview = moderator ? previewRole : null;
  const showAdmin = moderator && !preview;
  const owner = showAdmin &&
    session?.user.email.toLowerCase() === "thibault.cordiez@hotmail.com";
  const [moderationBlock, setModerationBlock] = useState<string | null>(null);
  const pricingPreview = ownerPreview && owner;
  const publicView = ["home", "guide", "faq", "help", "pricing"].includes(requestedView);
  const view: View = publicView
    ? requestedView === "pricing" && !pricingPreview ? "home" : requestedView
    : session
      ? requestedView === "moderation" && !showAdmin
        ? "directory"
        : requestedView
      : "home";
  const inWorkspace =
    !!session &&
    [
      "directory",
      "profile",
      "moderation",
      "workspace",
      "faq",
      "help",
      "menu",
      "community",
    ].includes(view);
  const navigation: View[] =
    inWorkspace && session
      ? showAdmin
        ? ["directory", "profile", "moderation", "help"]
        : ["directory", "profile", "help"]
      : pricingPreview ? ["home", "guide", "faq", "help", "pricing"] : ["home", "guide", "faq", "help"];
  const [requiresQuestionnaire, setRequiresQuestionnaire] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [savedProfile, setProfile] = useState<Profile | null>(null);
  const profile =
    savedProfile && preview ? { ...savedProfile, role: preview } : savedProfile;
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  useEffect(() => {
    const login = () => setAuthMode("login");
    if (new URLSearchParams(window.location.search).get("connexion") === "1") {
      login();
      const url = new URL(window.location.href);
      url.searchParams.delete("connexion");
      window.history.replaceState({}, "", url);
    }
    window.addEventListener("mentora-login", login);
    return () => window.removeEventListener("mentora-login", login);
  }, []);
  const [focusMember, setFocusMember] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState<"mentor" | "beginner">("beginner");
  useEffect(()=>{if(authMode==="signup")window.location.assign("/inscription");},[authMode]);
  const [settingsSection, setSettingsSection] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("settingsSection") ||
        "general"
      : "general",
  );
  const [profileTab, setProfileTab] = useState("accompaniments");
  const [adminTab, setAdminTab] = useState("overview");
  const [desktopScreen, setDesktopScreen] = useState("home");
  const [desktopChat, setDesktopChat] = useState("");
  const activeDesktopScreen =
    view === "workspace" ? desktopScreen :
    view === "directory" ? "home" :
    view === "moderation" ? "admin" :
    view === "profile" ?
      ({ appearance: "settings", verification: "settings", emails: "settings",
         accompaniments: "pairs" }[profileTab] || profileTab) :
    view;
  const motionMain=useRef<HTMLElement>(null);useScreenMotion(motionMain,`${view}:${activeDesktopScreen}:${profileTab}:${settingsSection}:${adminTab}`,view==="community");
  const openDesktop = useCallback((item: WorkspaceTarget, params: Record<string, string> = {}) => {
    const screen = memberScreen(item.screen, params.services);
    const route = workspaceRoutes[screen];
    const next = (route?.[0] || (screen === "community" || screen === "menu" ? screen : "workspace")) as View;
    const url = new URL(window.location.href);
    for (const key of ["mobile", "chat", "profileTab", "settingsSection", "adminTab", "network", "member", "guide", "services", "service"]) url.searchParams.delete(key);
    url.searchParams.set("mobile", screen);
    if (route?.[1]) url.searchParams.set("profileTab", route[1]);
    if (item.settingsSection) url.searchParams.set("settingsSection", item.settingsSection);
    if (item.adminTab) url.searchParams.set("adminTab", item.adminTab);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.hash = next;
    if (url.href !== window.location.href)
      window.history.pushState({ mentoraDepth: (window.history.state?.mentoraDepth || 0) + 1 }, "", url);
    setDesktopScreen(screen);
    setDesktopChat(params.chat || "");
    if (route?.[1]) setProfileTab(route[1]);
    if (item.settingsSection) setSettingsSection(item.settingsSection);
    if (item.adminTab) setAdminTab(item.adminTab);
    if (next === "directory") setFocusMember(null);
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const navigateMobile = useCallback((next: string, tab?: string, section?: string) => {
    if (next === "profile" && tab === "appearance")
      setSettingsSection(section || "general");
    setView(next as View);
    if (next === "directory") setFocusMember(null);
    if (tab && next === "moderation") setAdminTab(tab);
    else if (tab) setProfileTab(tab);
  }, []);
  const selectedProfileTab =
    profileTab === "verification" || profileTab === "emails"
      ? "appearance"
      : profileTab;
  const [toast, setToast] = useState("");
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const go = (next: View) => {
    if (
      !session &&
      (next === "directory" ||
        next === "profile" ||
        next === "menu" ||
        next === "community")
    ) {
      setAuthMode("signup");
      return;
    }
    if (next === "directory") setFocusMember(null);
    setView(next);
    setMobile(false);
    const hash = next === "pricing" ? "tarifs" : next;
    const url = new URL(window.location.href);
    if (!phoneLayout) {
      for (const key of ["mobile", "chat", "profileTab", "settingsSection", "adminTab", "network", "member", "guide"])
        url.searchParams.delete(key);
      url.hash = hash;
      if (url.href !== window.location.href)
        window.history.pushState({ mentoraDepth: (window.history.state?.mentoraDepth || 0) + 1 }, "", url);
    } else {
      window.location.hash = hash;
    }
    window.scrollTo({
      top: 0,
      behavior:
        window.matchMedia("(max-width: 900px)").matches ||
        document.documentElement.dataset.reduceMotion === "true"
          ? "instant"
          : "smooth",
    });
  };
  useEffect(() => {
    const read = () => {
      const fragment = window.location.hash.slice(1);
      const hash = fragment === "tarifs" ? "pricing" : fragment;
      const params = new URLSearchParams(window.location.search);
      const screen = memberScreen(params.get("mobile") || "", params.get("services") || "");
      const desktop = !window.matchMedia("(max-width: 900px)").matches;
      const auxiliary = desktop && desktopExperienceScreens.has(screen) &&
        (hash === "workspace" || hash === "profile" || (screen === "community" && hash === "community"));
      setView((!screen && hash === "workspace") || (screen === "home" && ["profile","workspace","directory"].includes(hash)) ? "directory" : screen === "marketplace" ? "workspace" : auxiliary && screen !== "community" ? "workspace" :
        Object.hasOwn(views, hash) ? (hash as View) : "home");
      setDesktopScreen(auxiliary || screen === "marketplace" ? screen : "home");
      setDesktopChat(params.get("chat") || "");
      const tab = params.get("profileTab");
      if (tab && ["verification", "following", "edit", "accompaniments", "requests", "emails", "appearance", "tasks"].includes(tab))
        setProfileTab(tab);
      else if (desktop && hash === "profile" && !auxiliary) setProfileTab("accompaniments");
      const section = params.get("settingsSection") || "general";
      setSettingsSection(["general", "security", "notifications", "verification"].includes(section) ? section : "general");
      const admin = params.get("adminTab");
      if (admin && ["overview", "accounts", "verification", "reports", "ratings", "suggestions", "emails", "settings", "crm", "extension", "changelog", "withdrawals", "tickets", "ambassadors"].includes(admin))
        setAdminTab(admin);
      else if (desktop && hash === "moderation") setAdminTab("overview");
    };
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);
  useEffect(() => {
    if (phoneLayout || !session) return;
    const open = (event: Event) => {
      const { screen, chat } = (event as CustomEvent<{ screen: string; chat?: string }>).detail;
      if (screen === "messages")
        openDesktop({ screen }, chat ? { chat } : {});
    };
    window.addEventListener("mentora-mobile", open);
    return () => window.removeEventListener("mentora-mobile", open);
  }, [phoneLayout, session, openDesktop]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isPending) return;
    if (
      !session &&
      (params.has("profileTab") ||
        params.has("member") ||
        ["#community", "#workspace"].includes(window.location.hash))
    ) {
      setAuthMode("login");
      return;
    }
    const member = params.get("member");
    if (!session || !member) return;
    let alive = true;
    void api(`/api/profiles?profile=${encodeURIComponent(member)}`)
      .then((data) => {
        if (alive) {
          setFocusMember(data.profile);
          setView("directory");
        }
      })
      .catch(() => {
        if (alive)
          setToast(
            "Ce profil n’est plus disponible. Retrouve les autres parrains dans l’annuaire.",
          );
      });
    return () => {
      alive = false;
    };
  }, [session, isPending]);
  const loadMe = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const data = await api("/api/me");
      setProfile(data.profile);
      setRequiresQuestionnaire(!!data.requiresQuestionnaire);
      setProfileChecked(true);
      setModerator(!!data.isModerator);
      setModerationBlock(data.moderationBlock);
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileLoading(false);
    }
  }, []);
  useEffect(() => {
    if (session) void loadMe();
    else {
      setProfile(null);
      setProfileChecked(false);
      setRequiresQuestionnaire(false);
      setModerator(false);
      setPreviewRole(null);
    }
  }, [session, loadMe]);
  const refreshProfile = useCallback(async () => {
    setProfile((await api("/api/me")).profile);
  }, []);
  const join = (r: "mentor" | "beginner") => {
    setRole(r);
    if (session) {
      go("profile");
      setProfileTab("edit");
    } else setAuthMode("signup");
  };
  async function visibility() {
    if (!profile) return;
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ visible: !profile.visible }),
      });
      setProfile({ ...profile, visible: !profile.visible });
      notify(
        profile.visible
          ? "Ton profil est masqué dans tout l’annuaire."
          : "Ton profil est à nouveau visible.",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const legacy = (
    <div className={inWorkspace ? "workspace-shell" : "public-shell"}>
      <ActivityTracker userId={session?.user.id} />
      {inWorkspace && session ? (
        !phoneLayout && <WorkspaceNav
          screen={activeDesktopScreen}
          settingsSection={profileTab === "verification" ? "verification" : profileTab === "emails" ? "notifications" : settingsSection}
          adminTab={adminTab}
          mentor={profile?.role === "mentor"}
          moderator={showAdmin}
          owner={owner}
          name={session.user.name}
          photo={profile?.photo}
          discordUrl={DISCORD_GROUP}
          onNavigate={openDesktop}
          onPublicHome={() => go("home")}
          onSignOut={() => {
            void detachPush()
              .then(() => authClient.signOut())
              .then(() => go("home"));
          }}
        />
      ) : (
        <header className="header">
          <div className="nav-wrap">
            <a
              href="#home"
              className="brand"
              aria-label={translateUi("Mentora, accueil")}
              onClick={() => go("home")}
            >
              <span className="brand-mark">
                <BrandLogo />
              </span>
              {translateUi("mentora")}
              <span className="brand-dot">.</span>
              <OwnerPlanBadge
                enabled={
                  !!session &&
                  showAdmin &&
                  session.user.email.toLowerCase() ===
                    "thibault.cordiez@hotmail.com"
                }
              />
            </a>
            <nav
              id="main-navigation"
              aria-label={translateUi("Navigation principale")}
              className={mobile ? "open" : ""}
            >
              {navigation.map((v) => (
                <button
                  key={v}
                  onClick={() => go(v)}
                  className={view === v ? "active" : ""}
                >
                  {translateUi(views[v])}
                </button>
              ))}
              {!session && (
                <button
                  className="mobile-menu-login"
                  onClick={() => {
                    setMobile(false);
                    setAuthMode("login");
                  }}
                >
                  {translateUi("Se connecter")}
                </button>
              )}
            </nav>
            <div className="nav-actions">
              <a
                className="discord-nav"
                aria-label={translateUi("Rejoindre le groupe Discord")}
                href={DISCORD_GROUP}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} />
                <span>{translateUi("Notre Discord")}</span>
              </a>
              {session ? (
                <button
                  className="account"
                  onClick={() => go(inWorkspace ? "profile" : "directory")}
                >
                  <span className="avatar small">
                    {session.user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    {translateUi(inWorkspace ? "Mon profil" : "Mon espace")}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    className="login-link"
                    onClick={() => setAuthMode("login")}
                  >
                    {translateUi("Se connecter")}
                  </button>
                  <button
                    className="btn small-btn"
                    onClick={() => join("beginner")}
                  >
                    {translateUi("Rejoindre ")}
                    <ArrowUpRight size={16} />
                  </button>
                </>
              )}
              <button
                className="mobile-toggle"
                aria-label={translateUi(
                  mobile ? "Fermer le menu" : "Ouvrir le menu",
                )}
                aria-controls="main-navigation"
                aria-expanded={mobile}
                onClick={() => setMobile(!mobile)}
              >
                {mobile ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </header>
      )}
      <main id="workspace-content" ref={motionMain}>
        {!phoneLayout && session && ["workspace", "menu", "community"].includes(view) && (
          <section className="wrap desktop-workspace-content" inert={!!preview}>
            <MobileExperience
              desktopScreen={activeDesktopScreen}
              desktopChat={desktopChat}
              onDesktopNavigate={openDesktop}
              administrator={owner}
              moderator={showAdmin}
              discordUrl={DISCORD_GROUP}
              profile={profile}
              name={session.user.name}
              userId={session.user.id}
              view={view}
              profileTab={selectedProfileTab}
              onOpenProfile={async (id, memberRole) => {
                try {
                  const data = await api(`/api/profiles?role=${memberRole}&profile=${encodeURIComponent(id)}`);
                  openDesktop({screen:"home"});
                  setFocusMember(data.profile);
                } catch (error) {
                  notify((error as Error).message);
                }
              }}
            />
          </section>
        )}

        {preview && (
          <aside className="role-preview-banner" role="status">
            <div>
              <strong>
                {translateUi("Aper\u00E7u ")}
                {translateUi(preview === "mentor" ? "parrain" : "débutant")}
              </strong>
              <p>
                {translateUi(
                  "Navigation du r\u00F4le choisi \u00B7 donn\u00E9es de ton compte \u00B7 profils en lecture seule.",
                )}
              </p>
            </div>
            <div className="role-preview-actions">
              <button
                className="btn secondary small-btn"
                onClick={() => {
                  setPreviewRole(preview === "mentor" ? "beginner" : "mentor");
                  setProfileTab("edit");
                }}
              >
                {translateUi("Voir comme un ")}
                {translateUi(preview === "mentor" ? "débutant" : "parrain")}
              </button>
              <button
                className="btn small-btn"
                onClick={() => {
                  setPreviewRole(null);
                  setAdminTab("overview");
                  go("moderation");
                }}
              >
                {translateUi("Revenir \u00E0 l\u2019administration")}
              </button>
            </div>
          </aside>
        )}

        {!isPending && session && showAdmin && view === "moderation" && (
          <AdminDashboard
            dedicated
            crmOwner={
              session.user.email.toLowerCase() ===
              "thibault.cordiez@hotmail.com"
            }
            tab={adminTab}
            setTab={setAdminTab}
            onPreview={(role) => {
              setPreviewRole(role);
              setProfileTab("edit");
              go("directory");
            }}
          />
        )}
        {isPending && view !== "home" && (
          <div className="empty">
            <LoaderCircle className="spin" />
            {translateUi(" Chargement\u2026")}
          </div>
        )}
        {view === "home" && <PublicLanding onJoin={join} discordUrl={DISCORD_GROUP} onOpen={(screen,slug)=>{
          const target=screen==='services'?'marketplace':screen;
          const params:Record<string,string>={...(screen==='services'?{services:'1'}:{}),...(slug?{guide:slug}:{})};
          if(session){openDesktop({screen:target},params);return;}
          const url=new URL(window.location.href);url.search='';url.searchParams.set('mobile',target);Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));const route=workspaceRoutes[target];if(route?.[1])url.searchParams.set('profileTab',route[1]);url.hash=route?.[0]||(target==='community'?'community':'workspace');window.history.pushState({},'',url);setAuthMode('login');
        }}/>}
        {!isPending && session && view === "directory" && (
          <Directory
            key={preview || "normal"}
            preview={!!preview}
            privateServices={!!session}
            session={!!session}
            onFollowChange={refreshProfile}
            initialTarget={focusMember}
            own={profile}
            onJoin={() => setAuthMode("signup")}
            onProfile={() => go("profile")}
            notify={notify}
          />
        )}
        {pricingPreview && view === "pricing" && <PricingPreview />}
        {!isPending && view === "help" && <Help privatePayouts={owner} />}
        {!isPending && view === "guide" && (
          <Guide onJoin={() => join("beginner")} />
        )}
        {!isPending && view === "faq" && (
          <section className="wrap guide">
            <div className="page-heading">
              <h1>{translateUi("Tes questions, nos r\u00E9ponses.")}</h1>
            </div>
            <FAQ />
          </section>
        )}
        {!isPending && session && view === "profile" && (
          <section
            className="wrap profile-page"
            data-profile-tab={selectedProfileTab}
            inert={!!preview}
          >
            <div className="page-heading">
              <span className="eyebrow">{translateUi("TON ESPACE")}</span>
              <h1>
                {translateUi(
                  selectedProfileTab === "appearance"
                    ? "Paramètres"
                    : "Mon profil",
                )}
                <span>.</span>
              </h1>
              <p>
                {translateUi(
                  selectedProfileTab === "appearance"
                    ? "Gère ta langue, ton affichage, ta sécurité et tes notifications."
                    : "Pr\u00E9sente ton activit\u00E9 de revente et retrouve tes bin\u00F4mes et ton r\u00E9seau.",
                )}
              </p>
            </div>
            {!phoneLayout && ["accompaniments", "requests", "tasks", "following"].includes(selectedProfileTab) && (
              <h1 className="compact-page-title">{translateUi(
                selectedProfileTab === "accompaniments" ? "Accompagnements en cours" :
                selectedProfileTab === "requests" ? "Demandes" :
                selectedProfileTab === "following" ? "Abonnés et abonnements" :
                profile?.role === "mentor" ? "Objectifs à atteindre" : "Mes objectifs",
              )}</h1>
            )}
            {translateUi(
              moderationBlock && (
                <p className="error" role="alert">
                  {translateUi(
                    "Ton profil est masqu\u00E9 par la mod\u00E9ration : ",
                  )}
                  {translateUi(moderationBlock)}
                </p>
              ),
            )}
            {isPending || profileLoading ? (
              <div className="empty">
                <LoaderCircle className="spin" />
                {translateUi(" Chargement de ton profil\u2026")}
              </div>
            ) : !session ? (
              <div className="empty">
                <Icon>
                  <Users />
                </Icon>
                <h2>{translateUi("Ton histoire commence ici.")}</h2>
                <p>
                  {translateUi(
                    "Cr\u00E9e ton profil pour rencontrer les membres et partager vos pseudos Discord.",
                  )}
                </p>
                <Button onClick={() => setAuthMode("signup")}>
                  {translateUi("Cr\u00E9er mon compte ")}
                  <ArrowRight size={18} />
                </Button>
                <button
                  className="text-btn"
                  onClick={() => setAuthMode("login")}
                >
                  {translateUi("J\u2019ai d\u00E9j\u00E0 un compte")}
                </button>
              </div>
            ) : selectedProfileTab === "appearance" ? (
              <MemberSettings
                dedicated
                mentor={profile?.role === "mentor"}
                onVerificationChange={refreshProfile}
                key={`settings-${profileTab}-${settingsSection}`}
                initialSection={
                  profileTab === "verification"
                    ? "verification"
                    : profileTab === "emails"
                      ? "notifications"
                      : settingsSection
                }
              />
            ) : profileError ? (
              <div className="empty">
                <p role="alert">{translateUi(profileError)}</p>
                <Button onClick={() => void loadMe()}>
                  {translateUi("R\u00E9essayer")}
                </Button>
              </div>
            ) : !profile ? (
              <ProfileForm
                key={session.user.id}
                onLogin={() => setAuthMode("login")}
                initial={{
                  ...initialProfile,
                  name: session.user.name,
                  role,
                  experience: role === "mentor" ? 6 : 0,
                }}
                onSave={(p) => {
                  setProfile(p);
                  void refreshProfile();
                  notify("Ton profil est enregistré. Bienvenue dans Mentora !");
                }}
              />
            ) : (
              <>
                {selectedProfileTab === "edit" && (
                  <div className="profile-title-row">
                    <h1 className="compact-page-title">
                      {translateUi("Mon profil")}
                    </h1>
                    <OwnerPlanBadge
                      enabled={
                        showAdmin &&
                        session.user.email.toLowerCase() ===
                          "thibault.cordiez@hotmail.com"
                      }
                    />
                    <button
                      className="btn secondary"
                      aria-label={translateUi("Paramètres")}
                      onClick={() => {
                        if (phoneLayout) setProfileTab("appearance");
                        else openDesktop({ screen: "settings", settingsSection: "general" });
                      }}
                    >
                      <Settings size={22} />
                    </button>
                  </div>
                )}

                {selectedProfileTab === "edit" && (
                  <div className="profile-toolbar">
                    <span className={`badge ${profile.visible ? "green" : ""}`}>
                      {profile.visible ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}{" "}
                      {translateUi(
                        profile.visible
                          ? "Visible dans l’annuaire"
                          : "Profil masqué",
                      )}
                    </span>
                    <button
                      className="text-btn muted"
                      onClick={async () => {
                        await detachPush();
                        await authClient.signOut();
                        go("home");
                      }}
                    >
                      <LogOut size={16} />
                      {translateUi(" Se d\u00E9connecter")}
                    </button>
                  </div>
                )}
                <div className="profile-tab-content">
                  {selectedProfileTab === "tasks" && <TodoLists />}
                  {selectedProfileTab === "edit" && (
                    <>
                      <ProfilePhoto
                        profile={profile}
                        onChange={refreshProfile}
                      />
                      <ProfileForm
                        key={profile.id}
                        onLogin={() => setAuthMode("login")}
                        initial={{ ...profile, consent: true }}
                        onCancel={() => {
                          setProfileTab("accompaniments");
                        }}
                        onSave={(p) => {
                          setProfile(p);
                          void refreshProfile();
                          notify(
                            "Les modifications de ton profil sont enregistrées.",
                          );
                        }}
                      />
                      <div className="profile-foot">
                        <button
                          className="btn secondary"
                          onClick={() => void visibility()}
                        >
                          {profile.visible ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                          {translateUi(
                            profile.visible
                              ? "Masquer mon profil"
                              : "Rendre mon profil visible",
                          )}
                        </button>
                        <DeleteProfile
                          onDeleted={() => {
                            setProfile(null);
                            notify(
                              "Ton profil est supprimé. Ton compte reste disponible.",
                            );
                          }}
                        />
                      </div>
                      <p className="small-text">
                        {translateUi(
                          "Un profil masqu\u00E9 dispara\u00EEt de l\u2019annuaire. Les contacts d\u00E9j\u00E0 \u00E9chang\u00E9s sur Discord restent disponibles.",
                        )}
                      </p>
                    </>
                  )}
                  {selectedProfileTab === "following" && (
                    <FollowNetwork
                      onChange={refreshProfile}
                      onOpen={(p) => {
                        go("directory");
                        setFocusMember(p);
                      }}
                    />
                  )}
                  {(selectedProfileTab === "accompaniments" ||
                    selectedProfileTab === "requests") && (
                    selectedProfileTab==="requests" ? <PrivateServiceRequests><Accompaniments key={selectedProfileTab} mode={selectedProfileTab} onChange={refreshProfile}/></PrivateServiceRequests> : <Accompaniments key={selectedProfileTab} mode={selectedProfileTab} onChange={refreshProfile}/>
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {!isPending &&
          inWorkspace &&
          !["menu", "community", "workspace"].includes(view) && (
            <aside className="member-discord">
              <MessageCircle size={25} />
              <div>
                <strong>
                  {translateUi("Retrouve la communaut\u00E9 sur Discord")}
                </strong>
                <p>
                  {translateUi(
                    "\u00C9change avec d\u2019autres revendeurs et continue la discussion avec ton bin\u00F4me.",
                  )}
                </p>
              </div>
              <a
                className="btn secondary"
                href={DISCORD_GROUP}
                target="_blank"
                rel="noopener noreferrer"
              >
                {translateUi("Rejoindre Discord ")}
                <ArrowUpRight size={18} />
              </a>
            </aside>
          )}
      </main>
      {!inWorkspace && !isPending && (
        <>
          {view !== "home" && <>
          <section className="wrap discord-community">
            <div>
              <span className="eyebrow">
                {translateUi("ON SE RETROUVE SUR DISCORD")}
              </span>
              <h2>{translateUi("La communaut\u00E9 t\u2019attend.")}</h2>
              <p>
                {translateUi(
                  "Rejoins le groupe pour \u00E9changer avec les membres et retrouver ton bin\u00F4me.",
                )}
              </p>
            </div>
            <a
              className="btn"
              href={DISCORD_GROUP}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={19} />
              {translateUi(" Rejoindre le groupe Discord")}{" "}
              <ArrowUpRight size={17} />
            </a>
          </section>
          </>}
          <footer className="footer wrap">
            <InstallMentora />
            <a className="brand" href="#home" onClick={() => go("home")}>
              <span className="brand-mark">
                <BrandLogo />
              </span>
              {translateUi("mentora")}
              <span className="brand-dot">.</span>
            </a>
            <p>{translateUi("On avance mieux ensemble.")}</p>
            <button onClick={() => go("guide")}>
              {translateUi("Comment ça marche")}
            </button>
            <span>
              {translateUi("Une initiative ind\u00E9pendante, entre membres.")}
            </span>
            <a className="footer-free-guides" href="/?mobile=guides#workspace">{translateUi("4 guides gratuits")}</a>
            <LegalLinks />
            {view==="home"&&<p className="landing-footer-disclosure">{translateUi("Crédits achetés séparément, sans abonnement. Les prestations sont distinctes des guides gratuits. Aucun résultat de vente n’est garanti.")}</p>}
          </footer>
        </>
      )}
      {authMode === "login" && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          role={role}
          setRole={setRole}
          close={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            const params = new URLSearchParams(window.location.search);
            if(params.has("reprendreInscription")){window.location.assign(`/inscription?role=${params.get("reprendreInscription")==="mentor"?"mentor":"beginner"}`);return;}
            const requestedScreen = params.get("mobile") || "";
            if (authMode === "login" && (workspaceRoutes[requestedScreen] || desktopExperienceScreens.has(requestedScreen))) {
              const retained: Record<string, string> = {};
              for (const key of ["services", "guide", "chat", "network", "service"]) {
                const value = params.get(key);
                if (value) retained[key] = value;
              }
              openDesktop({ screen: requestedScreen }, retained);
              return;
            }
            const target =
              params.has("profileTab")
                ? "profile"
                : window.location.hash === "#workspace"
                  ? "workspace"
                  : "directory";
            setView(target);
            window.location.hash = target;
          }}
        />
      )}
      {translateUi(
        toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {translateUi(toast)}
            <button
              onClick={() => setToast("")}
              aria-label={translateUi("Fermer la notification")}
            >
              <X size={15} />
            </button>
          </div>
        ),
      )}
    </div>
  );
  if (session && !profileChecked)
    return (
      <main className="wrap mandatory-questionnaire">
        <p role="status">{profileError || "Chargement de ton profil…"}</p>
        {profileError && (
          <button className="btn" onClick={() => void loadMe()}>
            Réessayer
          </button>
        )}
      </main>
    );
  if (session && savedProfile && requiresQuestionnaire)
    return (
      <main className="wrap mandatory-questionnaire">
        <div className="mobile-note">
          <h1>Actualise ton questionnaire</h1>
          <p>
            Le questionnaire Mentora a évolué. Vérifie et complète tes réponses
            pour continuer à utiliser ton compte. Tes informations déjà connues
            sont préremplies.
          </p>
        </div>
        <NewProfileForm
          key={session.user.id}
          initial={{ ...savedProfile, consent: true }}
          requiredRefresh
          onLogin={() => {}}
          onSave={(p) => {
            setProfile(p);
            setRequiresQuestionnaire(false);
            go("profile");
          }}
        />
        <button className="text-btn" onClick={() => void authClient.signOut()}>
          Se déconnecter
        </button>
      </main>
    );
  return phoneLayout && inWorkspace && session ? (
    <MobileExperience
      administrator={owner}
      moderator={showAdmin}
      discordUrl={DISCORD_GROUP}
      legacy={legacy}
      profile={profile}
      name={session.user.name}
      userId={session.user.id}
      view={view}
      profileTab={selectedProfileTab}
      onNavigate={navigateMobile}
      onOpenProfile={async (id, role) => {
        try {
          const d = await api("/api/profiles?role=" + role + "&profile=" + id);
          setView("directory");
          const url = new URL(window.location.href);
          url.searchParams.set("mobile", "discover");
          url.searchParams.delete("profileTab");
          url.hash = "directory";
          window.history.replaceState(window.history.state, "", url);
          setFocusMember(d.profile);
        } catch (e) {
          notify((e as Error).message);
        }
      }}
    />
  ) : (
    legacy
  );
}
function AuthModal({
  mode,
  setMode,
  role,
  setRole,
  close,
  onSuccess,
}: {
  mode: "login" | "signup";
  setMode: (m: "login" | "signup") => void;
  role: "mentor" | "beginner";
  setRole: (r: "mentor" | "beginner") => void;
  close: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", listener);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", listener);
      document.body.style.overflow = prev;
    };
  }, [close]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email: String(f.get("email")),
              password: String(f.get("password")),
              name: String(f.get("name")),
            })
          : await authClient.signIn.email({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
      if (result.error)
        throw new Error(
          result.error.status === 429
            ? "Trop de tentatives. Patiente une minute avant de réessayer."
            : mode === "login"
              ? "Connexion impossible. Vérifie ton e-mail et ton mot de passe."
              : "Inscription impossible. Vérifie les informations ou connecte-toi si tu as déjà un compte.",
        );
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const items = e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,a[href]",
            );
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          className="close-btn"
          onClick={close}
          aria-label={translateUi("Fermer")}
        >
          <X />
        </button>
        <Icon>
          <HeartHandshake />
        </Icon>
        <span className="eyebrow">{translateUi("BIENVENUE CHEZ MENTORA")}</span>
        <h2 id="auth-title">
          {translateUi(
            mode === "signup"
              ? "Les bonnes rencontres commencent ici."
              : "Heureux de te retrouver.",
          )}
        </h2>
        <p>
          {translateUi(
            mode === "signup"
              ? "Un compte, puis quelques questions pour trouver ton binôme."
              : "Connecte-toi pour retrouver ton profil.",
          )}
        </p>
        {mode === "signup" && (
          <div className="role-switch">
            <button
              className={role === "beginner" ? "selected" : ""}
              onClick={() => setRole("beginner")}
            >
              <Sprout />
              {translateUi(" Je suis d\u00E9butant")}
            </button>
            <button
              className={role === "mentor" ? "selected" : ""}
              onClick={() => setRole("mentor")}
            >
              <Sparkles />
              {translateUi(" Je suis parrain")}
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              {translateUi("Pr\u00E9nom ou surnom")}
              <input
                name="name"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={40}
                autoFocus
              />
            </label>
          )}
          <label>
            {translateUi("Adresse e-mail ")}
            <span className="optional">{translateUi("priv\u00E9e")}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus={mode === "login"}
            />
          </label>
          <label>
            {translateUi("Mot de passe")}
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
            />
          </label>
          {mode === "signup" && (
            <p className="small-text">
              {translateUi(
                "Au moins 12 caract\u00E8res. Conserve-le dans ton gestionnaire de mots de passe.",
              )}
            </p>
          )}
          {translateUi(
            error && (
              <p className="error" role="alert">
                {translateUi(error)}
              </p>
            ),
          )}
          <button className="btn full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {translateUi(
                  mode === "signup" ? "Créer mon compte" : "Me connecter",
                )}{" "}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        {mode === "login" && (
          <p className="auth-switch"><a href="/mot-de-passe-oublie">Mot de passe oublié ?</a></p>
        )}
        <p className="auth-switch">
          {translateUi(
            mode === "signup" ? "Déjà membre ?" : "Pas encore membre ?",
          )}{" "}
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
          >
            {translateUi(
              mode === "signup" ? "Se connecter" : "Créer un compte",
            )}
          </button>
        </p>
      </section>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label>
      {translateUi(label)}
      {translateUi(children)}
      {translateUi(
        hint && <span className="field-hint">{translateUi(hint)}</span>,
      )}
    </label>
  );
}
function ProfileForm(props: React.ComponentProps<typeof NewProfileForm>) {
  const enabled = useFeature("onboardingV2");
  const { questionnaire, ...legacyInitial } = props.initial;
  void questionnaire;
  return (
    <>
      {!props.onCancel && <BetaSettings />}
      {enabled ? (
        <NewProfileForm {...props} />
      ) : (
        <LegacyProfileForm {...props} initial={legacyInitial} />
      )}
    </>
  );
}
function LegacyProfileForm({
  initial,
  onSave,
  onCancel,
  onLogin,
}: {
  onLogin: () => void;
  initial: ProfileInput;
  onSave: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(!!onCancel);
  const update = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (!consent) {
      setError("Accepte la charte pour publier ton profil.");
      return;
    }
    setBusy(true);
    try {
      onSave(
        (
          await api("/api/me", {
            method: "PUT",
            body: JSON.stringify({ ...draft, consent }),
          })
        ).profile,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="onboarding">
      <aside>
        <span className="eyebrow">
          {translateUi(onCancel ? "MON PROFIL" : "FAISONS CONNAISSANCE")}
        </span>
        <h2>
          {translateUi(
            onCancel
              ? "Mets ton profil à jour."
              : "Le bon binôme commence par toi.",
          )}
        </h2>
        <p>
          {translateUi(
            onCancel
              ? "Modifie ta présentation, ton parcours et tes disponibilités, puis enregistre à la dernière étape."
              : "Quelques informations pour se rencontrer autour des mêmes envies.",
          )}
        </p>
        <ol className="form-steps">
          {["Qui tu es", "Ton parcours", "Votre rythme"].map((s, i) => (
            <li
              key={s}
              className={step === i ? "current" : step > i ? "done" : ""}
            >
              <span>{step > i ? <Check size={15} /> : i + 1}</span>
              {translateUi(s)}
            </li>
          ))}
        </ol>
        <div className="privacy-note">
          <ShieldCheck />
          <p>
            {translateUi(
              "Ton e-mail reste priv\u00E9. Ton pseudo Discord est accessible uniquement aux personnes avec lesquelles un bin\u00F4me a \u00E9t\u00E9 accept\u00E9.",
            )}
          </p>
        </div>
      </aside>
      <form className="form-panel" onSubmit={submit}>
        {!onCancel && (
          <div className="questionnaire-login">
            <p>
              {translateUi(
                "Tu as d\u00E9j\u00E0 un compte Mentora ? Retrouve ton profil avec ton e-mail et ton mot de passe.",
              )}
            </p>
            <button type="button" className="btn secondary" onClick={onLogin}>
              {translateUi("Se connecter \u00E0 mon compte")}
            </button>
            <small>
              {translateUi(
                "Si tu changes de compte, les r\u00E9ponses non enregistr\u00E9es de ce questionnaire ne seront pas conserv\u00E9es.",
              )}
            </small>
          </div>
        )}
        <span className="eyebrow">
          {translateUi("\u00C9TAPE ")}
          {step + 1}
          {translateUi(" SUR 3")}
        </span>
        <h2>
          {translateUi(
            [
              "Présente-toi.",
              "À chacun son parcours.",
              "Un rythme qui vous ressemble.",
            ][step],
          )}
        </h2>
        {step === 0 && (
          <>
            <div className="role-switch">
              <button
                type="button"
                onClick={() => {
                  update("role", "beginner");
                }}
                className={draft.role === "beginner" ? "selected" : ""}
              >
                <Sprout />
                {translateUi(" D\u00E9butant")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    role: "mentor",
                    experience: Math.max(6, d.experience),
                  }));
                }}
                className={draft.role === "mentor" ? "selected" : ""}
              >
                <Sparkles />
                {translateUi(" Parrain")}
              </button>
            </div>
            <div className="fields">
              <Field label={translateUi("Prénom ou surnom")}>
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </Field>
              <Field
                label={translateUi("Tranche d’âge")}
                hint={translateUi(
                  "Facultatif. N’indique pas ta date de naissance.",
                )}
              >
                <select
                  value={draft.age}
                  onChange={(e) =>
                    update("age", e.target.value as ProfileInput["age"])
                  }
                >
                  {[
                    "Non précisé",
                    "Moins de 18 ans",
                    "18–24 ans",
                    "25–34 ans",
                    "35 ans et plus",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {translateUi(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={translateUi("Pseudo Discord")}
                hint={translateUi("Ton nom d’utilisateur unique, sans @.")}
              >
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  pattern="[a-z0-9_.]+"
                  value={draft.discord}
                  onChange={(e) =>
                    update("discord", e.target.value.toLowerCase())
                  }
                  placeholder={translateUi("ex. alex.resell")}
                />
              </Field>
            </div>
            <Field
              label={translateUi("Identifiant Discord numérique (facultatif)")}
              hint={translateUi(
                "Active le mode développeur sur Discord, puis « Copier l’identifiant utilisateur ». Il permet un lien direct vers ton profil ; sinon, ton pseudo pourra être copié.",
              )}
            >
              <input
                value={draft.discordId}
                inputMode="numeric"
                pattern="[0-9]{17,20}"
                onChange={(e) => update("discordId", e.target.value)}
                placeholder={translateUi("17 à 20 chiffres")}
              />
            </Field>
            <Field label={translateUi("Quelques mots sur toi")}>
              <textarea
                required
                minLength={20}
                maxLength={800}
                rows={4}
                value={draft.bio}
                onChange={(e) => update("bio", e.target.value)}
                placeholder={translateUi(
                  "Ton état d’esprit, ce que tu aimes, ce que tu aimerais partager…",
                )}
              />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <div className="fields">
              <Field
                label={translateUi(
                  draft.role === "mentor"
                    ? "Expérience en achat-revente (mois)"
                    : "Depuis combien de mois pratiques-tu ?",
                )}
                hint={translateUi(
                  draft.role === "mentor"
                    ? "Au moins 6 mois pour devenir parrain."
                    : "Mets 0 si tu commences tout juste.",
                )}
              >
                <input
                  type="number"
                  required
                  min={draft.role === "mentor" ? 6 : 0}
                  max={600}
                  value={draft.experience}
                  onChange={(e) => update("experience", Number(e.target.value))}
                />
              </Field>
              <fieldset className="specialty-options">
                <legend>
                  {translateUi(
                    draft.role === "mentor"
                      ? "Tes spécialités (plusieurs choix possibles)"
                      : "Tes centres d’intérêt",
                  )}
                </legend>
                {specialties.map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={draft.specialty.includes(x)}
                      onChange={(e) =>
                        update(
                          "specialty",
                          e.target.checked
                            ? [...draft.specialty, x]
                            : draft.specialty.filter((s) => s !== x),
                        )
                      }
                    />
                    {translateUi(x)}
                  </label>
                ))}
              </fieldset>

              {draft.role === "mentor" && (
                <Field
                  label={translateUi("Ce que tu peux apprendre à un débutant")}
                  hint={translateUi(
                    "Exemples : sourcing en brocante, calcul des marges, photos et annonces…",
                  )}
                >
                  <textarea
                    maxLength={500}
                    value={draft.teaching}
                    onChange={(e) => update("teaching", e.target.value)}
                  />
                </Field>
              )}
              {draft.role === "mentor" ? (
                <Field
                  label={translateUi("Chiffre d’affaires mensuel")}
                  hint={translateUi(
                    "Déclaratif et facultatif. Le chiffre d’affaires n’est pas le bénéfice.",
                  )}
                >
                  <select
                    value={draft.revenue}
                    onChange={(e) =>
                      update(
                        "revenue",
                        e.target.value as ProfileInput["revenue"],
                      )
                    }
                  >
                    {[
                      "Je préfère ne pas préciser",
                      "Moins de 1 000 €",
                      "1 000–2 000 €",
                      "2 000–3 000 €",
                      "3 000–5 000 €",
                      "5 000–7 000 €",
                      "7 000–10 000 €",
                      "10 000 € et plus",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {translateUi(x)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label={translateUi("Budget de départ (facultatif)")}>
                  <select
                    value={draft.budget}
                    onChange={(e) =>
                      update("budget", e.target.value as ProfileInput["budget"])
                    }
                  >
                    {[
                      "Non précisé",
                      "Moins de 100 €",
                      "100–300 €",
                      "300–500 €",
                      "500 € et plus",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {translateUi(x)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Field
              label={translateUi(
                draft.role === "mentor"
                  ? "Qu’aimerais-tu transmettre ?"
                  : "Quels sont tes objectifs et tes difficultés ?",
              )}
            >
              <textarea
                required
                minLength={10}
                maxLength={500}
                rows={4}
                value={draft.goals}
                onChange={(e) => update("goals", e.target.value)}
                placeholder={translateUi(
                  draft.role === "mentor"
                    ? "Aider à choisir les premières pièces, améliorer les annonces…"
                    : "Faire mes premières ventes, mieux sourcer, comprendre les prix…",
                )}
              />
            </Field>
            <Field
              label={translateUi(
                draft.role === "mentor"
                  ? "Marques, pièces et références"
                  : "Marques ou pièces qui t’intéressent (facultatif)",
              )}
              hint={translateUi(
                "Ex. Nike, Ralph Lauren, Carhartt, jeans, vestes…",
              )}
            >
              <input
                maxLength={300}
                value={draft.references}
                onChange={(e) => update("references", e.target.value)}
              />
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <div className="fields">
              <Field label={translateUi("Tes créneaux préférés")}>
                <select
                  value={draft.availability}
                  onChange={(e) =>
                    update(
                      "availability",
                      e.target.value as ProfileInput["availability"],
                    )
                  }
                >
                  {times.map((x) => (
                    <option key={x} value={x}>
                      {translateUi(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={translateUi("Durée souhaitée")}>
                <select
                  value={draft.duration}
                  onChange={(e) =>
                    update(
                      "duration",
                      e.target.value as ProfileInput["duration"],
                    )
                  }
                >
                  {[
                    "2 semaines",
                    "1 mois",
                    "3 mois",
                    "6 mois",
                    "Sans durée définie",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {translateUi(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={translateUi(
                  draft.role === "mentor"
                    ? "Ton délai habituel de réponse"
                    : "Le délai de réponse qui te convient",
                )}
              >
                <select
                  value={draft.responseTime}
                  onChange={(e) =>
                    update(
                      "responseTime",
                      e.target.value as ProfileInput["responseTime"],
                    )
                  }
                >
                  {[
                    "Sous 24 h",
                    "Sous 48 h",
                    "Sous 72 h",
                    "À convenir ensemble",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {translateUi(x)}
                    </option>
                  ))}
                </select>
              </Field>
              {draft.role === "mentor" && (
                <Field
                  label={translateUi(
                    "Nombre maximum de débutants en même temps",
                  )}
                  hint={translateUi(
                    "De 0 à 10. Avec 0 place, tu ne figures pas dans l’annuaire.",
                  )}
                >
                  <input
                    required
                    type="number"
                    min={0}
                    max={10}
                    value={draft.capacity}
                    onChange={(e) => update("capacity", Number(e.target.value))}
                  />
                </Field>
              )}
            </div>
            <div className="info-box">
              <MessageCircle />
              <p>
                {translateUi(
                  "Vous \u00E9changez sur Discord, par messages. Aucun appel impos\u00E9. Les horaires et la dur\u00E9e se confirment ensemble au premier \u00E9change.",
                )}
              </p>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.visible}
                onChange={(e) => update("visible", e.target.checked)}
              />
              <span>
                {translateUi(
                  "Rendre mon profil visible dans l\u2019annuaire public.",
                )}
                <small>
                  {translateUi("Tu pourras le masquer \u00E0 tout moment.")}
                </small>
              </span>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {translateUi(
                  "J\u2019accepte la charte d\u2019entraide : respect, confidentialit\u00E9, accompagnement gratuit et aucune promesse de gains.",
                )}
                <small>
                  {translateUi(
                    "Je consens \u00E0 l\u2019affichage de mon profil et au partage de mon contact Discord avec mes bin\u00F4mes accept\u00E9s.",
                  )}
                </small>
              </span>
            </label>
          </>
        )}
        {translateUi(
          error && (
            <p className="error" role="alert">
              {translateUi(error)}
            </p>
          ),
        )}
        <div className="form-actions">
          {step > 0 ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ChevronLeft size={18} />
              {translateUi(" Retour")}
            </button>
          ) : onCancel ? (
            <button type="button" className="text-btn" onClick={onCancel}>
              {translateUi("Annuler")}
            </button>
          ) : (
            <span />
          )}
          <button className="btn" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <>
                {translateUi(step < 2 ? "Continuer" : "Enregistrer mon profil")}{" "}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
function DiscoveryCard({p,onOpen,canSave}:{p:PublicProfile;onOpen:()=>void;canSave:boolean}) {
  const modern=useOwnerPreview();
  const available = p.role === "mentor" && p.capacity > (p.activeCount || 0);
  return <article className="discovery-card">
    {canSave && <MobileProfileActions profileId={p.id} compact/>}
    <div className="discovery-card-head"><Avatar profile={p}/><div><h2>{p.name}<span className="discovery-role">{p.role === "mentor" ? "Parrain" : "Débutant"}</span></h2><p>{profileExperienceLabel(p)}</p></div></div>
    {p.bio && <p className="discovery-bio">{p.bio}</p>}
    <div className="discovery-tags">{(modern?[...currentProfileSections(p).platforms,...currentProfileSections(p).methods].slice(0,3):discoveryTags(p)).map(tag=><span key={tag}>{tag}</span>)}</div>
    <footer><span className={available ? "discovery-available" : "discovery-status"}>{p.role === "mentor" ? modern ? "Parrain" : available ? "✓ Disponible pour aider" : "Aucune place disponible" : "Membre de la communauté"}</span><button className="btn secondary" onClick={onOpen}>Voir le profil <ArrowRight size={17}/></button></footer>
  </article>;
}
function Directory({
  privateServices=false,
  preview = false,
  onFollowChange,
  initialTarget,
  session,
  own,
  onJoin,
  onProfile,
  notify,
}: {
  privateServices?: boolean;
  preview?: boolean;
  onFollowChange: () => Promise<void>;
  initialTarget: PublicProfile | null;
  session: boolean;
  own: Profile | null;
  onJoin: () => void;
  onProfile: () => void;
  notify: (s: string) => void;
}) {
  const modern=useOwnerPreview();
  const [role, setRole] = useState<"all"|"mentor"|"beginner">("all");
  const [advanced, setAdvanced] = useState<Record<string,string>>({});
  const [search, setSearch] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [contact, setContact] = useState<{
    discord: string;
    discordId: string;
  } | null>(null);
  const [contactError, setContactError] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!initialTarget) return;
    let live = true;
    api(
      "/api/profiles?role=" +
        initialTarget.role +
        "&profile=" +
        initialTarget.id,
    )
      .then((d) => {
        if (live) {
          selectedRef.current = d.profile.id;
          setSelected(d.profile);
          setContact(null);
        }
      })
      .catch((e) => {
        if (live) notify(e.message);
      });
    return () => {
      live = false;
    };
  }, [initialTarget]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({
          ...advanced, discovery: "social", role,
          q: search,
          page: String(page),
        });
        const d = await api("/api/profiles?" + q);
        if (live) {
          setProfiles(d.profiles);
          setTotal(d.total);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setBusy(false);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [role, search, advanced, page, reload]);
  useEffect(() => {
    if (!selected) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", esc);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = previous;
    };
  }, [selected]);
  const open = (p: PublicProfile) => {
    selectedRef.current = p.id;
    setSelected(p);
    setContactBusy(false);
    setContact(null);
    setContactError("");
  };
  async function moveProfile(direction: number) {
    if (!selected || switching) return;
    const index = profiles.findIndex((p) => p.id === selected.id),
      next = index + direction;
    if (next >= 0 && next < profiles.length) {
      open(profiles[next]);
      return;
    }
    const targetPage = page + direction;
    if (targetPage < 0 || targetPage * 12 >= total) return;
    setSwitching(true);
    try {
      const q = new URLSearchParams({
        ...advanced, discovery: "social", role,
        q: search,
        page: String(targetPage),
      });
      const d = await api("/api/profiles?" + q);
      if (d.profiles.length) {
        setProfiles(d.profiles);
        setPage(targetPage);
        open(d.profiles[direction > 0 ? 0 : d.profiles.length - 1]);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  useEffect(() => {
    let live = true;
    setContact(null);
    setContactError("");
    if (!selected || !own || !session || preview) return;
    setContactBusy(true);
    api("/api/profiles?connection=" + selected.id)
      .then((data) => {
        if (live) setContact(data.accepted ? data : null);
      })
      .catch((e) => {
        if (live) setContactError(e.message);
      })
      .finally(() => {
        if (live) setContactBusy(false);
      });
    return () => {
      live = false;
    };
  }, [selected?.id, own?.id, session, preview]);
  return (
    <ProfileBookmarkScope><section className="wrap directory member-discovery">
      <header className="discovery-heading">
        <span className="eyebrow">DÉCOUVRIR LA COMMUNAUTÉ</span>
        <h1>Trouve les bonnes personnes<span>.</span></h1>
        <p>Échange avec des resellers, débutants comme expérimentés.</p>
      </header>
      <div className="discovery-search search-field"><Search size={22}/><input type="search" aria-label="Rechercher un membre, une compétence" placeholder="Rechercher un membre, une compétence…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></div>
      <div className="discovery-filter-title"><span>Explorer les profils</span><button className="btn secondary" aria-expanded={showMobileFilters} aria-controls="discovery-filters" onClick={()=>setShowMobileFilters(v=>!v)}><SlidersHorizontal size={17}/>Filtres{Object.values(advanced).filter(Boolean).length ? ` · ${Object.values(advanced).filter(Boolean).length}` : ""}</button></div>
      <div className="discovery-role-filters" aria-label="Types de membres">{([["all","Tous les profils"],["mentor","Parrains"],["beginner","Débutants"]] as const).map(([value,label])=><button key={value} aria-pressed={role===value} className={role===value?"selected":""} onClick={()=>{setRole(value);setPage(0);}}>{label}</button>)}</div>
      {showMobileFilters && <div id="discovery-filters" className="discovery-advanced">{discoveryFilters.map(filter=><label key={filter.key}>{filter.label}<select value={advanced[filter.key] || ""} onChange={e=>{setAdvanced(v=>({...v,[filter.key]:e.target.value}));setPage(0);}}><option value="">Toutes les réponses</option>{filter.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}<button className="btn secondary" onClick={()=>{setAdvanced({});setSearch("");setRole("all");setPage(0);}}>Réinitialiser les filtres</button></div>}
      <div className="results-label" aria-live="polite"><span>Membres à découvrir</span><span>{busy ? "Recherche…" : `${total} profil${total>1?"s":""}`}</span></div>
      {error ? (
        <div className="empty">
          <CircleHelp />
          <h2>{translateUi("Une petite interruption.")}</h2>
          <p role="alert">{translateUi(error)}</p>
          <Button onClick={() => setReload(reload + 1)}>
            {translateUi("R\u00E9essayer")}
          </Button>
        </div>
      ) : busy ? (
        <div className="member-grid" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton" />
          ))}
        </div>
      ) : profiles.length ? (
        <div className="member-grid">
          {profiles.map((p) => (
            <DiscoveryCard key={p.id} p={p} onOpen={()=>open(p)} canSave={session && own?.id !== p.id}/>
          ))}
        </div>
      ) : (
        <div className="empty directory-empty">
          <div className="empty-art">
            <Users size={36} />
            <span>✦</span>
          </div>
          <h2>
            {translateUi(
              search || Object.values(advanced).some(Boolean)
                ? "Pas encore de profil pour ces critères."
                : "Les belles rencontres commencent avec les premiers membres.",
            )}
          </h2>
          <p>
            {translateUi(
              search || Object.values(advanced).some(Boolean)
                ? "Essaie un autre mot-clé ou réinitialise les filtres."
                : "Les premiers membres apparaîtront ici dès que leur profil sera visible.",
            )}
          </p>
          <Button
            onClick={
              search || Object.values(advanced).some(Boolean)
                ? () => {
                    setAdvanced({});
                    setSearch("");
                    setPage(0);
                  }
                : session
                  ? onProfile
                  : onJoin
            }
          >
            {translateUi(
              search || Object.values(advanced).some(Boolean)
                ? "Réinitialiser les filtres"
                : "Créer mon profil",
            )}{" "}
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
      {total > 12 && (
        <div className="pagination">
          <button
            className="btn secondary"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {translateUi("Pr\u00E9c\u00E9dent")}
          </button>
          <span>
            {translateUi("Page ")}
            {page + 1}
            {translateUi(" sur ")}
            {Math.ceil(total / 12)}
          </span>
          <button
            className="btn secondary"
            disabled={(page + 1) * 12 >= total}
            onClick={() => setPage(page + 1)}
          >
            {translateUi("Suivant")}
          </button>
        </div>
      )}
      <div className="directory-tip">
        <Icon>
          <HeartHandshake />
        </Icon>
        <div>
          <strong>
            {translateUi(
              "Le feeling compte autant que l\u2019exp\u00E9rience.",
            )}
          </strong>
          <p>
            {translateUi(
              "Commence par un petit message. Parlez de vos objectifs et de vos disponibilit\u00E9s avant de vous engager.",
            )}
          </p>
        </div>
      </div>
      {selected && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-title"
            className={`modal member-modal ${selected.role==="mentor"||modern?"redesigned-mentor-modal":""}`}
            key={selected.id}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
                );
                if (e.shiftKey && document.activeElement === items[0]) {
                  e.preventDefault();
                  items[items.length - 1].focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === items[items.length - 1]
                ) {
                  e.preventDefault();
                  items[0].focus();
                }
              }
            }}
          >
            <button
              autoFocus
              className="close-btn"
              onClick={() => setSelected(null)}
              aria-label={translateUi("Fermer le profil")}
            >
              <X />
            </button>
            <div
              className="profile-pager"
              hidden={!profiles.some((p) => p.id === selected.id)}
            >
              <button
                aria-label={translateUi("Profil précédent")}
                disabled={
                  switching || (page === 0 && profiles[0]?.id === selected.id)
                }
                onClick={() => void moveProfile(-1)}
              >
                ←
              </button>
              <span>
                {translateUi("Profil")}{" "}
                {page * 12 +
                  profiles.findIndex((p) => p.id === selected.id) +
                  1}{" "}
                {translateUi("sur ")}
                {total}
              </span>
              <button
                aria-label={translateUi("Profil suivant")}
                disabled={
                  switching ||
                  page * 12 +
                    profiles.findIndex((p) => p.id === selected.id) +
                    1 >=
                    total
                }
                onClick={() => void moveProfile(1)}
              >
                →
              </button>
            </div>
            {selected.role==="mentor"||modern?<MentorProfileCard key={selected.id} profile={selected} own={selected.id===own?.id} onEdit={selected.id===own?.id?()=>{setSelected(null);window.location.assign("/?mobile=edit#profile");}:undefined} headerActions={<><FollowCounts profile={selected}/>{session&&selected.id!==own?.id&&<fieldset className="preview-controls" disabled={preview} inert={preview}><FollowButton key={selected.id} profile={selected} onChange={(count)=>{void onFollowChange();setSelected(p=>p?{...p,followerCount:count}:p);setProfiles(list=>list.map(p=>p.id===selected.id?{...p,followerCount:count}:p));}}/></fieldset>}{selected.role==="mentor"&&<RatingSummary average={selected.ratingAverage} count={selected.ratingCount}/>}</>} actions={<><MobileProfileActions profileId={selected.id}/>{session&&selected.id!==own?.id&&<fieldset className="preview-controls" disabled={preview} inert={preview}><ReportProfile key={selected.id} profileId={selected.id}/></fieldset>}</>}/>:<>
            <Avatar profile={selected} />
            <span className="eyebrow">
              {translateUi(isMentorProfile(selected) ? "PARRAIN" : "DÉBUTANT")}{" "}
              ·{" "}
              {translateUi(
                selected.specialty.join(" · ") || "Spécialités à préciser",
              )}
            </span>
            <h2 id="member-title">{selected.name}</h2>
            <VerificationBadge profile={selected} />
            <FollowCounts profile={selected} />
            {!privateServices&&<ProfileDates profile={selected} />}
            {session && selected.id !== own?.id && (
              <fieldset
                className="preview-controls"
                disabled={preview}
                inert={preview}
              >
                <FollowButton
                  key={selected.id}
                  profile={selected}
                  onChange={(count) => {
                    void onFollowChange();
                    setSelected((p) =>
                      p ? { ...p, followerCount: count } : p,
                    );
                    setProfiles((list) =>
                      list.map((p) =>
                        p.id === selected.id
                          ? { ...p, followerCount: count }
                          : p,
                      ),
                    );
                  }}
                />
              </fieldset>
            )}
            {isMentorProfile(selected) && (!privateServices || selected.id!==own?.id) && (
              <RatingSummary
                average={selected.ratingAverage}
                count={selected.ratingCount}
              />
            )}
            {isMentorProfile(selected) && (
              <MentorAvailability profile={selected} />
            )}
            <p>{selected.bio}</p>
            {session && selected.id !== own?.id && (
              <fieldset
                className="preview-controls"
                disabled={preview}
                inert={preview}
              >
                <ReportProfile key={selected.id} profileId={selected.id} />
              </fieldset>
            )}
            {privateServices?<details className="profile-extra-details"><summary>Plus d’informations</summary>            <div className="detail-grid">
              <div>
                <small>{translateUi("Exp\u00E9rience")}</small>
                <strong>
                  {profileExperienceLabel(selected)}
                </strong>
              </div>

              <div>
                <small>{translateUi("Disponibilit\u00E9s")}</small>
                <strong>{translateUi(selected.availability)}</strong>
              </div>
              <div>
                <small>{translateUi("Dur\u00E9e souhait\u00E9e")}</small>
                <strong>{translateUi(selected.duration)}</strong>
              </div>
              <div>
                <small>{translateUi("R\u00E9ponses")}</small>
                <strong>{translateUi(selected.responseTime)}</strong>
              </div>
              {selected.age !== "Non précisé" && (
                <div>
                  <small>{translateUi("Tranche d\u2019\u00E2ge")}</small>
                  <strong>{translateUi(selected.age)}</strong>
                </div>
              )}
              {isMentorProfile(selected) &&
                selected.revenue !== "Je préfère ne pas préciser" && (
                  <div>
                    <small>{translateUi("CA mensuel d\u00E9clar\u00E9")}</small>
                    <strong>{translateUi(selected.revenue)}</strong>
                  </div>
                )}
              {selected.role === "beginner" &&
                selected.budget !== "Non précisé" && (
                  <div>
                    <small>{translateUi("Budget de d\u00E9part")}</small>
                    <strong>{translateUi(selected.budget)}</strong>
                  </div>
                )}
            </div>
<ProfileDates profile={selected}/></details>:(<>             <div className="detail-grid">
              <div>
                <small>{translateUi("Exp\u00E9rience")}</small>
                <strong>
                  {profileExperienceLabel(selected)}
                </strong>
              </div>

              <div>
                <small>{translateUi("Disponibilit\u00E9s")}</small>
                <strong>{translateUi(selected.availability)}</strong>
              </div>
              <div>
                <small>{translateUi("Dur\u00E9e souhait\u00E9e")}</small>
                <strong>{translateUi(selected.duration)}</strong>
              </div>
              <div>
                <small>{translateUi("R\u00E9ponses")}</small>
                <strong>{translateUi(selected.responseTime)}</strong>
              </div>
              {selected.age !== "Non précisé" && (
                <div>
                  <small>{translateUi("Tranche d\u2019\u00E2ge")}</small>
                  <strong>{translateUi(selected.age)}</strong>
                </div>
              )}
              {isMentorProfile(selected) &&
                selected.revenue !== "Je préfère ne pas préciser" && (
                  <div>
                    <small>{translateUi("CA mensuel d\u00E9clar\u00E9")}</small>
                    <strong>{translateUi(selected.revenue)}</strong>
                  </div>
                )}
              {selected.role === "beginner" &&
                selected.budget !== "Non précisé" && (
                  <div>
                    <small>{translateUi("Budget de d\u00E9part")}</small>
                    <strong>{translateUi(selected.budget)}</strong>
                  </div>
                )}
            </div>
 </>)}
            <h3>
              {translateUi(
                isMentorProfile(selected)
                  ? "Ce que je peux t’apporter"
                  : "Mes objectifs",
              )}
            </h3>
            <p>
              {isMentorProfile(selected)
                ? selected.teaching || selected.goals
                : selected.goals}
            </p>
            {selected.references && (
              <>
                <h3>{translateUi("Marques & r\u00E9f\u00E9rences")}</h3>
                <p>{selected.references}</p>
              </>
            )}
            {!privateServices&&<p className="small-text">
              {translateUi(
                "Informations d\u00E9clar\u00E9es par le membre, non v\u00E9rifi\u00E9es. Aucun r\u00E9sultat financier garanti.",
              )}
            </p>}
            <MobileProfileActions profileId={selected.id} />
            {privateServices&&isMentorProfile(selected)&&<PrivateServiceCatalog profileId={selected.id}/>}
            {privateServices?<details className="profile-extra-details"><summary>Parcours et références</summary>{isMentorProfile(selected)&&<MentorPortfolio profileId={selected.id}/>}<OnboardingSummary data={selected.resell} profileId={selected.id}/></details>:<>{isMentorProfile(selected)&&<MentorPortfolio profileId={selected.id}/>}<OnboardingSummary data={selected.resell} profileId={selected.id}/></>}
            </>}
            {!modern&&(contact ? (
              <div className="contact-panel">
                <strong>@{contact.discord}</strong>
                <button
                  className="btn full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(contact.discord);
                      notify(
                        "Pseudo copié ! Sur Discord : Amis → Ajouter un ami.",
                      );
                    } catch {
                      notify("Copie le pseudo affiché puis ouvre Discord.");
                    }
                  }}
                >
                  <Copy size={16} />
                  {translateUi(" Copier le pseudo Discord")}
                </button>
                <a
                  className="text-btn"
                  href={
                    contact.discordId
                      ? `https://discord.com/users/${contact.discordId}`
                      : "https://discord.com/channels/@me"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {translateUi(
                    contact.discordId
                      ? "Ouvrir son profil Discord"
                      : "Ouvrir Discord",
                  )}{" "}
                  <ArrowUpRight size={16} />
                </a>
                <p className="small-text">
                  {translateUi(
                    "La demande d\u2019amis se fait sur Discord. Pr\u00E9sente-toi et explique ce que tu recherches.",
                  )}
                </p>
              </div>
            ) : contactBusy ? (
              <p>{translateUi("V\u00E9rification du bin\u00F4me\u2026")}</p>
            ) : !session || !own ? (
              <button
                className="btn full"
                onClick={!session ? onJoin : onProfile}
              >
                {translateUi(
                  "Compl\u00E9ter mon profil pour envoyer une demande",
                )}
              </button>
            ) : selected.role !== own.role && selected.id !== own.id ? (
              <fieldset
                className="preview-controls"
                disabled={preview}
                inert={preview}
              >
                <RequestAccompaniment
                  key={selected.id}
                  targetProfileId={selected.id}
                  senderRole={own.role}
                  verified={
                    own.role === "mentor"
                      ? !!own.verification
                      : !!selected.verification
                  }
                />
              </fieldset>
            ) : null)}
            {translateUi(
              !modern&&contactError && (
                <p role="alert" className="error">
                  {translateUi(contactError)}
                </p>
              ),
            )}
          </section>
        </div>
      )}
    </section></ProfileBookmarkScope>
  );
}
function DeleteProfile({ onDeleted }: { onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="delete-area">
      {confirm ? (
        <>
          <p>
            {translateUi(
              "Supprimer d\u00E9finitivement ton profil et ton contact de l\u2019annuaire ? Ton compte restera disponible.",
            )}
          </p>
          <button
            className="text-btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/me", { method: "DELETE" });
                onDeleted();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {translateUi("Oui, supprimer mon profil")}
          </button>
          <button className="text-btn" onClick={() => setConfirm(false)}>
            {translateUi("Annuler")}
          </button>
        </>
      ) : (
        <button className="text-btn muted" onClick={() => setConfirm(true)}>
          {translateUi("Supprimer mon profil")}
        </button>
      )}
      {translateUi(error && <p role="alert">{translateUi(error)}</p>)}
    </div>
  );
}
function Guide({onJoin}:{onJoin:()=>void}) { return <HowMentoraWorks onJoin={onJoin}/>; }
function isMentorProfile(profile: PublicProfile){return profile.role==="mentor";}
function MentorAvailability({ profile }: { profile: PublicProfile }) {
  const active = profile.activeCount ?? 0;
  const remaining = Math.max(0, profile.capacity - active);
  return (
    <p className="mentor-availability">
      <strong>
        {active}
        {translateUi(" en cours")}
      </strong>
      <span> · </span>
      {remaining}
      {translateUi(" place")}
      {translateUi(remaining > 1 ? "s" : "")}
      {translateUi(" libre")}
      {translateUi(remaining > 1 ? "s" : "")}
      {translateUi(" restante")}
      {translateUi(remaining > 1 ? "s" : "")}
    </p>
  );
}
function FAQ() { return <div className="mentora-landing landing-container landing-section"><PublicFAQ/></div>; }
