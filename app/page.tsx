"use client";
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
  CheckCircle2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  initialProfile,
  specialties,
  times,
  type Profile,
  type ProfileInput,
  type PublicProfile,
} from "@/lib/profile";
import {
  Accompaniments,
  RatingSummary,
  RequestAccompaniment,
} from "./components/accompaniments";
import { VerificationBadge } from "./components/verification";
import { AdminDashboard, ReportProfile } from "./components/admin";
import { Avatar, ProfilePhoto } from "./components/profile-photo";
import { Help } from "./components/help";
import {
  FollowButton,
  FollowCounts,
  FollowNetwork,
} from "./components/follows";
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
  | "menu";
const views: Record<View, string> = {
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
import { WorkspaceNav, WorkspaceMenuPage } from "./components/workspace-nav";
export default function App() {
  const { discordUrl: DISCORD_GROUP } = usePlatformSettings();
  const [requestedView, setView] = useState<View>("home");
  const [mobile, setMobile] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const [moderator, setModerator] = useState(false);
  const [previewRole, setPreviewRole] = useState<"mentor" | "beginner" | null>(
    null,
  );
  const preview = moderator ? previewRole : null;
  const showAdmin = moderator && !preview;
  const [moderationBlock, setModerationBlock] = useState<string | null>(null);
  const publicView = ["home", "guide", "faq", "help"].includes(requestedView);
  const view: View = publicView
    ? requestedView
    : session
      ? requestedView === "moderation" && !showAdmin
        ? "directory"
        : requestedView
      : "home";
  const inWorkspace =
    !!session &&
    ["directory", "profile", "moderation", "help", "menu"].includes(view);
  const navigation: View[] =
    inWorkspace && session
      ? showAdmin
        ? ["directory", "profile", "moderation", "help"]
        : ["directory", "profile", "help"]
      : ["home", "guide", "faq", "help"];
  const [savedProfile, setProfile] = useState<Profile | null>(null);
  const profile =
    savedProfile && preview ? { ...savedProfile, role: preview } : savedProfile;
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  useEffect(() => {
    const login = () => setAuthMode("login");
    window.addEventListener("mentora-login", login);
    return () => window.removeEventListener("mentora-login", login);
  }, []);
  const [focusMember, setFocusMember] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState<"mentor" | "beginner">("beginner");
  const [profileTab, setProfileTab] = useState("accompaniments");
  const [adminTab, setAdminTab] = useState("overview");
  const [verificationDismissed, setVerificationDismissed] = useState(false);
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
      (next === "directory" || next === "profile" || next === "menu")
    ) {
      setAuthMode("signup");
      return;
    }
    if (next === "directory") setFocusMember(null);
    setView(next);
    setMobile(false);
    window.location.hash = next;
    window.scrollTo({
      top: 0,
      behavior:
        document.documentElement.dataset.reduceMotion === "true"
          ? "instant"
          : "smooth",
    });
  };
  useEffect(() => {
    const read = () => {
      const v = window.location.hash.slice(1);
      setView(v in views ? (v as View) : "home");
    };
    const tab = new URLSearchParams(window.location.search).get("profileTab");
    if (
      tab &&
      [
        "verification",
        "following",
        "edit",
        "accompaniments",
        "requests",
        "emails",
        "appearance",
        "tasks",
      ].includes(tab)
    )
      setProfileTab(tab);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isPending) return;
    if (!session && (params.has("profileTab") || params.has("member"))) {
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
  return (
    <div className={inWorkspace ? "workspace-shell" : "public-shell"}>
      <ActivityTracker userId={session?.user.id} />
      {inWorkspace && session ? (
        <WorkspaceNav
          view={view}
          profileTab={selectedProfileTab}
          adminTab={adminTab}
          mentor={profile?.role === "mentor"}
          moderator={showAdmin}
          crmOwner={
            showAdmin &&
            session.user.email.toLowerCase() === "thibault.cordiez@hotmail.com"
          }
          name={session.user.name}
          discordUrl={DISCORD_GROUP}
          onNavigate={(next, tab) => {
            go(next);
            if (tab && next === "profile") setProfileTab(tab);
            if (tab && next === "moderation") setAdminTab(tab);
          }}
          onSignOut={() => {
            void authClient.signOut().then(() => go("home"));
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
      <main id="workspace-content">
        {!isPending && session && view === "menu" && (
          <WorkspaceMenuPage
            mentor={profile?.role === "mentor"}
            moderator={showAdmin}
            crmOwner={
              showAdmin &&
              session.user.email.toLowerCase() ===
                "thibault.cordiez@hotmail.com"
            }
            discordUrl={DISCORD_GROUP}
            onNavigate={(next, tab) => {
              go(next);
              if (tab && next === "profile") setProfileTab(tab);
              if (tab && next === "moderation") setAdminTab(tab);
            }}
            onSignOut={() => {
              void authClient.signOut().then(() => go("home"));
            }}
          />
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
        {session &&
          inWorkspace &&
          profile?.role === "mentor" &&
          !profile.verification &&
          !verificationDismissed &&
          !authMode &&
          !(view === "profile" && selectedProfileTab === "appearance") && (
            <aside
              className="verification-invite"
              aria-label={translateUi("Faire vérifier mon compte de parrain")}
            >
              <button
                className="verification-invite-close"
                aria-label={translateUi("Fermer le rappel de vérification")}
                onClick={() => setVerificationDismissed(true)}
              >
                <X size={18} />
              </button>
              <ShieldCheck size={26} />
              <h2>
                {translateUi("Faire v\u00E9rifier mon compte de parrain")}
              </h2>
              <p>
                {translateUi(
                  "Pr\u00E9sente ton exp\u00E9rience en achat-revente pour obtenir ton badge. D\u00E9j\u00E0 envoy\u00E9 ? Retrouve ici le suivi de ton dossier.",
                )}
              </p>
              <button
                className="btn"
                onClick={() => {
                  go("profile");
                  setProfileTab("verification");
                }}
              >
                {translateUi("Faire v\u00E9rifier mon compte")}
              </button>
            </aside>
          )}

        {!isPending && session && showAdmin && view === "moderation" && (
          <AdminDashboard
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
        {isPending && (
          <div className="empty">
            <LoaderCircle className="spin" />
            {translateUi(" Chargement\u2026")}
          </div>
        )}
        {!isPending && view === "home" && (
          <>
            <section className="hero wrap">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="status-dot" />
                  {translateUi(" LA COMMUNAUT\u00C9 DES RESELLERS")}
                </span>
                <h1>
                  {translateUi("L\u2019entraide entre resellers commence ")}
                  <span>{translateUi("ici.")}</span>
                  <svg
                    className="underline"
                    viewBox="0 0 350 20"
                    aria-hidden="true"
                  >
                    <path d="M4 12 Q160 -4 344 10 M20 18 Q170 5 315 15" />
                  </svg>
                </h1>
                <p>
                  {translateUi("Tu d\u00E9butes dans ")}
                  <strong>
                    {translateUi("l\u2019achat-revente de v\u00EAtements")}
                  </strong>
                  {translateUi(
                    " ? \u00C9change avec des revendeurs exp\u00E9riment\u00E9s pour progresser sur Vinted, Leboncoin, eBay, Whatnot et bien d\u2019autres plateformes.",
                  )}
                </p>
                <div className="hero-buttons">
                  <Button
                    onClick={() => {
                      setRole("beginner");
                      go("directory");
                    }}
                  >
                    {translateUi("Trouver mon parrain ")}
                    <ArrowUpRight size={19} />
                  </Button>
                  <Button secondary onClick={() => join("mentor")}>
                    {translateUi("Devenir parrain")}
                  </Button>
                </div>
                <div className="hero-proof">
                  <span>
                    <Check size={15} />
                    {translateUi(" B\u00EAta gratuite pour le moment")}
                  </span>
                  <span>
                    <Check size={15} />
                    {translateUi(" Entraide entre membres")}
                  </span>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label={translateUi(
                  "Illustration d’un binôme : un débutant pose ses questions et un parrain partage son expérience",
                )}
              >
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="spark star-one">✳</div>
                <div className="floating-note">
                  <span className="status-dot" />
                  {translateUi(" Un message peut tout d\u00E9bloquer.")}
                </div>
                <div className="person-card mentor-card">
                  <span className="card-kicker">
                    <Sparkles size={14} />
                    {translateUi(" LE COUP DE POUCE")}
                  </span>
                  <div className="person-heading">
                    <div className="illustrated-avatar purple">
                      <span>✦</span>
                    </div>
                    <div>
                      <h3>{translateUi("Ton futur parrain")}</h3>
                      <span>
                        {translateUi("D\u00E9j\u00E0 pass\u00E9 par l\u00E0.")}
                      </span>
                    </div>
                    <span className="mini-check">
                      <Check size={16} />
                    </span>
                  </div>
                  <div className="mini-tags">
                    <span>{translateUi("De l\u2019exp\u00E9rience")}</span>
                    <span>{translateUi("De bons conseils")}</span>
                  </div>
                </div>
                <div className="connector-line" />
                <div className="chat-bubble bubble-one">
                  {translateUi(
                    "J\u2019ai trouv\u00E9 ma premi\u00E8re pi\u00E8ce.",
                  )}
                  <br />
                  {translateUi("Tu m\u2019aides \u00E0 fixer le prix ? ")}
                  <span>↗</span>
                </div>
                <div className="chat-bubble bubble-two">
                  {translateUi("Bien s\u00FBr, on regarde \u00E7a ensemble ! ")}
                  <CheckCheck size={16} />
                </div>
                <div className="person-card beginner-card">
                  <span className="card-kicker">
                    <Sprout size={14} />
                    {translateUi(" LE PROCHAIN CHAPITRE")}
                  </span>
                  <div className="person-heading">
                    <div className="illustrated-avatar peach">
                      <span>↗</span>
                    </div>
                    <div>
                      <h3>{translateUi("Toi, bien accompagn\u00E9.")}</h3>
                      <span>
                        {translateUi("Un cap apr\u00E8s l\u2019autre.")}
                      </span>
                    </div>
                  </div>
                  <div className="progress-label">
                    <span>
                      {translateUi("La confiance, \u00E7a se construit.")}
                    </span>
                    <HeartHandshake size={17} />
                  </div>
                  <div className="mini-progress">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <span className="art-caption">
                  {translateUi(
                    "Un bin\u00F4me. Des \u00E9changes. De vraies avanc\u00E9es.",
                  )}
                </span>
              </div>
            </section>
            <section className="wrap concrete-help">
              <span className="eyebrow">
                {translateUi(
                  "CONCR\u00C8TEMENT, TON PARRAIN PEUT T\u2019AIDER \u00C0\u2026",
                )}
              </span>
              <h2>
                {translateUi("Des r\u00E9ponses \u00E0 tes vraies questions.")}
              </h2>
              <div className="help-grid">
                {[
                  [
                    "01",
                    "Choisir entre bot et fournisseur",
                    "Comparer les méthodes de sourcing selon ton budget, ton temps disponible et les pièces que tu veux vendre. Tu comprends les coûts et les contraintes avant de te lancer.",
                  ],
                  [
                    "02",
                    "Améliorer tes annonces Vinted",
                    "Revoir tes photos, ton titre, ta description et ton prix avec un regard expérimenté. Tu repars avec des modifications concrètes à appliquer.",
                  ],
                  [
                    "03",
                    "Débloquer une pièce qui ne se vend pas",
                    "Comprendre ce qui freine la vente : prix, saison, demande, présentation… Puis décider quoi ajuster, sans promesse de vente garantie.",
                  ],
                  [
                    "04",
                    "Apprendre à vérifier tes articles",
                    "Apprendre à observer étiquettes, coutures, références et finitions, puis chercher les bons points de comparaison. Pour devenir autonome et savoir quand demander une expertise spécialisée.",
                  ],
                ].map(([n, title, description]) => (
                  <article key={n}>
                    <span>{translateUi(n)}</span>
                    <h3>{translateUi(title)}</h3>
                    <p>{translateUi(description)}</p>
                  </article>
                ))}
              </div>
              <p className="small-text">
                {translateUi(
                  "Selon ses sp\u00E9cialit\u00E9s, ton parrain t\u2019explique sa d\u00E9marche par messages. Il t\u2019aide \u00E0 apprendre ; il ne certifie pas l\u2019authenticit\u00E9 de tes pi\u00E8ces.",
                )}
              </p>
            </section>
            <section className="promise-strip">
              <div className="wrap promise-inner">
                <span>
                  <MessageCircle />
                  {translateUi(" Des \u00E9changes sur Discord")}
                </span>
                <span>
                  <Clock />
                  {translateUi(" Pas d\u2019appels impos\u00E9s")}
                </span>
                <span>
                  <Users />
                  {translateUi(" Un r\u00E9seau qui grandit")}
                </span>
                <span>
                  <HeartHandshake />
                  {translateUi(" L\u2019exp\u00E9rience se partage")}
                </span>
              </div>
            </section>
            <section className="wrap section">
              <div className="section-top">
                <div>
                  <span className="eyebrow">
                    {translateUi("CHACUN SON POINT DE D\u00C9PART")}
                  </span>
                  <h2>{translateUi("Tu es au bon endroit.")}</h2>
                </div>
                <p>
                  {translateUi("On a tous \u00E9t\u00E9 d\u00E9butants.")}
                  <br />
                  {translateUi("On peut tous faire la diff\u00E9rence.")}
                </p>
              </div>
              <div className="role-grid">
                <article className="role-card">
                  <Icon>
                    <Sprout />
                  </Icon>
                  <span className="role-label">
                    {translateUi("JE D\u00C9MARRE")}
                  </span>
                  <h3>
                    {translateUi("Moins de doutes.")}
                    <br />
                    {translateUi("Plus de premiers pas.")}
                  </h3>
                  <p>
                    {translateUi(
                      "Sourcing, prix, annonces, premi\u00E8res ventes\u2026 Pose tes questions \u00E0 quelqu\u2019un qui conna\u00EEt le chemin.",
                    )}
                  </p>
                  <ul>
                    <li>
                      <Check />
                      {translateUi(" Un interlocuteur qui te conna\u00EEt")}
                    </li>
                    <li>
                      <Check />
                      {translateUi(
                        " Des conseils adapt\u00E9s \u00E0 tes objectifs",
                      )}
                    </li>
                    <li>
                      <Check />
                      {translateUi(" Un accompagnement par messages")}
                    </li>
                  </ul>
                  <button className="text-btn" onClick={() => join("beginner")}>
                    {translateUi("Je cherche un parrain ")}
                    <ArrowRight size={18} />
                  </button>
                </article>
                <article className="role-card mentor-role">
                  <Icon>
                    <Sparkles />
                  </Icon>
                  <span className="role-label">
                    {translateUi("JE TRANSMETS")}
                  </span>
                  <h3>
                    {translateUi("Ton exp\u00E9rience a")}
                    <br />
                    {translateUi("de la valeur. Partage-la.")}
                  </h3>
                  <p>
                    {translateUi(
                      "Tu fais de l\u2019achat-revente depuis au moins 6 mois ? Aide un d\u00E9butant \u00E0 progresser et cr\u00E9e des liens qui durent.",
                    )}
                  </p>
                  <ul>
                    <li>
                      <Check />
                      {translateUi(" Tu choisis tes disponibilit\u00E9s")}
                    </li>
                    <li>
                      <Check />
                      {translateUi(" Tu fixes le nombre de places")}
                    </li>
                    <li>
                      <Check />
                      {translateUi(
                        " Tu construis ton r\u00E9seau, naturellement",
                      )}
                    </li>
                  </ul>
                  <button className="text-btn" onClick={() => join("mentor")}>
                    {translateUi("Je deviens parrain ")}
                    <ArrowRight size={18} />
                  </button>
                </article>
              </div>
            </section>
            <section className="wrap steps-section">
              <div className="section-top">
                <div>
                  <span className="eyebrow">
                    {translateUi("SIMPLE COMME UN BONJOUR")}
                  </span>
                  <h2>
                    {translateUi("Le bon bin\u00F4me, en trois \u00E9tapes.")}
                  </h2>
                </div>
                <button className="text-btn" onClick={() => go("guide")}>
                  {translateUi("Comment \u00E7a marche ")}
                  <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="steps-grid">
                {[
                  [
                    "01",
                    "Raconte-nous où tu en es.",
                    "Crée ton profil et partage tes objectifs, tes spécialités et tes disponibilités.",
                  ],
                  [
                    "02",
                    "Trouve la bonne personne.",
                    "Explore les profils. Un point commun, un rythme compatible : le contact commence ici.",
                  ],
                  [
                    "03",
                    "La suite se passe sur Discord.",
                    "Ajoutez-vous, définissez votre rythme et avancez ensemble, un message à la fois.",
                  ],
                ].map(([n, t, d]) => (
                  <article key={n}>
                    <span className="step-num">{translateUi(n)}</span>
                    <h3>{translateUi(t)}</h3>
                    <p>{translateUi(d)}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="wrap">
              <div className="bottom-cta">
                <span className="cta-spark">✳</span>
                <div>
                  <span className="eyebrow">
                    {translateUi("LE R\u00C9SEAU COMMENCE \u00C0 DEUX.")}
                  </span>
                  <h2>
                    {translateUi("Tu n\u2019as pas \u00E0 tout trouver seul.")}
                  </h2>
                  <p>
                    {translateUi(
                      "Le prochain message pourrait \u00EAtre le d\u00E9but d\u2019une belle rencontre.",
                    )}
                  </p>
                </div>
                <Button onClick={() => join("beginner")}>
                  {translateUi("Cr\u00E9er mon profil ")}
                  <ArrowUpRight size={19} />
                </Button>
              </div>
            </section>
          </>
        )}
        {!isPending && session && view === "directory" && (
          <Directory
            key={preview || "normal"}
            preview={!!preview}
            session={!!session}
            onFollowChange={refreshProfile}
            initialTarget={focusMember}
            own={profile}
            initialRole={(preview || role) === "mentor" ? "beginner" : "mentor"}
            onJoin={() => setAuthMode("signup")}
            onProfile={() => go("profile")}
            notify={notify}
          />
        )}
        {!isPending && view === "help" && <Help />}
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
          <section className="wrap profile-page" inert={!!preview}>
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
            ) : selectedProfileTab === "tasks" ? (
              <TodoLists />
            ) : selectedProfileTab === "appearance" ? (
              <MemberSettings
                mentor={profile?.role === "mentor"}
                onVerificationChange={refreshProfile}
                initialSection={
                  profileTab === "verification"
                    ? "verification"
                    : profileTab === "emails"
                      ? "notifications"
                      : "general"
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
                <div className="profile-toolbar">
                  <span className={`badge ${profile.visible ? "green" : ""}`}>
                    {profile.visible ? <Eye size={14} /> : <EyeOff size={14} />}{" "}
                    {translateUi(
                      profile.visible
                        ? "Visible dans l’annuaire"
                        : "Profil masqué",
                    )}
                  </span>
                  <button
                    className="text-btn muted"
                    onClick={async () => {
                      await authClient.signOut();
                      go("home");
                    }}
                  >
                    <LogOut size={16} />
                    {translateUi(" Se d\u00E9connecter")}
                  </button>
                </div>
                <nav
                  className="profile-tabs"
                  aria-label={translateUi("Rubriques de mon profil")}
                >
                  {[
                    ["following", "Suivi"],
                    ["edit", "Modifier mon profil"],
                    ["accompaniments", "Mes accompagnements"],
                    ["requests", "Demandes"],
                    ["appearance", "Paramètres"],
                    ["tasks", "To-do list"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-current={
                        selectedProfileTab === id ? "page" : undefined
                      }
                      onClick={() => {
                        setProfileTab(id);
                      }}
                    >
                      {translateUi(label)}
                    </button>
                  ))}
                </nav>
                <div className="profile-tab-content">
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
                    <Accompaniments
                      key={selectedProfileTab}
                      mode={selectedProfileTab}
                      onChange={refreshProfile}
                    />
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {!isPending && inWorkspace && view !== "menu" && (
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
          <footer className="footer wrap">
            <a className="brand" href="#home" onClick={() => go("home")}>
              <span className="brand-mark">
                <BrandLogo />
              </span>
              {translateUi("mentora")}
              <span className="brand-dot">.</span>
            </a>
            <p>{translateUi("On avance mieux ensemble.")}</p>
            <button onClick={() => go("guide")}>
              {translateUi("La charte d\u2019entraide")}
            </button>
            <span>
              {translateUi("Une initiative ind\u00E9pendante, entre membres.")}
            </span>
          </footer>
        </>
      )}
      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          role={role}
          setRole={setRole}
          close={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            const params = new URLSearchParams(window.location.search);
            const target =
              authMode === "signup" || params.has("profileTab")
                ? "profile"
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
function ProfileForm({
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
function ProfileCard({
  p,
  onOpen,
  own = false,
  canRequest = false,
}: {
  p: PublicProfile;
  onOpen: () => void;
  own?: boolean;
  canRequest?: boolean;
}) {
  const experience =
    p.experience >= 12
      ? `${Math.floor(p.experience / 12)} an${p.experience >= 24 ? "s" : ""} d’expérience`
      : `${p.experience} mois d’expérience`;
  return (
    <article className="member-card redesigned-card">
      <div className="mentor-card-head">
        <Avatar profile={p} />
        <div className="mentor-card-title">
          <h3>{p.name}</h3>
          <p>
            {translateUi(
              p.role === "mentor" ? (
                <>
                  <ShieldCheck size={17} />
                  {translateUi(
                    p.verification ? "Parrain vérifié" : "Parrain non vérifié",
                  )}{" "}
                  · {translateUi(experience)}
                </>
              ) : p.availableSince ? (
                "Revendeur débutant · cherche un parrain"
              ) : (
                "Revendeur débutant · accompagné"
              ),
            )}
          </p>
        </div>
        <AvailabilityBadge profile={p} />
      </div>
      <div className="mini-tags">
        {p.specialty.map((s) => (
          <span key={s}>{translateUi(s)}</span>
        ))}
        {p.references && <span>{p.references.split(",")[0].slice(0, 50)}</span>}
      </div>
      <FollowCounts profile={p} />
      <p className="card-quote">« {p.bio} »</p>
      {p.role === "mentor" ? (
        <>
          <div className="card-stats">
            <div>
              <strong>
                {translateUi(
                  p.ratingCount
                    ? `${Number(p.ratingAverage).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5`
                    : "—",
                )}
              </strong>
              <span>
                {translateUi(
                  p.ratingCount ? `${p.ratingCount} avis` : "Pas encore d’avis",
                )}
              </span>
            </div>
            <div>
              <strong>{p.completedCount ?? 0}</strong>
              <span>{translateUi("Bin\u00F4mes termin\u00E9s")}</span>
            </div>
            <div>
              <strong>
                {translateUi(p.responseTime.replace("Sous ", ""))}
              </strong>
              <span>{translateUi("D\u00E9lai annonc\u00E9")}</span>
            </div>
          </div>
          <p className="card-active">
            {p.activeCount ?? 0}
            {translateUi(" accompagnement")}
            {translateUi((p.activeCount ?? 0) > 1 ? "s" : "")}
            {translateUi(" en cours")}
          </p>
          <div className="card-teaching">
            <h4>{translateUi("Ce qu\u2019il peut t\u2019apprendre")}</h4>
            <p>
              {p.teaching ||
                "Ses conseils précis sont à définir ensemble selon ses spécialités."}
            </p>
          </div>
        </>
      ) : (
        <div className="card-teaching">
          <h4>{translateUi("Ses objectifs")}</h4>
          <p>{p.goals}</p>
        </div>
      )}
      <button className="card-btn" onClick={onOpen}>
        {translateUi(own ? "Modifier mon profil" : "Découvrir le profil")}{" "}
        <ArrowUpRight size={17} />
      </button>
    </article>
  );
}
function Directory({
  preview = false,
  onFollowChange,
  initialTarget,
  session,
  own,
  initialRole,
  onJoin,
  onProfile,
  notify,
}: {
  preview?: boolean;
  onFollowChange: () => Promise<void>;
  initialTarget: PublicProfile | null;
  session: boolean;
  own: Profile | null;
  initialRole: "mentor" | "beginner";
  onJoin: () => void;
  onProfile: () => void;
  notify: (s: string) => void;
}) {
  const [role, setRole] = useState(initialTarget?.role || initialRole);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [time, setTime] = useState("");
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
          role,
          q: search,
          specialty,
          time,
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
  }, [role, search, specialty, time, page, reload]);
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
        role,
        q: search,
        specialty,
        time,
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
    <section className="wrap directory">
      <div className="directory-heading">
        <div className="page-heading">
          <span className="eyebrow">
            {translateUi("LES BONNES PERSONNES, AU BON MOMENT")}
          </span>
          <h1>
            {translateUi("Trouve ton bin\u00F4me")}
            <span>.</span>
          </h1>
          <p>
            {translateUi(
              "Des revendeurs d\u00E9butants et exp\u00E9riment\u00E9s, r\u00E9unis pour progresser dans l\u2019achat-revente.",
            )}
          </p>
        </div>
        <div className="directory-doodle">
          <Users size={40} />
          <span>
            {translateUi("\u00C7a commence")}
            <br />
            {translateUi("par un bonjour.")}
          </span>
        </div>
      </div>
      <div className="directory-tabs">
        <button
          className={role === "mentor" ? "selected" : ""}
          onClick={() => {
            setRole("mentor");
            setPage(0);
          }}
        >
          <Sparkles size={18} />
          {translateUi(" Les parrains")}
        </button>
        <button
          className={role === "beginner" ? "selected" : ""}
          onClick={() => {
            setRole("beginner");
            setPage(0);
          }}
        >
          <Sprout size={18} />
          {translateUi(" Les d\u00E9butants")}
        </button>
      </div>
      <div className="filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label={translateUi("Rechercher un membre")}
            placeholder={translateUi("Un prénom, une marque, un mot-clé…")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <label className="filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label={translateUi("Spécialité")}
            value={specialty}
            onChange={(e) => {
              setSpecialty(e.target.value);
              setPage(0);
            }}
          >
            <option value="">
              {translateUi("Toutes les sp\u00E9cialit\u00E9s")}
            </option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {translateUi(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <Clock size={16} />
          <select
            aria-label={translateUi("Disponibilités")}
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setPage(0);
            }}
          >
            <option value="">
              {translateUi("Toutes les disponibilit\u00E9s")}
            </option>
            {times.map((s) => (
              <option key={s} value={s}>
                {translateUi(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="results-label">
        <span>
          {translateUi(
            busy
              ? "Recherche en cours…"
              : `${total} ${role === "mentor" ? "parrain" : "débutant"}${total > 1 ? "s" : ""} disponible${total > 1 ? "s" : ""}`,
          )}
        </span>
        <span>
          <ShieldCheck size={14} />
          {translateUi(
            " Badges v\u00E9rifi\u00E9s apr\u00E8s examen \u00B7 autres informations d\u00E9claratives",
          )}
        </span>
      </div>
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
            <ProfileCard
              key={p.id}
              p={p}
              onOpen={() => open(p)}
              canRequest={own?.role === "beginner" && p.id !== own.id}
            />
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
              search || specialty || time
                ? "Pas encore de profil pour ces critères."
                : "Les belles rencontres commencent avec les premiers membres.",
            )}
          </h2>
          <p>
            {translateUi(
              search || specialty || time
                ? "Essaie une autre spécialité ou élargis tes disponibilités."
                : `L’annuaire attend ses premiers ${role === "mentor" ? "parrains" : "débutants"}. Crée ton profil et fais connaître Mentora aux membres de ta formation.`,
            )}
          </p>
          <Button
            onClick={
              search || specialty || time
                ? () => {
                    setSearch("");
                    setSpecialty("");
                    setTime("");
                    setPage(0);
                  }
                : session
                  ? onProfile
                  : onJoin
            }
          >
            {translateUi(
              search || specialty || time
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
            className="modal member-modal"
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
            <Avatar profile={selected} />
            <span className="eyebrow">
              {translateUi(selected.role === "mentor" ? "PARRAIN" : "DÉBUTANT")}{" "}
              ·{" "}
              {translateUi(
                selected.specialty.join(" · ") || "Spécialités à préciser",
              )}
            </span>
            <h2 id="member-title">{selected.name}</h2>
            <VerificationBadge profile={selected} />
            <FollowCounts profile={selected} />
            <ProfileDates profile={selected} />
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
            {selected.role === "mentor" && (
              <RatingSummary
                average={selected.ratingAverage}
                count={selected.ratingCount}
              />
            )}
            {selected.role === "mentor" && (
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
            <div className="detail-grid">
              <div>
                <small>{translateUi("Exp\u00E9rience")}</small>
                <strong>
                  {selected.experience}
                  {translateUi(" mois")}
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
              {selected.role === "mentor" &&
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
            <h3>
              {translateUi(
                selected.role === "mentor"
                  ? "Ce que je peux t’apporter"
                  : "Mes objectifs",
              )}
            </h3>
            <p>
              {selected.role === "mentor"
                ? selected.teaching || selected.goals
                : selected.goals}
            </p>
            {selected.references && (
              <>
                <h3>{translateUi("Marques & r\u00E9f\u00E9rences")}</h3>
                <p>{selected.references}</p>
              </>
            )}
            <p className="small-text">
              {translateUi(
                "Informations d\u00E9clar\u00E9es par le membre, non v\u00E9rifi\u00E9es. Aucun r\u00E9sultat financier garanti.",
              )}
            </p>
            {contact ? (
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
            ) : null}
            {translateUi(
              contactError && (
                <p role="alert" className="error">
                  {translateUi(contactError)}
                </p>
              ),
            )}
          </section>
        </div>
      )}
    </section>
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
function Guide({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="wrap guide">
      <div className="page-heading">
        <span className="eyebrow">
          {translateUi("L\u2019ENTRAIDE, TOUT SIMPLEMENT")}
        </span>
        <h1>
          {translateUi("Un bin\u00F4me aujourd\u2019hui.")}
          <br />
          <span>{translateUi("Un r\u00E9seau pour demain.")}</span>
        </h1>
        <p>
          {translateUi(
            "Quand les questions se perdent parmi des centaines de messages, un interlocuteur d\u00E9di\u00E9 peut faire toute la diff\u00E9rence.",
          )}
        </p>
      </div>
      <div className="guide-intro">
        <Icon>
          <HeartHandshake />
        </Icon>
        <div>
          <h2>{translateUi("Le principe de Mentora")}</h2>
          <p>
            {translateUi(
              "Un membre exp\u00E9riment\u00E9 accompagne un d\u00E9butant en achat-revente de v\u00EAtements. Il r\u00E9pond \u00E0 ses questions, partage son exp\u00E9rience et l\u2019aide \u00E0 avancer. Les \u00E9changes se passent sur Discord, sans obligation d\u2019appel, selon le rythme choisi ensemble.",
            )}
          </p>
          <p>
            {translateUi(
              "\u00C0 mesure que les d\u00E9butants progressent, les liens restent. Et ceux qui ont \u00E9t\u00E9 aid\u00E9s peuvent, \u00E0 leur tour, transmettre. C\u2019est ainsi qu\u2019un r\u00E9seau d\u2019entraide se construit.",
            )}
          </p>
        </div>
      </div>
      <div className="guide-grid">
        {[
          [
            Sprout,
            "Pour les débutants",
            "Tu n’as pas besoin d’avoir déjà vendu. Présente ton point de départ, tes objectifs et ce qui te bloque. Choisis un parrain dont la spécialité et le rythme te correspondent.",
          ],
          [
            Sparkles,
            "Pour les parrains",
            "Au moins 6 mois de pratique, de la disponibilité et l’envie d’aider. Tu indiques ton expérience, ton chiffre d’affaires si tu le souhaites et le nombre de débutants que tu peux accueillir.",
          ],
          [
            Clock,
            "La durée, c’est vous qui la fixez",
            "Deux semaines, un mois, plusieurs mois ou sans date de fin : les préférences du profil servent de point de départ. Confirmez la durée et les horaires ensemble sur Discord.",
          ],
          [
            EyeOff,
            "Un profil visible seulement quand il le faut",
            "Tu as trouvé ton binôme ou tu n’as plus de disponibilité ? Masque ton profil depuis « Mon profil ». Il disparaît de l’annuaire et son contact n’est plus accessible. Tu peux le réactiver à tout moment.",
          ],
        ].map(([I, title, text]) => {
          const Component = I as typeof Sprout;
          return (
            <article key={String(title)}>
              <Icon>
                <Component />
              </Icon>
              <h3>{translateUi(String(title))}</h3>
              <p>{translateUi(String(text))}</p>
            </article>
          );
        })}
      </div>
      <section className="guide-intro">
        <div>
          <h2>{translateUi("Une note apr\u00E8s l\u2019accompagnement")}</h2>
          <p>
            {translateUi(
              "Dans l\u2019annuaire, le d\u00E9butant clique sur \u00AB Choisir ce parrain \u00BB. Le parrain accepte depuis \u00AB Mon profil \u00BB, dans \u00AB Demandes \u00BB. \u00C0 la fin, l\u2019un des deux clique sur \u00AB Terminer l\u2019accompagnement \u00BB. Le d\u00E9butant peut alors publier une note de 1 \u00E0 5 \u00E9toiles, une seule fois pour ce bin\u00F4me. La moyenne et le nombre de notes apparaissent sur la fiche du parrain.",
            )}
          </p>
          <p>
            {translateUi(
              "Les notes proviennent de bin\u00F4mes confirm\u00E9s sur Mentora. Elles refl\u00E8tent l\u2019exp\u00E9rience des membres, sans v\u00E9rifier le contenu de leurs \u00E9changes sur Discord. Un profil masqu\u00E9 reste absent de l\u2019annuaire.",
            )}
          </p>
        </div>
      </section>
      <section className="charter">
        <span className="eyebrow">{translateUi("LA CHARTE MENTORA")}</span>
        <h2>
          {translateUi("De bonnes rencontres,")}
          <br />
          {translateUi("avec de bonnes bases.")}
        </h2>
        <div className="charter-grid">
          {[
            [
              "01",
              "De l’entraide, pas une prestation.",
              "Le parrainage Mentora est gratuit. Aucune vente de coaching ni demande d’argent en échange d’une réponse.",
            ],
            [
              "02",
              "Du respect, des deux côtés.",
              "Un parrain n’est pas disponible 24 h/24. Respectez les créneaux, les limites et le délai de réponse convenus.",
            ],
            [
              "03",
              "De l’expérience, pas des promesses.",
              "Les résultats et le chiffre d’affaires sont déclaratifs. Aucun montant de ventes ni bénéfice n’est garanti.",
            ],
            [
              "04",
              "De la confiance, sans tout partager.",
              "Ne partagez ni mots de passe, ni documents d’identité, ni données bancaires. Gardez vos échanges privés et respectez le consentement de chacun.",
            ],
            [
              "05",
              "La liberté de faire une pause.",
              "Chacun peut arrêter ou ajuster l’accompagnement. Prévenez votre binôme simplement et mettez à jour votre profil.",
            ],
            [
              "06",
              "Un cadre bienveillant.",
              "En cas de comportement inapproprié, interrompez l’échange, bloquez la personne sur Discord et contactez la modération de votre formation.",
            ],
          ].map(([n, t, d]) => (
            <article key={n}>
              <span>{translateUi(n)}</span>
              <div>
                <h3>{translateUi(t)}</h3>
                <p>{translateUi(d)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="verification-panel">
        <h2>
          {translateUi(
            "Un badge fond\u00E9 sur un dossier, pas seulement sur l\u2019anciennet\u00E9.",
          )}
        </h2>
        <p>
          {translateUi(
            "Pour demander le badge \u00AB Dossier v\u00E9rifi\u00E9 \u00BB, le parrain renseigne son exp\u00E9rience, ses plateformes, son volume de ventes, ses domaines d\u2019aide et sa motivation. La mod\u00E9ration examine ses justificatifs de fa\u00E7on confidentielle avant de prendre une d\u00E9cision.",
          )}
        </p>
        <p>
          {translateUi(
            "Le badge affiche les domaines examin\u00E9s et la date de v\u00E9rification. Sans validation, le profil indique \u00AB Exp\u00E9rience d\u00E9clar\u00E9e \u00B7 non v\u00E9rifi\u00E9e \u00BB. Ce contr\u00F4le ne garantit pas les r\u00E9sultats, la p\u00E9dagogie ou l\u2019authenticit\u00E9 d\u2019un article.",
          )}
        </p>
      </section>
      <FAQ />
      <div className="bottom-cta">
        <div>
          <h2>{translateUi("Pr\u00EAt \u00E0 faire le premier pas ?")}</h2>
          <p>
            {translateUi(
              "Pr\u00E9sente-toi. Quelqu\u2019un a peut-\u00EAtre exactement le conseil qu\u2019il te faut.",
            )}
          </p>
        </div>
        <Button onClick={onJoin}>
          {translateUi("Rejoindre Mentora ")}
          <ArrowUpRight size={18} />
        </Button>
      </div>
    </section>
  );
}
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
function FAQ() {
  return (
    <section className="faq">
      <span className="eyebrow">
        {translateUi("ON R\u00C9POND \u00C0 TES QUESTIONS")}
      </span>
      <h2>{translateUi("Avant de te lancer.")}</h2>
      {[
        [
          "Dois-je avoir un certain chiffre d’affaires pour être parrain ?",
          "Non. Le badge est attribué après un examen confidentiel du questionnaire et des justificatifs par la modération. Deux types de justificatifs différents sont conseillés si possible. L’ancienneté et le chiffre d’affaires déclarés ne suffisent pas à obtenir un badge.",
        ],
        [
          "Est-ce que Mentora envoie une demande d’amis automatiquement ?",
          "Non. Après acceptation de votre demande, tu copies le pseudo de ton binôme et l’ajoutes dans Discord. Si le membre a renseigné son identifiant numérique, un bouton ouvre directement son profil Discord.",
        ],
        [
          "Puis-je accompagner plusieurs débutants ?",
          "Oui. Indique le nombre maximum de débutants que tu peux accompagner en même temps, jusqu’à 10. Les accompagnements acceptés et en cours sont déduits automatiquement. Une place se libère à la fin de chaque accompagnement. Avec une capacité réglée sur 0, ton profil ne figure plus dans l’annuaire.",
        ],
        [
          "Qui peut voir mes informations ?",
          "Le site et les profils visibles sont publics, sauf les pseudos Discord qui sont réservés aux binômes dont la demande a été acceptée. Ton adresse e-mail n’est jamais affichée dans l’annuaire. Tu peux modifier, masquer ou supprimer ton profil depuis ton espace.",
        ],
        [
          "Est-ce le site officiel de la formation ?",
          "Mentora est une initiative indépendante entre membres. Il ne remplace ni la formation ni son équipe, et ne prétend pas être affilié à ses créateurs.",
        ],
      ].map(([q, a]) => (
        <details key={q}>
          <summary>
            {translateUi(q)}
            <ChevronDown size={18} />
          </summary>
          <p>{translateUi(a)}</p>
        </details>
      ))}
    </section>
  );
}
