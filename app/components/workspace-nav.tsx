"use client";
import { useState } from "react";
import { t as translateUi } from "@/app/components/language";
import { BrandLogo } from "./brand-logo";
import {
  Search,
  Compass,
  ListChecks,
  Inbox,
  HeartHandshake,
  UserRound,
  Users,
  ShieldCheck,
  Settings,
  Mail,
  Lightbulb,
  Flag,
  Star,
  ChartNoAxesCombined,
  CircleHelp,
  MessageCircle,
  LogOut,
  Menu,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
type Destination =
  | "home"
  | "directory"
  | "profile"
  | "moderation"
  | "help"
  | "menu";
type Item = {
  id: string;
  label: string;
  icon: LucideIcon;
  view: Destination;
  tab?: string;
};
const memberItems: Item[] = [
  {
    id: "requests",
    label: "Demandes",
    icon: Inbox,
    view: "profile",
    tab: "requests",
  },
  {
    id: "accompaniments",
    label: "Mes accompagnements",
    icon: HeartHandshake,
    view: "profile",
    tab: "accompaniments",
  },
  {
    id: "following",
    label: "Abonnés et abonnements",
    icon: Users,
    view: "profile",
    tab: "following",
  },
  {
    id: "edit",
    label: "Modifier mon profil",
    icon: UserRound,
    view: "profile",
    tab: "edit",
  },
  {
    id: "appearance",
    label: "Paramètres",
    icon: Settings,
    view: "profile",
    tab: "appearance",
  },
  {
    id: "tasks",
    label: "To-do list",
    icon: ListChecks,
    view: "profile",
    tab: "tasks",
  },
];
const adminItems: Item[] = [
  {
    id: "crm",
    label: "Mon CRM Vinted",
    icon: ChartNoAxesCombined,
    view: "moderation",
    tab: "crm",
  },
  {
    id: "extension",
    label: "Extension Vinted",
    icon: Settings,
    view: "moderation",
    tab: "extension",
  },
  {
    id: "overview",
    label: "Vue d’ensemble",
    icon: ChartNoAxesCombined,
    view: "moderation",
    tab: "overview",
  },
  {
    id: "accounts",
    label: "Comptes",
    icon: Users,
    view: "moderation",
    tab: "accounts",
  },
  {
    id: "verification",
    label: "Dossiers parrains",
    icon: ShieldCheck,
    view: "moderation",
    tab: "verification",
  },
  {
    id: "reports",
    label: "Signalements",
    icon: Flag,
    view: "moderation",
    tab: "reports",
  },
  {
    id: "ratings",
    label: "Avis",
    icon: Star,
    view: "moderation",
    tab: "ratings",
  },
  {
    id: "suggestions",
    label: "Suggestions",
    icon: Lightbulb,
    view: "moderation",
    tab: "suggestions",
  },
  {
    id: "emails",
    label: "E-mails",
    icon: Mail,
    view: "moderation",
    tab: "emails",
  },
  {
    id: "settings",
    label: "Paramètres plateforme",
    icon: Settings,
    view: "moderation",
    tab: "settings",
  },
];
export function WorkspaceNav({
  view,
  profileTab,
  adminTab,
  mentor,
  moderator,
  crmOwner = false,
  name,
  discordUrl,
  onNavigate,
  onSignOut,
}: {
  view: string;
  profileTab: string;
  adminTab: string;
  mentor: boolean;
  moderator: boolean;
  crmOwner?: boolean;
  name: string;
  discordUrl: string;
  onNavigate: (view: Destination, tab?: string) => void;
  onSignOut: () => void;
}) {
  const active = (item: Item) =>
    view === item.view &&
    (!item.tab || (view === "profile" ? profileTab : adminTab) === item.tab);
  const title =
    view === "menu"
      ? "Menu"
      : view === "profile"
        ? memberItems.find((i) => i.tab === profileTab)?.label || "Mon profil"
        : view === "moderation"
          ? adminItems.find((i) => i.tab === adminTab)?.label ||
            "Administration"
          : view === "help"
            ? "Aide"
            : "Trouver mon binôme";
  function navigate(v: Destination, tab?: string) {
    onNavigate(v, tab);
  }
  const itemButton = (item: Item) => (
    <button
      key={item.id}
      className={active(item) ? "is-current" : ""}
      aria-current={active(item) ? "page" : undefined}
      onClick={() => navigate(item.view, item.tab)}
    >
      <item.icon size={19} />
      <span>{translateUi(item.label)}</span>
    </button>
  );
  return (
    <>
      <aside
        id="workspace-menu"
        className="workspace-sidebar"
        aria-label={translateUi("Menu de l’espace membre")}
      >
        <div className="workspace-brand-row">
          <a
            href="#home"
            className="brand"
            aria-label={translateUi("Mentora, accueil")}
            onClick={() => navigate("home")}
          >
            <span className="brand-mark">
              <BrandLogo />
            </span>
            {translateUi("mentora")}
            <span className="brand-dot">.</span>
          </a>
        </div>
        <nav
          className="workspace-links"
          aria-label={translateUi("Navigation de l’espace membre")}
        >
          {itemButton({
            id: "directory",
            label: "Trouver mon binôme",
            icon: Compass,
            view: "directory",
          })}
          <p className="workspace-group-title">{translateUi("Mon espace")}</p>
          {memberItems
            .filter((i) => i.id !== "verification" || mentor)
            .map(itemButton)}
          {moderator && (
            <>
              <p className="workspace-group-title">
                {translateUi("Administration")}
              </p>
              {adminItems
                .filter((i) => crmOwner || !["crm", "extension"].includes(i.id))
                .map(itemButton)}
            </>
          )}
          <p className="workspace-group-title">
            {translateUi("Communaut\u00E9")}
          </p>
          {itemButton({
            id: "help",
            label: "Aide",
            icon: CircleHelp,
            view: "help",
          })}
          <a href={discordUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} />
            <span>{translateUi("Rejoindre Discord")}</span>
            <ArrowUpRight size={15} />
          </a>
        </nav>
        <div className="workspace-account">
          <button onClick={() => navigate("profile", "edit")}>
            <span className="avatar small">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{translateUi("Mon profil")}</small>
            </span>
          </button>
          <button
            aria-label={translateUi("Se déconnecter")}
            title={translateUi("Se déconnecter")}
            onClick={onSignOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <header className="workspace-topbar">
        <a
          href="#home"
          className="brand-mark workspace-mobile-logo"
          aria-label={translateUi("Mentora, accueil")}
          onClick={() => navigate("home")}
        >
          <BrandLogo />
        </a>
        <div>
          <small>
            {translateUi(
              view === "moderation" ? "ADMINISTRATION" : "MON ESPACE MENTORA",
            )}
          </small>
          <h1>{translateUi(title)}</h1>
        </div>
        <button
          className="workspace-top-help"
          aria-label={translateUi("Ouvrir l’aide")}
          onClick={() => navigate("help")}
        >
          <CircleHelp size={21} />
        </button>
      </header>
      <nav
        className="workspace-bottom-nav"
        aria-label={translateUi("Navigation mobile")}
      >
        {[
          {
            id: "directory",
            label: "Binômes",
            icon: Compass,
            view: "directory",
          } as Item,
          { ...memberItems[0], label: "Demandes" },
          { ...memberItems[1], label: "Suivi" },
          { ...memberItems[5], label: "To-do list" },
        ].map(itemButton)}
        <button
          className={view === "menu" ? "is-current" : ""}
          aria-current={view === "menu" ? "page" : undefined}
          onClick={() => navigate("menu")}
        >
          <Menu size={21} />
          <span>{translateUi("Menu")}</span>
        </button>
      </nav>
    </>
  );
}
export function WorkspaceMenuPage({
  mentor,
  moderator,
  crmOwner = false,
  discordUrl,
  onNavigate,
  onSignOut,
}: {
  mentor: boolean;
  moderator: boolean;
  crmOwner?: boolean;
  discordUrl: string;
  onNavigate: (view: Destination, tab?: string) => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = (label: string, keywords = "") =>
    normalize(`${translateUi(label)} ${keywords}`).includes(
      normalize(query.trim()),
    );
  const keywords: Record<string, string> = {
    appearance:
      "parametres settings langue language anglais francais mot de passe password securite security notifications email push verification compte sombre clair neon theme installer application",
    edit: "profil profile photo biographie description discord",
    following: "suivi suivre abonnes abonnements followers following",
    tasks: "taches todo to do progression objectifs tasks",
  };
  const visibleMembers = memberItems.filter(
    (i) =>
      (i.id !== "verification" || mentor) && matches(i.label, keywords[i.id]),
  );
  const visibleAdmins = moderator
    ? adminItems.filter(
        (i) =>
          (crmOwner || !["crm", "extension"].includes(i.id)) &&
          matches(i.label),
      )
    : [];
  const communityItems = [
    "Aide",
    "Rejoindre la communauté Discord",
    "Accueil de Mentora",
    "Se déconnecter",
  ];
  const hasCommunity = communityItems.some((label) => matches(label));
  const render = (item: Item) => (
    <button key={item.id} onClick={() => onNavigate(item.view, item.tab)}>
      <item.icon size={22} />
      <span>{translateUi(item.label)}</span>
      <ArrowUpRight size={17} />
    </button>
  );
  return (
    <section className="wrap workspace-menu-page">
      <div className="page-heading">
        <span className="eyebrow">{translateUi("TON ESPACE")}</span>
        <h1>{translateUi("Menu")}</h1>
        <p>{translateUi("Tous tes raccourcis, au m\u00EAme endroit.")}</p>
      </div>
      <label className="menu-search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={translateUi("Rechercher un menu ou un paramètre")}
          placeholder={translateUi("Rechercher un menu ou un paramètre")}
        />
      </label>
      {!visibleMembers.length && !visibleAdmins.length && !hasCommunity && (
        <p role="status">
          {translateUi("Aucun résultat. Essaie un autre mot.")}
        </p>
      )}
      {visibleMembers.length > 0 && (
        <>
          <h2>{translateUi("Mon espace")}</h2>
          <div className="menu-page-grid">{visibleMembers.map(render)}</div>
        </>
      )}
      {visibleAdmins.length > 0 && (
        <>
          <h2>{translateUi("Administration")}</h2>
          <div className="menu-page-grid">{visibleAdmins.map(render)}</div>
        </>
      )}
      {hasCommunity && <h2>{translateUi("Communaut\u00E9")}</h2>}
      <div className="menu-page-grid">
        {matches("Aide") &&
          render({ id: "help", label: "Aide", icon: CircleHelp, view: "help" })}
        <a
          hidden={!matches("Rejoindre la communauté Discord")}
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={22} />
          <span>{translateUi("Rejoindre la communaut\u00E9 Discord")}</span>
          <ArrowUpRight size={17} />
        </a>
        <button
          hidden={!matches("Accueil de Mentora")}
          onClick={() => onNavigate("home")}
        >
          <Compass size={22} />
          <span>{translateUi("Accueil de Mentora")}</span>
        </button>
        <button hidden={!matches("Se déconnecter")} onClick={onSignOut}>
          <LogOut size={22} />
          <span>{translateUi("Se d\u00E9connecter")}</span>
        </button>
      </div>
    </section>
  );
}
