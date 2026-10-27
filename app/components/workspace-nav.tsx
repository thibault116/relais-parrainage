"use client";
import { BrandLogo } from "./brand-logo";
import {
  Compass,
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
type Destination = "home" | "directory" | "profile" | "moderation" | "help" | "menu";
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
    id: "verification",
    label: "Vérification du compte",
    icon: ShieldCheck,
    view: "profile",
    tab: "verification",
  },
  {
    id: "emails",
    label: "Notifications",
    icon: Mail,
    view: "profile",
    tab: "emails",
  },
  {
    id: "appearance",
    label: "Paramètres",
    icon: Settings,
    view: "profile",
    tab: "appearance",
  },
];
const adminItems: Item[] = [
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
  name: string;
  discordUrl: string;
  onNavigate: (view: Destination, tab?: string) => void;
  onSignOut: () => void;
}) {
  const active = (item: Item) =>
    view === item.view &&
    (!item.tab || (view === "profile" ? profileTab : adminTab) === item.tab);
  const title =
    view === "menu" ? "Menu" : view === "profile"
      ? memberItems.find((i) => i.tab === profileTab)?.label || "Mon profil"
      : view === "moderation"
        ? adminItems.find((i) => i.tab === adminTab)?.label || "Administration"
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
      <span>{item.label}</span>
    </button>
  );
  return (
    <>
      <aside
        id="workspace-menu"
        className="workspace-sidebar"
        aria-label="Menu de l’espace membre"
      >
        <div className="workspace-brand-row">
          <a
            href="#home"
            className="brand"
            aria-label="Mentora, accueil"
            onClick={() => navigate("home")}
          >
            <span className="brand-mark">
              <BrandLogo />
            </span>
            mentora<span className="brand-dot">.</span>
          </a>
        </div>
        <nav
          className="workspace-links"
          aria-label="Navigation de l’espace membre"
        >
          {itemButton({
            id: "directory",
            label: "Trouver mon binôme",
            icon: Compass,
            view: "directory",
          })}
          <p className="workspace-group-title">Mon espace</p>
          {memberItems
            .filter((i) => i.id !== "verification" || mentor)
            .map(itemButton)}
          {moderator && (
            <>
              <p className="workspace-group-title">Administration</p>
              {adminItems.map(itemButton)}
            </>
          )}
          <p className="workspace-group-title">Communauté</p>
          {itemButton({
            id: "help",
            label: "Aide",
            icon: CircleHelp,
            view: "help",
          })}
          <a href={discordUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} />
            <span>Rejoindre Discord</span>
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
              <small>Mon profil</small>
            </span>
          </button>
          <button
            aria-label="Se déconnecter"
            title="Se déconnecter"
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
          aria-label="Mentora, accueil"
          onClick={() => navigate("home")}
        >
          <BrandLogo />
        </a>
        <div>
          <small>
            {view === "moderation" ? "ADMINISTRATION" : "MON ESPACE MENTORA"}
          </small>
          <strong>{title}</strong>
        </div>
        <button
          className="workspace-top-help"
          aria-label="Ouvrir l’aide"
          onClick={() => navigate("help")}
        >
          <CircleHelp size={21} />
        </button>
      </header>
      <nav className="workspace-bottom-nav" aria-label="Navigation mobile">
        {[
          {
            id: "directory",
            label: "Binômes",
            icon: Compass,
            view: "directory",
          } as Item,
          { ...memberItems[0], label: "Demandes" },
          { ...memberItems[1], label: "Suivi" },
          { ...memberItems[3], label: "Profil" },
        ].map(itemButton)}
        <button
          className={view === "menu" ? "is-current" : ""}
          aria-current={view === "menu" ? "page" : undefined}
          onClick={() => navigate("menu")}
        >
          <Menu size={21} />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}

export function WorkspaceMenuPage({mentor, moderator, discordUrl, onNavigate, onSignOut}: {
  mentor:boolean; moderator:boolean; discordUrl:string;
  onNavigate:(view:Destination, tab?:string)=>void; onSignOut:()=>void;
}) {
  const render = (item:Item) => <button key={item.id} onClick={()=>onNavigate(item.view,item.tab)}><item.icon size={22}/><span>{item.label}</span><ArrowUpRight size={17}/></button>;
  return <section className="wrap workspace-menu-page">
    <div className="page-heading"><span className="eyebrow">TON ESPACE</span><h1>Menu</h1><p>Tous tes raccourcis, au même endroit.</p></div>
    <h2>Mon espace</h2><div className="menu-page-grid">{memberItems.filter(i=>i.id!=="verification"||mentor).map(render)}</div>
    {moderator&&<><h2>Administration</h2><div className="menu-page-grid">{adminItems.map(render)}</div></>}
    <h2>Communauté</h2><div className="menu-page-grid">
      {render({id:"help",label:"Aide",icon:CircleHelp,view:"help"})}
      <a href={discordUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={22}/><span>Rejoindre la communauté Discord</span><ArrowUpRight size={17}/></a>
      <button onClick={()=>onNavigate("home")}><Compass size={22}/><span>Accueil de Mentora</span></button>
      <button onClick={onSignOut}><LogOut size={22}/><span>Se déconnecter</span></button>
    </div>
  </section>;
}
