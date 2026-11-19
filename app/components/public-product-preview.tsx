"use client";
import {
  BookOpen,
  Search,
  MessageCircle,
  HelpCircle,
  Hand,
  ChevronRight,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { memberGuides } from "@/lib/guides-catalog";
import { t } from "./language";
import { BrandLogo } from "./brand-logo";
export type ProductScreen = "discover" | "services" | "community" | "guides";
const titles = {
  discover: "Découvrir",
  services: "Prestations",
  community: "Communauté",
  guides: "Guides gratuits",
};
/** Public-safe views use the actual navigation, guide catalogue and channel names, never member data. */
export function PublicProductPreview({
  screen = "guides",
  compact = false,
}: {
  screen?: ProductScreen;
  compact?: boolean;
}) {
  return (
    <div
      className={`public-product-window ${compact ? "compact" : ""}`}
      aria-label={t("Aperçu de l’interface Mentora")}
    >
      <div className="product-window-bar">
        <span />
        <span />
        <span />
        <small>mentora</small>
      </div>
      <div className="product-window-content">
        <div className="product-window-brand">
          <BrandLogo />
          <strong>Mentora</strong>
          <span>{t("Espace membre")}</span>
        </div>
        <h3>
          {t(titles[screen])}
          {screen === "guides" && (
            <span className="preview-free-badge">{t("100 % gratuit")}</span>
          )}
        </h3>
        {screen === "guides" ? (
          <div className="product-guide-list">
            {memberGuides.map((g) => (
              <div key={g.slug}>
                <BookOpen size={20} />
                <span>
                  <small>
                    {t("GUIDE GRATUIT")} {g.number}
                  </small>
                  <strong>{t(g.title)}</strong>
                </span>
                <ArrowUpRight size={17} />
              </div>
            ))}
          </div>
        ) : screen === "community" ? (
          <div className="product-channel-list">
            {[
              [MessageCircle, "Général"],
              [HelpCircle, "Questions"],
              [Hand, "Présentations"],
            ].map(([Icon, label]) => {
              const Glyph = Icon as typeof MessageCircle;
              return (
                <div key={String(label)}>
                  <Glyph size={22} />
                  <strong>{t(String(label))}</strong>
                  <ChevronRight size={17} />
                </div>
              );
            })}
            <p>
              {t(
                "Des conversations séparées pour les parrains et les débutants.",
              )}
            </p>
          </div>
        ) : screen === "discover" ? (
          <>
            <div className="product-segment">
              <span>{t("Parrains")}</span>
              <span>{t("Débutants")}</span>
            </div>
            <div className="product-search">
              <Search size={17} />
              {t("Rechercher un membre…")}
            </div>
            <div className="product-specialties">
              {["Sneakers", "Vintage", "Streetwear", "Luxe"].map((x) => (
                <span key={x}>{t(x)}</span>
              ))}
            </div>
            <div className="product-empty">
              <Search size={28} />
              <strong>{t("Trouve la bonne personne.")}</strong>
              <p>
                {t(
                  "Profils, spécialités et expérience : découvre les membres à ton rythme.",
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="product-search">
              <Search size={17} />
              {t("Rechercher une prestation…")}
            </div>
            <div className="product-empty">
              <Layers size={30} />
              <strong>{t("Une aide pour un besoin précis.")}</strong>
              <p>
                {t(
                  "Consulte le détail et le prix en crédits avant d’envoyer ta demande.",
                )}
              </p>
            </div>
            <div className="product-request-state">
              <span />
              <span>{t("Demandes et prestations au même endroit")}</span>
            </div>
          </>
        )}
        <div className="product-window-dock">
          {["Accueil", "Découvrir", "Communauté", "Messages", "Menu"].map(
            (x) => (
              <span key={x} className={x === titles[screen] ? "selected" : ""}>
                {t(x)}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
