"use client";
import { useState, useEffect, useCallback, type FormEvent } from "react";
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
const DISCORD_GROUP = "https://discord.gg/SRVs9Y5ze";
type View = "home" | "directory" | "guide" | "profile";
const views: Record<View, string> = {
  home: "Accueil",
  directory: "Trouver mon binôme",
  guide: "Comment ça marche",
  profile: "Mon profil",
};
const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="icon-box">{children}</span>
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
    {children}
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
export default function App() {
  const [view, setView] = useState<View>("home");
  const [mobile, setMobile] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [role, setRole] = useState<"mentor" | "beginner">("beginner");
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const go = (next: View) => {
    setView(next);
    setMobile(false);
    setEditing(false);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const read = () => {
      const v = window.location.hash.slice(1);
      if (v in views) setView(v as View);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const loadMe = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      setProfile((await api("/api/me")).profile);
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileLoading(false);
    }
  }, []);
  useEffect(() => {
    if (session) void loadMe();
    else setProfile(null);
  }, [session, loadMe]);
  const join = (r: "mentor" | "beginner") => {
    setRole(r);
    if (session) {
      go("profile");
      setEditing(!profile);
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
    <>
      <header className="header">
        <div className="nav-wrap">
          <a
            href="#home"
            className="brand"
            aria-label="Relais, accueil"
            onClick={() => go("home")}
          >
            <span className="brand-mark">
              <HeartHandshake size={25} />
            </span>
            relais<span className="brand-dot">.</span>
          </a>
          <nav
            aria-label="Navigation principale"
            className={mobile ? "open" : ""}
          >
            {(Object.keys(views) as View[]).slice(0, 3).map((v) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={view === v ? "active" : ""}
              >
                {views[v]}
              </button>
            ))}
          </nav>
          <div className="nav-actions">
            <a
              className="discord-nav"
              aria-label="Rejoindre le groupe Discord"
              href={DISCORD_GROUP}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={17} />
              <span>Notre Discord</span>
            </a>
            {session ? (
              <button className="account" onClick={() => go("profile")}>
                <span className="avatar small">
                  {session.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>Mon profil</span>
              </button>
            ) : (
              <>
                <button
                  className="login-link"
                  onClick={() => setAuthMode("login")}
                >
                  Se connecter
                </button>
                <button
                  className="btn small-btn"
                  onClick={() => join("beginner")}
                >
                  Rejoindre <ArrowUpRight size={16} />
                </button>
              </>
            )}
            <button
              className="mobile-toggle"
              aria-label="Ouvrir le menu"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <main>
        {view === "home" && (
          <>
            <section className="hero wrap">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="status-dot" /> L’ENTRAIDE QUI FAIT GRANDIR
                </span>
                <h1>
                  Ton prochain cap,
                  <br />
                  on le passe
                  <br />
                  <span>ensemble.</span>
                  <svg
                    className="underline"
                    viewBox="0 0 350 20"
                    aria-hidden="true"
                  >
                    <path d="M4 12 Q160 -4 344 10 M20 18 Q170 5 315 15" />
                  </svg>
                </h1>
                <p>
                  Des centaines de messages sur Discord.
                  <br />
                  Et si tu avais enfin <strong>
                    ta personne de confiance
                  </strong>{" "}
                  pour avancer dans l’achat-revente ?
                </p>
                <div className="hero-buttons">
                  <Button
                    onClick={() => {
                      setRole("beginner");
                      go("directory");
                    }}
                  >
                    Trouver mon parrain <ArrowUpRight size={19} />
                  </Button>
                  <Button secondary onClick={() => join("mentor")}>
                    Devenir parrain
                  </Button>
                </div>
                <div className="hero-proof">
                  <span>
                    <Check size={15} /> Gratuit & entre membres
                  </span>
                  <span>
                    <Check size={15} /> À ton rythme
                  </span>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="Illustration d’un binôme : un débutant pose ses questions et un parrain partage son expérience"
              >
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="spark star-one">✳</div>
                <div className="floating-note">
                  <span className="status-dot" /> Un message peut tout
                  débloquer.
                </div>
                <div className="person-card mentor-card">
                  <span className="card-kicker">
                    <Sparkles size={14} /> LE COUP DE POUCE
                  </span>
                  <div className="person-heading">
                    <div className="illustrated-avatar purple">
                      <span>✦</span>
                    </div>
                    <div>
                      <h3>Ton futur parrain</h3>
                      <span>Déjà passé par là.</span>
                    </div>
                    <span className="mini-check">
                      <Check size={16} />
                    </span>
                  </div>
                  <div className="mini-tags">
                    <span>De l’expérience</span>
                    <span>De bons conseils</span>
                  </div>
                </div>
                <div className="connector-line" />
                <div className="chat-bubble bubble-one">
                  J’ai trouvé ma première pièce.
                  <br />
                  Tu m’aides à fixer le prix ? <span>↗</span>
                </div>
                <div className="chat-bubble bubble-two">
                  Bien sûr, on regarde ça ensemble ! <CheckCheck size={16} />
                </div>
                <div className="person-card beginner-card">
                  <span className="card-kicker">
                    <Sprout size={14} /> LE PROCHAIN CHAPITRE
                  </span>
                  <div className="person-heading">
                    <div className="illustrated-avatar peach">
                      <span>↗</span>
                    </div>
                    <div>
                      <h3>Toi, bien accompagné.</h3>
                      <span>Un cap après l’autre.</span>
                    </div>
                  </div>
                  <div className="progress-label">
                    <span>La confiance, ça se construit.</span>
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
                  Un binôme. Des échanges. De vraies avancées.
                </span>
              </div>
            </section>
            <section className="promise-strip">
              <div className="wrap promise-inner">
                <span>
                  <MessageCircle /> Des échanges sur Discord
                </span>
                <span>
                  <Clock /> Pas d’appels imposés
                </span>
                <span>
                  <Users /> Un réseau qui grandit
                </span>
                <span>
                  <HeartHandshake /> L’expérience se partage
                </span>
              </div>
            </section>
            <section className="wrap section">
              <div className="section-top">
                <div>
                  <span className="eyebrow">CHACUN SON POINT DE DÉPART</span>
                  <h2>Tu es au bon endroit.</h2>
                </div>
                <p>
                  On a tous été débutants.
                  <br />
                  On peut tous faire la différence.
                </p>
              </div>
              <div className="role-grid">
                <article className="role-card">
                  <Icon>
                    <Sprout />
                  </Icon>
                  <span className="role-label">JE DÉMARRE</span>
                  <h3>
                    Moins de doutes.
                    <br />
                    Plus de premiers pas.
                  </h3>
                  <p>
                    Sourcing, prix, annonces, premières ventes… Pose tes
                    questions à quelqu’un qui connaît le chemin.
                  </p>
                  <ul>
                    <li>
                      <Check /> Un interlocuteur qui te connaît
                    </li>
                    <li>
                      <Check /> Des conseils adaptés à tes objectifs
                    </li>
                    <li>
                      <Check /> Un accompagnement par messages
                    </li>
                  </ul>
                  <button className="text-btn" onClick={() => join("beginner")}>
                    Je cherche un parrain <ArrowRight size={18} />
                  </button>
                </article>
                <article className="role-card mentor-role">
                  <Icon>
                    <Sparkles />
                  </Icon>
                  <span className="role-label">JE TRANSMETS</span>
                  <h3>
                    Ton expérience a<br />
                    de la valeur. Partage-la.
                  </h3>
                  <p>
                    Tu pratiques depuis au moins 6 mois ? Aide un débutant à
                    progresser et crée des liens qui durent.
                  </p>
                  <ul>
                    <li>
                      <Check /> Tu choisis tes disponibilités
                    </li>
                    <li>
                      <Check /> Tu fixes le nombre de places
                    </li>
                    <li>
                      <Check /> Tu construis ton réseau, naturellement
                    </li>
                  </ul>
                  <button className="text-btn" onClick={() => join("mentor")}>
                    Je deviens parrain <ArrowRight size={18} />
                  </button>
                </article>
              </div>
            </section>
            <section className="wrap steps-section">
              <div className="section-top">
                <div>
                  <span className="eyebrow">SIMPLE COMME UN BONJOUR</span>
                  <h2>Le bon binôme, en trois étapes.</h2>
                </div>
                <button className="text-btn" onClick={() => go("guide")}>
                  Comment ça marche <ArrowUpRight size={18} />
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
                    <span className="step-num">{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="wrap">
              <div className="bottom-cta">
                <span className="cta-spark">✳</span>
                <div>
                  <span className="eyebrow">LE RÉSEAU COMMENCE À DEUX.</span>
                  <h2>Tu n’as pas à tout trouver seul.</h2>
                  <p>
                    Le prochain message pourrait être le début d’une belle
                    rencontre.
                  </p>
                </div>
                <Button onClick={() => join("beginner")}>
                  Créer mon profil <ArrowUpRight size={19} />
                </Button>
              </div>
            </section>
          </>
        )}
        {view === "directory" && (
          <Directory
            session={!!session}
            own={profile}
            initialRole={role === "mentor" ? "beginner" : "mentor"}
            onJoin={() => setAuthMode("signup")}
            onProfile={() => go("profile")}
            notify={notify}
          />
        )}
        {view === "guide" && <Guide onJoin={() => join("beginner")} />}
        {view === "profile" && (
          <section className="wrap profile-page">
            <div className="page-heading">
              <span className="eyebrow">TON ESPACE</span>
              <h1>
                Mon profil<span>.</span>
              </h1>
              <p>Présente-toi, garde la main et avance à ton rythme.</p>
            </div>
            {isPending || profileLoading ? (
              <div className="empty">
                <LoaderCircle className="spin" /> Chargement de ton profil…
              </div>
            ) : !session ? (
              <div className="empty">
                <Icon>
                  <Users />
                </Icon>
                <h2>Ton histoire commence ici.</h2>
                <p>
                  Crée ton profil pour rencontrer les membres et partager vos
                  pseudos Discord.
                </p>
                <Button onClick={() => setAuthMode("signup")}>
                  Créer mon compte <ArrowRight size={18} />
                </Button>
                <button
                  className="text-btn"
                  onClick={() => setAuthMode("login")}
                >
                  J’ai déjà un compte
                </button>
              </div>
            ) : profileError ? (
              <div className="empty">
                <p role="alert">{profileError}</p>
                <Button onClick={() => void loadMe()}>Réessayer</Button>
              </div>
            ) : !profile || editing ? (
              <ProfileForm
                initial={
                  profile
                    ? { ...profile, consent: true }
                    : {
                        ...initialProfile,
                        name: session.user.name,
                        role,
                        experience: role === "mentor" ? 6 : 0,
                      }
                }
                onCancel={profile ? () => setEditing(false) : undefined}
                onSave={(p) => {
                  setProfile(p);
                  setEditing(false);
                  notify("Ton profil est enregistré. Bienvenue dans Relais !");
                }}
              />
            ) : (
              <>
                <div className="profile-toolbar">
                  <span className={`badge ${profile.visible ? "green" : ""}`}>
                    {profile.visible ? <Eye size={14} /> : <EyeOff size={14} />}{" "}
                    {profile.visible
                      ? "Visible dans l’annuaire"
                      : "Profil masqué"}
                  </span>
                  <button
                    className="text-btn muted"
                    onClick={async () => {
                      await authClient.signOut();
                      go("home");
                    }}
                  >
                    <LogOut size={16} /> Se déconnecter
                  </button>
                </div>
                <div className="profile-columns">
                  <ProfileCard
                    p={profile}
                    onOpen={() => setEditing(true)}
                    own
                  />
                  <aside className="profile-controls">
                    <Icon>{profile.visible ? <Eye /> : <EyeOff />}</Icon>
                    <h2>
                      {profile.role === "beginner"
                        ? "Tu as trouvé ton parrain ?"
                        : "Ton accompagnement est complet ?"}
                    </h2>
                    <p>
                      Masque ton profil : il disparaît de l’annuaire et son
                      contact n’est plus consultable. Tu pourras revenir quand
                      tu voudras.
                    </p>
                    <Button onClick={() => void visibility()} secondary>
                      {profile.visible ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}{" "}
                      {profile.visible
                        ? "Masquer mon profil"
                        : "Rendre mon profil visible"}
                    </Button>
                    <hr />
                    <p className="small-text">
                      Un contact déjà échangé ne peut pas être effacé du Discord
                      de l’autre personne.
                    </p>
                  </aside>
                </div>
                <div className="profile-foot">
                  <button
                    className="btn secondary"
                    onClick={() => setEditing(true)}
                  >
                    Modifier mon profil
                  </button>
                  <DeleteProfile
                    onDeleted={() => {
                      setProfile(null);
                      notify(
                        "Ton profil a été supprimé. Ton compte reste disponible.",
                      );
                    }}
                  />
                </div>
                <Accompaniments />
              </>
            )}
          </section>
        )}
      </main>
      <section className="wrap discord-community">
        <div>
          <span className="eyebrow">ON SE RETROUVE SUR DISCORD</span>
          <h2>La communauté t’attend.</h2>
          <p>
            Rejoins le groupe pour échanger avec les membres et retrouver ton
            binôme.
          </p>
        </div>
        <a
          className="btn"
          href={DISCORD_GROUP}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={19} /> Rejoindre le groupe Discord{" "}
          <ArrowUpRight size={17} />
        </a>
      </section>
      <footer className="footer wrap">
        <a className="brand" href="#home" onClick={() => go("home")}>
          <span className="brand-mark">
            <HeartHandshake size={21} />
          </span>
          relais<span className="brand-dot">.</span>
        </a>
        <p>On avance mieux ensemble.</p>
        <button onClick={() => go("guide")}>La charte d’entraide</button>
        <span>Une initiative indépendante, entre membres.</span>
      </footer>
      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          role={role}
          setRole={setRole}
          close={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            go("profile");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Fermer la notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
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
        <button className="close-btn" onClick={close} aria-label="Fermer">
          <X />
        </button>
        <Icon>
          <HeartHandshake />
        </Icon>
        <span className="eyebrow">BIENVENUE CHEZ RELAIS</span>
        <h2 id="auth-title">
          {mode === "signup"
            ? "Les bonnes rencontres commencent ici."
            : "Heureux de te retrouver."}
        </h2>
        <p>
          {mode === "signup"
            ? "Un compte, puis quelques questions pour trouver ton binôme."
            : "Connecte-toi pour retrouver ton profil."}
        </p>
        {mode === "signup" && (
          <div className="role-switch">
            <button
              className={role === "beginner" ? "selected" : ""}
              onClick={() => setRole("beginner")}
            >
              <Sprout /> Je suis débutant
            </button>
            <button
              className={role === "mentor" ? "selected" : ""}
              onClick={() => setRole("mentor")}
            >
              <Sparkles /> Je suis parrain
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Prénom ou surnom
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
            Adresse e-mail <span className="optional">privée</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus={mode === "login"}
            />
          </label>
          <label>
            Mot de passe
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
              Au moins 12 caractères. Conserve-le dans ton gestionnaire de mots
              de passe.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {mode === "signup" ? "Créer mon compte" : "Me connecter"}{" "}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Déjà membre ?" : "Pas encore membre ?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
          >
            {mode === "signup" ? "Se connecter" : "Créer un compte"}
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
      {label}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
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
        <span className="eyebrow">FAISONS CONNAISSANCE</span>
        <h2>Le bon binôme commence par toi.</h2>
        <p>Quelques informations pour se rencontrer autour des mêmes envies.</p>
        <ol className="form-steps">
          {["Qui tu es", "Ton parcours", "Votre rythme"].map((s, i) => (
            <li
              key={s}
              className={step === i ? "current" : step > i ? "done" : ""}
            >
              <span>{step > i ? <Check size={15} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="privacy-note">
          <ShieldCheck />
          <p>
            Ton e-mail reste privé. Ton pseudo Discord est accessible uniquement
            aux membres ayant complété leur profil.
          </p>
        </div>
      </aside>
      <form className="form-panel" onSubmit={submit}>
        <span className="eyebrow">ÉTAPE {step + 1} SUR 3</span>
        <h2>
          {
            [
              "Présente-toi.",
              "À chacun son parcours.",
              "Un rythme qui vous ressemble.",
            ][step]
          }
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
                <Sprout /> Débutant
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
                <Sparkles /> Parrain
              </button>
            </div>
            <div className="fields">
              <Field label="Prénom ou surnom">
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </Field>
              <Field
                label="Tranche d’âge"
                hint="Facultatif. N’indique pas ta date de naissance."
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
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Pseudo Discord"
                hint="Ton nom d’utilisateur unique, sans @."
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
                  placeholder="ex. alex.resell"
                />
              </Field>
              <Field label="Arrivée dans la formation">
                <input
                  required
                  type="month"
                  max={new Date().toISOString().slice(0, 7)}
                  value={draft.joined}
                  onChange={(e) => update("joined", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Identifiant Discord numérique (facultatif)"
              hint="Active le mode développeur sur Discord, puis « Copier l’identifiant utilisateur ». Il permet un lien direct vers ton profil ; sinon, ton pseudo pourra être copié."
            >
              <input
                value={draft.discordId}
                inputMode="numeric"
                pattern="[0-9]{17,20}"
                onChange={(e) => update("discordId", e.target.value)}
                placeholder="17 à 20 chiffres"
              />
            </Field>
            <Field label="Quelques mots sur toi">
              <textarea
                required
                minLength={20}
                maxLength={800}
                rows={4}
                value={draft.bio}
                onChange={(e) => update("bio", e.target.value)}
                placeholder="Ton état d’esprit, ce que tu aimes, ce que tu aimerais partager…"
              />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <div className="fields">
              <Field
                label={
                  draft.role === "mentor"
                    ? "Expérience en achat-revente (mois)"
                    : "Depuis combien de mois pratiques-tu ?"
                }
                hint={
                  draft.role === "mentor"
                    ? "Au moins 6 mois pour devenir parrain."
                    : "Mets 0 si tu commences tout juste."
                }
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
              <Field
                label={
                  draft.role === "mentor"
                    ? "Ta spécialité principale"
                    : "Ce qui t’intéresse le plus"
                }
              >
                <select
                  value={draft.specialty}
                  onChange={(e) =>
                    update(
                      "specialty",
                      e.target.value as ProfileInput["specialty"],
                    )
                  }
                >
                  {specialties.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {draft.role === "mentor" ? (
                <Field
                  label="Chiffre d’affaires mensuel"
                  hint="Déclaratif et facultatif. Le chiffre d’affaires n’est pas le bénéfice."
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
                      "5 000 € et plus",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Budget de départ (facultatif)">
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
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Field
              label={
                draft.role === "mentor"
                  ? "Qu’aimerais-tu transmettre ?"
                  : "Quels sont tes objectifs et tes difficultés ?"
              }
            >
              <textarea
                required
                minLength={10}
                maxLength={500}
                rows={4}
                value={draft.goals}
                onChange={(e) => update("goals", e.target.value)}
                placeholder={
                  draft.role === "mentor"
                    ? "Aider à choisir les premières pièces, améliorer les annonces…"
                    : "Faire mes premières ventes, mieux sourcer, comprendre les prix…"
                }
              />
            </Field>
            <Field
              label={
                draft.role === "mentor"
                  ? "Marques, pièces et références"
                  : "Marques ou pièces qui t’intéressent (facultatif)"
              }
              hint="Ex. Nike, Ralph Lauren, Carhartt, jeans, vestes…"
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
              <Field label="Tes créneaux préférés">
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
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Durée souhaitée">
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
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  draft.role === "mentor"
                    ? "Ton délai habituel de réponse"
                    : "Le délai de réponse qui te convient"
                }
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
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {draft.role === "mentor" && (
                <Field
                  label="Nombre de places disponibles"
                  hint="De 0 à 10. Avec 0 place, tu ne figures pas dans l’annuaire."
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
                Vous échangez sur Discord, par messages. Aucun appel imposé. Les
                horaires et la durée se confirment ensemble au premier échange.
              </p>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.visible}
                onChange={(e) => update("visible", e.target.checked)}
              />
              <span>
                Rendre mon profil visible dans l’annuaire public.
                <small>Tu pourras le masquer à tout moment.</small>
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
                J’accepte la charte d’entraide : respect, confidentialité,
                accompagnement gratuit et aucune promesse de gains.
                <small>
                  Je consens à l’affichage de mon profil et au partage de mon
                  contact Discord avec les membres inscrits, tant que mon profil
                  est visible.
                </small>
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
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
              <ChevronLeft size={18} /> Retour
            </button>
          ) : onCancel ? (
            <button type="button" className="text-btn" onClick={onCancel}>
              Annuler
            </button>
          ) : (
            <span />
          )}
          <button className="btn" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <>
                {step < 2 ? "Continuer" : "Enregistrer mon profil"}{" "}
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
}: {
  p: PublicProfile;
  onOpen: () => void;
  own?: boolean;
}) {
  return (
    <article className="member-card">
      <div className="member-top">
        <div className={`avatar ${p.role === "beginner" ? "peach" : ""}`}>
          {p.name.slice(0, 2).toUpperCase()}
        </div>
        <span className={`badge ${p.role === "mentor" ? "green" : ""}`}>
          {p.role === "mentor" ? (
            <>
              <span className="status-dot" />
              {p.capacity} place{p.capacity > 1 ? "s" : ""}
            </>
          ) : (
            <>
              <Sprout size={13} /> Débutant
            </>
          )}
        </span>
      </div>
      <h3>{p.name}</h3>
      <p className="member-subtitle">
        {p.role === "mentor"
          ? `Parrain · ${p.experience} mois d’expérience`
          : "À la recherche d’un coup de pouce"}
      </p>
      {p.role === "mentor" && !own && (
        <RatingSummary average={p.ratingAverage} count={p.ratingCount} />
      )}
      <div className="mini-tags">
        <span>{p.specialty}</span>
        {p.references && <span>{p.references.split(",")[0].slice(0, 25)}</span>}
      </div>
      <p className="member-bio">{p.bio}</p>
      <div className="member-facts">
        <span>
          <Clock size={15} />
          {p.availability}
        </span>
        <span>
          <MessageCircle size={15} />
          {p.responseTime}
        </span>
      </div>
      <button className="card-btn" onClick={onOpen}>
        {own ? "Modifier mon profil" : "Découvrir le profil"}{" "}
        <ArrowUpRight size={17} />
      </button>
    </article>
  );
}
function Directory({
  session,
  own,
  initialRole,
  onJoin,
  onProfile,
  notify,
}: {
  session: boolean;
  own: Profile | null;
  initialRole: "mentor" | "beginner";
  onJoin: () => void;
  onProfile: () => void;
  notify: (s: string) => void;
}) {
  const [role, setRole] = useState(initialRole);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [time, setTime] = useState("");
  const [page, setPage] = useState(0);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const [contact, setContact] = useState<{
    discord: string;
    discordId: string;
  } | null>(null);
  const [contactError, setContactError] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [reload, setReload] = useState(0);
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
    setSelected(p);
    setContact(null);
    setContactError("");
  };
  async function showContact() {
    if (!session) {
      setSelected(null);
      onJoin();
      return;
    }
    if (!own) {
      setSelected(null);
      onProfile();
      return;
    }
    setContactBusy(true);
    setContactError("");
    try {
      setContact(await api("/api/profiles?contact=" + selected?.id));
    } catch (e) {
      setContactError((e as Error).message);
    } finally {
      setContactBusy(false);
    }
  }
  return (
    <section className="wrap directory">
      <div className="directory-heading">
        <div className="page-heading">
          <span className="eyebrow">LES BONNES PERSONNES, AU BON MOMENT</span>
          <h1>
            Trouve ton binôme<span>.</span>
          </h1>
          <p>
            Un objectif commun. Un rythme compatible. Et l’envie d’avancer
            ensemble.
          </p>
        </div>
        <div className="directory-doodle">
          <Users size={40} />
          <span>
            Ça commence
            <br />
            par un bonjour.
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
          <Sparkles size={18} /> Les parrains
        </button>
        <button
          className={role === "beginner" ? "selected" : ""}
          onClick={() => {
            setRole("beginner");
            setPage(0);
          }}
        >
          <Sprout size={18} /> Les débutants
        </button>
      </div>
      <div className="filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Rechercher un membre"
            placeholder="Un prénom, une marque, un mot-clé…"
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
            aria-label="Spécialité"
            value={specialty}
            onChange={(e) => {
              setSpecialty(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Toutes les spécialités</option>
            {specialties.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <Clock size={16} />
          <select
            aria-label="Disponibilités"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Toutes les disponibilités</option>
            {times.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="results-label">
        <span>
          {busy
            ? "Recherche en cours…"
            : `${total} ${role === "mentor" ? "parrain" : "débutant"}${total > 1 ? "s" : ""} disponible${total > 1 ? "s" : ""}`}
        </span>
        <span>
          <ShieldCheck size={14} /> Profils et expériences déclaratifs
        </span>
      </div>
      {error ? (
        <div className="empty">
          <CircleHelp />
          <h2>Une petite interruption.</h2>
          <p role="alert">{error}</p>
          <Button onClick={() => setReload(reload + 1)}>Réessayer</Button>
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
            <ProfileCard key={p.id} p={p} onOpen={() => open(p)} />
          ))}
        </div>
      ) : (
        <div className="empty directory-empty">
          <div className="empty-art">
            <Users size={36} />
            <span>✦</span>
          </div>
          <h2>
            {search || specialty || time
              ? "Pas encore de profil pour ces critères."
              : "Les belles rencontres commencent avec les premiers membres."}
          </h2>
          <p>
            {search || specialty || time
              ? "Essaie une autre spécialité ou élargis tes disponibilités."
              : `L’annuaire attend ses premiers ${role === "mentor" ? "parrains" : "débutants"}. Crée ton profil et fais connaître Relais aux membres de ta formation.`}
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
            {search || specialty || time
              ? "Réinitialiser les filtres"
              : "Créer mon profil"}{" "}
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
            Précédent
          </button>
          <span>
            Page {page + 1} sur {Math.ceil(total / 12)}
          </span>
          <button
            className="btn secondary"
            disabled={(page + 1) * 12 >= total}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </button>
        </div>
      )}
      <div className="directory-tip">
        <Icon>
          <HeartHandshake />
        </Icon>
        <div>
          <strong>Le feeling compte autant que l’expérience.</strong>
          <p>
            Commence par un petit message. Parlez de vos objectifs et de vos
            disponibilités avant de vous engager.
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
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),a[href]",
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
              aria-label="Fermer le profil"
            >
              <X />
            </button>
            <div className="avatar">
              {selected.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="eyebrow">
              {selected.role === "mentor" ? "PARRAIN" : "DÉBUTANT"} ·{" "}
              {selected.specialty}
            </span>
            <h2 id="member-title">{selected.name}</h2>
            {selected.role === "mentor" && (
              <RatingSummary
                average={selected.ratingAverage}
                count={selected.ratingCount}
              />
            )}
            <p>{selected.bio}</p>
            <div className="detail-grid">
              <div>
                <small>Expérience</small>
                <strong>{selected.experience} mois</strong>
              </div>
              <div>
                <small>Dans la formation depuis</small>
                <strong>
                  {selected.joined.split("-").reverse().join("/")}
                </strong>
              </div>
              <div>
                <small>Disponibilités</small>
                <strong>{selected.availability}</strong>
              </div>
              <div>
                <small>Durée souhaitée</small>
                <strong>{selected.duration}</strong>
              </div>
              <div>
                <small>Réponses</small>
                <strong>{selected.responseTime}</strong>
              </div>
              {selected.age !== "Non précisé" && (
                <div>
                  <small>Tranche d’âge</small>
                  <strong>{selected.age}</strong>
                </div>
              )}
              {selected.role === "mentor" &&
                selected.revenue !== "Je préfère ne pas préciser" && (
                  <div>
                    <small>CA mensuel déclaré</small>
                    <strong>{selected.revenue}</strong>
                  </div>
                )}
              {selected.role === "beginner" &&
                selected.budget !== "Non précisé" && (
                  <div>
                    <small>Budget de départ</small>
                    <strong>{selected.budget}</strong>
                  </div>
                )}
            </div>
            <h3>
              {selected.role === "mentor"
                ? "Ce que je peux t’apporter"
                : "Mes objectifs"}
            </h3>
            <p>{selected.goals}</p>
            {selected.references && (
              <>
                <h3>Marques & références</h3>
                <p>{selected.references}</p>
              </>
            )}
            <p className="small-text">
              Informations déclarées par le membre, non vérifiées. Aucun
              résultat financier garanti.
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
                  <Copy size={16} /> Copier le pseudo Discord
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
                  {contact.discordId
                    ? "Ouvrir son profil Discord"
                    : "Ouvrir Discord"}{" "}
                  <ArrowUpRight size={16} />
                </a>
                <p className="small-text">
                  La demande d’amis se fait sur Discord. Présente-toi et
                  explique ce que tu recherches.
                </p>
              </div>
            ) : (
              <button
                className="btn full"
                disabled={contactBusy}
                onClick={() => void showContact()}
              >
                <MessageCircle size={18} />
                {contactBusy
                  ? "Chargement…"
                  : !session
                    ? "M’inscrire pour échanger"
                    : !own
                      ? "Compléter mon profil pour échanger"
                      : "Voir le contact Discord"}
              </button>
            )}
            {selected.role === "mentor" && own?.role === "beginner" && (
              <RequestAccompaniment
                key={selected.id}
                mentorProfileId={selected.id}
              />
            )}
            {contactError && (
              <p role="alert" className="error">
                {contactError}
              </p>
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
            Supprimer définitivement ton profil et ton contact de l’annuaire ?
            Ton compte restera disponible.
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
            Oui, supprimer mon profil
          </button>
          <button className="text-btn" onClick={() => setConfirm(false)}>
            Annuler
          </button>
        </>
      ) : (
        <button className="text-btn muted" onClick={() => setConfirm(true)}>
          Supprimer mon profil
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function Guide({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="wrap guide">
      <div className="page-heading">
        <span className="eyebrow">L’ENTRAIDE, TOUT SIMPLEMENT</span>
        <h1>
          Un binôme aujourd’hui.
          <br />
          <span>Un réseau pour demain.</span>
        </h1>
        <p>
          Quand les questions se perdent parmi des centaines de messages, un
          interlocuteur dédié peut faire toute la différence.
        </p>
      </div>
      <div className="guide-intro">
        <Icon>
          <HeartHandshake />
        </Icon>
        <div>
          <h2>Le principe de Relais</h2>
          <p>
            Un membre expérimenté accompagne un débutant en achat-revente de
            vêtements. Il répond à ses questions, partage son expérience et
            l’aide à avancer. Les échanges se passent sur Discord, sans
            obligation d’appel, selon le rythme choisi ensemble.
          </p>
          <p>
            À mesure que les débutants progressent, les liens restent. Et ceux
            qui ont été aidés peuvent, à leur tour, transmettre. C’est ainsi
            qu’un réseau d’entraide se construit.
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
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </article>
          );
        })}
      </div>
      <section className="guide-intro">
        <div>
          <h2>Une note après l’accompagnement</h2>
          <p>
            Dans l’annuaire, le débutant clique sur « Choisir ce parrain ». Le
            parrain accepte depuis « Mon profil », dans « Mes accompagnements ».
            À la fin, l’un des deux clique sur « Terminer l’accompagnement ». Le
            débutant peut alors publier une note de 1 à 5 étoiles, une seule
            fois pour ce binôme. La moyenne et le nombre de notes apparaissent
            sur la fiche du parrain.
          </p>
          <p>
            Les notes proviennent de binômes confirmés sur Relais. Elles
            reflètent l’expérience des membres, sans vérifier le contenu de
            leurs échanges sur Discord. Un profil masqué reste absent de
            l’annuaire.
          </p>
        </div>
      </section>
      <section className="charter">
        <span className="eyebrow">LA CHARTE RELAIS</span>
        <h2>
          De bonnes rencontres,
          <br />
          avec de bonnes bases.
        </h2>
        <div className="charter-grid">
          {[
            [
              "01",
              "De l’entraide, pas une prestation.",
              "Le parrainage Relais est gratuit. Aucune vente de coaching ni demande d’argent en échange d’une réponse.",
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
              <span>{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="faq">
        <span className="eyebrow">ON RÉPOND À TES QUESTIONS</span>
        <h2>Avant de te lancer.</h2>
        {[
          [
            "Dois-je avoir un certain chiffre d’affaires pour être parrain ?",
            "Non. Les 6 mois d’expérience sont le seuil prévu, mais la pédagogie et la disponibilité comptent aussi. Le chiffre d’affaires aide à comprendre un parcours : ce n’est ni une certification ni une promesse de résultat.",
          ],
          [
            "Est-ce que Relais envoie une demande d’amis automatiquement ?",
            "Non. Tu copies le pseudo et l’ajoutes dans Discord. Si le membre a renseigné son identifiant numérique, un bouton ouvre directement son profil Discord.",
          ],
          [
            "Puis-je accompagner plusieurs débutants ?",
            "Oui. Indique le nombre de places disponibles sur ton profil, jusqu’à 10. Mets-le à jour quand tu accueilles quelqu’un. Avec 0 place, ton profil ne figure plus dans l’annuaire.",
          ],
          [
            "Qui peut voir mes informations ?",
            "Le site et les profils visibles sont publics, sauf les pseudos Discord qui sont réservés aux membres connectés ayant un profil. Ton adresse e-mail n’est jamais affichée dans l’annuaire. Tu peux modifier, masquer ou supprimer ton profil depuis ton espace.",
          ],
          [
            "Est-ce le site officiel de la formation ?",
            "Relais est une initiative indépendante entre membres. Il ne remplace ni la formation ni son équipe, et ne prétend pas être affilié à ses créateurs.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <ChevronDown size={18} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <div className="bottom-cta">
        <div>
          <h2>Prêt à faire le premier pas ?</h2>
          <p>
            Présente-toi. Quelqu’un a peut-être exactement le conseil qu’il te
            faut.
          </p>
        </div>
        <Button onClick={onJoin}>
          Rejoindre Relais <ArrowUpRight size={18} />
        </Button>
      </div>
    </section>
  );
}
