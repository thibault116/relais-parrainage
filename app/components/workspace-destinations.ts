import {
  Bell, Bookmark, CheckCircle2, CircleHelp, Flag, Globe, Home, Inbox,
  Layers, Menu, MessageCircle, NotebookPen, Plus, Rocket, Search, Settings,
  Shield, Target, TrendingUp, UserRound, Users, type LucideIcon,
} from "lucide-react";

export type WorkspaceTarget = {
  screen: string;
  settingsSection?: string;
  adminTab?: string;
  network?: string;
};

export type WorkspaceItem = WorkspaceTarget & {
  label: string;
  icon: LucideIcon;
  external?: "discord";
  keywords?: string;
};

export const workspaceMain: WorkspaceItem[] = [
  { label: "Accueil", icon: Home, screen: "home" },
  { label: "Découvrir", icon: Search, screen: "discover" },
  { label: "Communauté", icon: Users, screen: "community" },
  { label: "Messages", icon: MessageCircle, screen: "messages" },
  { label: "Menu", icon: Menu, screen: "menu" },
];

export function workspaceGroups(mentor: boolean, moderator: boolean, owner: boolean, extras: boolean) {
  const groups: { title: string; items: WorkspaceItem[] }[] = [
    {
      title: "Gestion des accompagnements",
      items: [
        { label: "Accompagnements en cours", icon: Inbox, screen: "pairs" },
        { label: mentor ? "Objectifs à atteindre" : "Mes objectifs", icon: Target, screen: "tasks", keywords: "tâches to-do progression" },
        { label: "Demandes de parrainage", icon: Inbox, screen: "requests" },
      ],
    },
    {
      title: "Paramètres",
      items: [
        { label: "Général", icon: Settings, screen: "settings", settingsSection: "general", keywords: "langue thème apparence bêta installer" },
        { label: "Sécurité", icon: Shield, screen: "settings", settingsSection: "security", keywords: "mot de passe password" },
        { label: "Notifications", icon: Bell, screen: "settings", settingsSection: "notifications", keywords: "push email" },
      ],
    },
  ];
  if (extras) groups[0].items.push({ label: "Notes partagées", icon: NotebookPen, screen: "notes" });
  if (owner && mentor) groups[0].items.push({ label: "Prestations", icon: Layers, screen: "services" });
  if (owner) {
    groups[1].items.push(
      { label: "Nous rejoindre", icon: Rocket, screen: "joinOffers" },
      { label: "Abonnement", icon: Layers, screen: "billing" },
      { label: "Crédits", icon: Layers, screen: "credits" },
    );
    if (mentor) groups[1].items.push({ label: "Rémunération", icon: TrendingUp, screen: "payouts" });
  }
  if (mentor) groups[1].items.push({ label: "Finaliser mon profil", icon: UserRound, screen: "settings", settingsSection: "verification" });
  if (moderator || owner) {
    const tabs: [string, string, LucideIcon][] = [
      ["overview", "Vue d’ensemble", Layers],
      ["accounts", "Comptes", Users],
      ["verification", "Dossiers parrains", Shield],
      ["reports", "Signalements", Flag],
      ["ratings", "Avis", CheckCircle2],
      ["suggestions", "Suggestions", Plus],
      ["emails", "E-mails", Inbox],
      ["settings", "Paramètres plateforme", Settings],
    ];
    if (owner) tabs.push(
      ["crm", "Mon CRM Vinted", TrendingUp],
      ["extension", "Extension Vinted", Layers],
      ["pricing", "Tarifs · étude privée", Layers],
      ["monetization", "Monétisation · test privé", Layers],
    );
    groups.push({ title: "Administration", items: tabs.map(([adminTab, label, icon]) => ({ label, icon, screen: "admin", adminTab })) });
  }
  groups.push({
    title: "Aide et à propos",
    items: [
      { label: "FAQ", icon: CircleHelp, screen: "faq" },
      { label: "Tutoriels", icon: NotebookPen, screen: "help" },
      { label: "Notre Discord", icon: Globe, screen: "discord", external: "discord" },
      ...(owner ? [{ label: "Mentions légales, CGU et CGV", icon: NotebookPen, screen: "legalGuide" }] : []),
    ],
  });
  return groups;
}

export const workspaceProfile: WorkspaceItem[] = [
  { label: "Mon profil", icon: UserRound, screen: "profile" },
  { label: "Modifier mon profil", icon: NotebookPen, screen: "edit" },
  { label: "Abonnés et abonnements", icon: Users, screen: "following" },
  { label: "Profils enregistrés", icon: Bookmark, screen: "saved" },
  { label: "Mes notifications", icon: Bell, screen: "notifications" },
];

export const workspaceRoutes: Record<string, [string, string?]> = {
  discover: ["directory"],
  edit: ["profile", "edit"],
  settings: ["profile", "appearance"],
  help: ["help"],
  faq: ["faq"],
  requests: ["profile", "requests"],
  pairs: ["profile", "accompaniments"],
  tasks: ["profile", "tasks"],
  following: ["profile", "following"],
  admin: ["moderation"],
};

export const desktopExperienceScreens = new Set([
  "home", "profile", "saved", "notifications", "notes", "messages",
  "community", "legalGuide", "joinOffers", "billing", "credits", "services", "payouts",
]);
