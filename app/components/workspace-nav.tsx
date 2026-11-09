"use client";
import { useState } from "react";
import { ArrowUpRight, LogOut, Search } from "lucide-react";
import { CommunityBadge } from "./community";
import { t } from "./language";
import { OwnerPlanBadge } from "./owner-billing";
import { useFeature } from "./beta";
import { BrandLogo } from "./brand-logo";
import {
  workspaceGroups, workspaceMain, workspaceProfile, type WorkspaceTarget,
} from "./workspace-destinations";

const normalized = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function WorkspaceNav({
  screen, settingsSection, adminTab, mentor, moderator, owner, name, photo,
  discordUrl, onNavigate, onPublicHome, onSignOut,
}: {
  screen: string;
  settingsSection: string;
  adminTab: string;
  mentor: boolean;
  moderator: boolean;
  owner: boolean;
  name: string;
  photo?: string;
  discordUrl: string;
  onNavigate: (item: WorkspaceTarget) => void;
  onPublicHome: () => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState("");
  const search = normalized(query);
  const extras = useFeature("mobileExtras");
  const groups = [
    { title: "Navigation", items: workspaceMain },
    { title: "Mon compte", items: workspaceProfile },
    ...workspaceGroups(mentor, moderator, owner, extras),
  ];
  return (
    <aside id="workspace-menu" className="workspace-sidebar" aria-label={t("Menu de l’espace membre")}>
      <div className="workspace-brand-row">
        <a href="#home" className="brand" aria-label={t("Mentora, accueil")} onClick={(event) => {
          event.preventDefault();
          onPublicHome();
        }}>
          <span className="brand-mark"><BrandLogo /></span>
          {t("mentora")}<span className="brand-dot">.</span>
        </a>
        <OwnerPlanBadge enabled={owner} />
      </div>
      <label className="workspace-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Rechercher dans le menu")} aria-label={t("Rechercher dans le menu")} />
      </label>
      <nav className="workspace-links" aria-label={t("Navigation de l’espace membre")}>
        {groups.map(({ title, items }) => {
          const shown = items.filter((item) => normalized(`${t(item.label)} ${item.keywords || ""}`).includes(search));
          if (!shown.length) return null;
          return (
            <section key={title} aria-label={t(title)}>
              <h2 className="workspace-group-title">{t(title)}</h2>
              {shown.map((item) => {
                const current = screen === item.screen &&
                  (!item.settingsSection || settingsSection === item.settingsSection) &&
                  (!item.adminTab || adminTab === item.adminTab);
                const content = <><item.icon size={18} aria-hidden="true" /><span>{t(item.label)}</span></>;
                if (item.external) return (
                  <a key={item.label} href={discordUrl} target="_blank" rel="noopener noreferrer">
                    {content}<ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                );
                return (
                  <button key={item.label} type="button" className={current ? "is-current" : ""}
                    aria-current={current ? "page" : undefined} onClick={() => {
                      setQuery("");
                      onNavigate(item);
                    }}>
                    {content}
                    {item.screen === "community" && <CommunityBadge />}
                  </button>
                );
              })}
            </section>
          );
        })}
        {search && !groups.some(({ items }) => items.some((item) =>
          normalized(`${t(item.label)} ${item.keywords || ""}`).includes(search))) && (
          <p className="workspace-search-empty" role="status">{t("Aucun résultat. Essaie un autre mot.")}</p>
        )}
      </nav>
      <div className="workspace-account">
        <button onClick={() => onNavigate({ screen: "profile" })}>
          <span className="avatar small">{photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
          <span><strong>{name}</strong><small>{t("Mon profil")}</small></span>
        </button>
        <button aria-label={t("Se déconnecter")} title={t("Se déconnecter")} onClick={onSignOut}>
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
