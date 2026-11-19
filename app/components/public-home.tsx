"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Users,
  Layers,
  MessageCircle,
  ChevronDown,
  Check,
  Search,
  Workflow,
  Sprout,
  Sparkles,
} from "lucide-react";
import { memberGuides } from "@/lib/guides-catalog";
import { useHeroScene } from "./scroll-scene";
import { ProductStory } from "./product-story";
import {
  PublicProductPreview,
  type ProductScreen,
} from "./public-product-preview";
import { t } from "./language";
export type PublicDestination = ProductScreen | "requests";
export function usePublicCommerce(supplied?: boolean) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (supplied !== undefined) return;
    const c = new AbortController();
    fetch("/api/settings", { signal: c.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!c.signal.aborted) setEnabled(d?.commerceAvailable === true);
      })
      .catch(() => {});
    return () => c.abort();
  }, [supplied]);
  return supplied ?? enabled;
}
export function PublicFAQ({ commerce: provided }: { commerce?: boolean }) {
  const commerce = usePublicCommerce(provided);
  const questions = [
    [
      "Qu’est-ce que la marketplace Mentora ?",
      "Mentora réunit des revendeurs autour de services, de conseils et d’entraide dans l’achat-revente. Les membres y trouvent des parrains, une communauté et des ressources. Mentora ne vend pas directement de vêtements.",
    ],
    [
      "Faut-il payer pour utiliser Mentora ?",
      commerce
        ? "Les quatre guides et la communauté sont gratuits avec un compte. Les prestations peuvent être payantes : leur prix en crédits est indiqué avant la demande. Tu achètes les crédits séparément, sans abonnement."
        : "Les quatre guides et la communauté sont accessibles gratuitement avec un compte. Les services proposés dépendent des fonctionnalités ouvertes sur la plateforme.",
    ],
    [
      "Comment trouver un parrain ?",
      "Crée ton compte, complète ton profil puis explore les membres dans Découvrir. Leurs spécialités et leur expérience t’aident à choisir à qui envoyer une demande. Aucun résultat commercial n’est garanti.",
    ],
    ...(commerce
      ? [
          [
            "Comment se déroule une prestation ?",
            "Tu consultes son détail et son prix en crédits, puis envoies une demande au parrain. Les crédits sont réservés à la demande et une conversation permet de suivre la prestation. En cas de refus, ils sont restitués. Le parrain et le débutant confirment sa fin avant que la rémunération soit disponible.",
          ],
        ]
      : []),
    [
      "Où se passent les échanges ?",
      "La communauté est intégrée à Mentora, avec des conversations distinctes pour les parrains et les débutants. La messagerie privée est disponible en bêta, à activer dans les paramètres. Discord complète ces échanges et sert aussi de point de rencontre et de support.",
    ],
    [
      "Comment accéder aux quatre guides gratuits ?",
      "Connecte-toi puis ouvre Menu → Général → Guides. Ils se lisent directement dans Mentora, en lecture continue ou en plein écran. Tu peux aussi copier un lien pour partager un guide.",
    ],
    [
      "Puis-je rejoindre Mentora si je débute ?",
      "Oui. Tu peux découvrir les ressources, poser tes questions dans ta communauté et trouver un accompagnement adapté à ton niveau. Les parrains disposent de leur propre parcours pour présenter leur expérience.",
    ],
  ];
  return (
    <section className="landing-faq" aria-labelledby="landing-faq-title">
      <div>
        <span className="landing-eyebrow">{t("LES RÉPONSES UTILES")}</span>
        <h2 id="landing-faq-title">{t("Avant de nous rejoindre.")}</h2>
        <p>{t("Le fonctionnement, sans détour.")}</p>
      </div>
      <div>
        {questions.map(([q, a]) => (
          <details key={q}>
            <summary>
              {t(q)}
              <ChevronDown size={19} />
            </summary>
            <p>{t(a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
const features = [
  {
    screen: "discover" as const,
    icon: Users,
    title: "Trouver un parrain.",
    text: "Découvre les spécialités et l’expérience des membres pour trouver le bon interlocuteur.",
    label: "Explorer les profils",
  },
  {
    screen: "services" as const,
    icon: Layers,
    title: "Choisir une prestation.",
    text: "Une aide adaptée à un besoin précis, avec un descriptif et un prix en crédits annoncés.",
    label: "Voir les prestations",
  },
  {
    screen: "community" as const,
    icon: MessageCircle,
    title: "Partager les bonnes questions.",
    text: "Échange avec des membres de ton rôle dans une communauté dédiée à l’achat-revente.",
    label: "Rejoindre les échanges",
  },
  {
    screen: "guides" as const,
    icon: BookOpen,
    title: "Apprendre avec les bons repères.",
    text: "Quatre guides 100 % gratuits, du premier article à la recherche de stock.",
    label: "Lire les guides gratuits",
  },
  {
    screen: "requests" as const,
    icon: Workflow,
    title: "Garder le fil de tes demandes.",
    text: "Retrouve les réponses et les statuts de tes demandes dans ton espace membre.",
    label: "Retrouver mes demandes",
  },
];
export function PublicLanding({
  onJoin,
  onOpen,
  discordUrl,
}: {
  onJoin: (role: "beginner" | "mentor") => void;
  onOpen: (screen: PublicDestination, slug?: string) => void;
  discordUrl: string;
}) {
  const commerce = usePublicCommerce();
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  useHeroScene(hero);
  useEffect(() => {
    const elements = root.current?.querySelectorAll<HTMLElement>(
      "[data-landing-reveal]",
    );
    if (
      !elements ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.remove("landing-await");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.06 },
    );
    elements.forEach((e) => {
      if (e.getBoundingClientRect().top > innerHeight) {
        e.classList.add("landing-await");
        observer.observe(e);
      }
    });
    return () => {
      observer.disconnect();
      elements.forEach((e) => e.classList.remove("landing-await"));
    };
  }, []);
  return (
    <div className="mentora-landing" ref={root}>
      <section
        ref={hero}
        className="landing-hero landing-container"
        aria-labelledby="landing-title"
      >
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">
            <i />
            {t("MENTORA — LA PLATEFORME DU RESELL")}
          </span>
          <h1 id="landing-title">
            {t("La marketplace")
              .split(" ")
              .map((word, i) => (
                <span
                  className="hero-word"
                  style={{ "--word-index": i } as React.CSSProperties}
                  key={word}
                >
                  {word}{" "}
                </span>
              ))}{" "}
            <br />
            <span
              className="hero-word hero-word-accent"
              style={{ "--word-index": 2 } as React.CSSProperties}
            >
              {t("des resellers.")}
            </span>
          </h1>
          <p>
            {t(
              commerce
                ? "Trouve des revendeurs expérimentés, découvre leurs prestations, échange avec la communauté et accède aux ressources pour progresser dans l’achat-revente."
                : "Trouve des revendeurs expérimentés, échange avec la communauté et accède aux ressources pour progresser dans l’achat-revente.",
            )}
          </p>
          <div className="landing-hero-actions">
            <a className="landing-primary" href="#mentora-features">
              {t("Découvrir Mentora")}
              <ArrowRight size={19} />
            </a>
            <button
              className="landing-secondary"
              onClick={() => onOpen("discover")}
            >
              {t("Explorer les parrains")}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="landing-hero-footnote">
            <span>
              <Check size={15} />
              {t("Guides et communauté gratuits")}
            </span>
            <span>{t("Plateforme en bêta")}</span>
          </div>
          {commerce && (
            <button
              className="hero-mentor-cta"
              onClick={() => onJoin("mentor")}
            >
              {t("Devenir parrain et proposer des prestations rémunérées")}
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="landing-hero-art">
          <div className="landing-art-glow" />
          <div className="landing-main-preview">
            <PublicProductPreview compact />
          </div>
          <div className="landing-float landing-float-community">
            <MessageCircle size={21} />
            <span>
              <strong>{t("La communauté, dans Mentora.")}</strong>
              <small>
                {t("Des questions. Des expériences. Des échanges.")}
              </small>
            </span>
          </div>
          <div className="landing-float landing-float-resell">
            <Users size={19} />
            {t("Débutants & parrains")}
          </div>
        </div>
      </section>
      <div className="landing-ribbon">
        <div className="landing-container">
          <span>{t("DÉCOUVRIR")}</span>
          <i />
          <span>{t("ÉCHANGER")}</span>
          <i />
          <span>{t("APPRENDRE")}</span>
          <i />
          <span>{t("AVANCER")}</span>
        </div>
      </div>
      <section
        className="landing-container landing-section"
        id="mentora-features"
        data-landing-reveal
      >
        <div className="landing-section-heading">
          <span className="landing-eyebrow">
            {t("UN ESPACE. PLUSIEURS FAÇONS D’AVANCER.")}
          </span>
          <h2>
            {t("Tout ton resell,")}
            <br />
            <span>{t("au même endroit.")}</span>
          </h2>
          <p>
            {t(
              "Des personnes à rencontrer, des ressources à lire et des réponses à construire ensemble.",
            )}
          </p>
        </div>
        <div className="landing-feature-grid">
          {features
            .filter((f) => commerce || f.screen !== "services")
            .map((f, i) => (
              <article
                key={f.screen}
                className={`landing-feature feature-${f.screen}`}
              >
                <div className="landing-feature-top">
                  <f.icon size={27} />
                  <small>0{i + 1}</small>
                </div>
                <h3>{t(f.title)}</h3>
                <p>{t(f.text)}</p>
                <button
                  className="landing-text-link"
                  onClick={() => onOpen(f.screen)}
                >
                  {t(f.label)}
                  <ArrowUpRight size={18} />
                </button>
              </article>
            ))}
        </div>
      </section>
      <div className="landing-container" data-landing-reveal>
        <ProductStory commerce={commerce} onOpen={onOpen} />
      </div>
      <section
        className="landing-container landing-section landing-roles"
        data-landing-reveal
      >
        <div className="landing-section-heading">
          <span className="landing-eyebrow">
            {t("CHACUN SON POINT DE DÉPART")}
          </span>
          <h2>
            {t("Deux profils.")}
            <br />
            <span>{t("Une même communauté.")}</span>
          </h2>
        </div>
        <div className="landing-role-grid">
          <article>
            <Sprout size={30} />
            <small>{t("JE DÉMARRE")}</small>
            <h3>
              {t("Moins de doutes.")}
              <br />
              {t("Des premiers pas concrets.")}
            </h3>
            <p>
              {t(
                "Lis les guides, rencontre des revendeurs et pose tes questions. Avance avec une aide qui correspond à ton niveau.",
              )}
            </p>
            <button
              className="landing-text-link"
              onClick={() => onJoin("beginner")}
            >
              {t("Rejoindre comme débutant")}
              <ArrowRight size={18} />
            </button>
          </article>
          <article>
            <Sparkles size={30} />
            <small>{t("JE PARTAGE MON EXPÉRIENCE")}</small>
            <h3>
              {t("Ton parcours a de la valeur.")}
              <br />
              {t("Partage ce que tu sais.")}
            </h3>
            <p>
              {t(
                commerce
                  ? "Deviens parrain et fais-toi rémunérer pour aider d’autres resellers. Propose tes prestations, fixe leur prix en crédits et partage ton expérience."
                  : "Présente ton expérience, échange avec d’autres parrains et aide les membres à progresser autour de tes spécialités.",
              )}
            </p>
            <button
              className="landing-text-link"
              onClick={() => onJoin("mentor")}
            >
              {t("Rejoindre comme parrain")}
              <ArrowRight size={18} />
            </button>
          </article>
        </div>
      </section>
      {commerce && (
        <section className="landing-services-band" data-landing-reveal>
          <div className="landing-container landing-services-layout">
            <div>
              <span className="landing-eyebrow">
                {t("DES PRESTATIONS ADAPTÉES À TES BESOINS")}
              </span>
              <h2>
                {t("L’aide qu’il te faut.")}
                <br />
                <span>{t("Quand il te la faut.")}</span>
              </h2>
              <p>
                {t(
                  "Chaque parrain présente ce qu’il propose et fixe son prix en crédits. Tu sais ce que tu demandes avant de commencer.",
                )}
              </p>
              <button
                className="landing-primary"
                onClick={() => onOpen("services")}
              >
                {t("Découvrir les prestations")}
                <ArrowUpRight size={18} />
              </button>
            </div>
            <ol>
              {[
                [
                  "Choisis ta prestation.",
                  "Consulte sa description, son parrain et son prix en crédits.",
                ],
                [
                  "Envoie ta demande.",
                  "Précise ton besoin si tu le souhaites. Le parrain peut accepter ou refuser.",
                ],
                [
                  "Avance dans Mentora.",
                  "Retrouve la conversation et le statut de la prestation. Sa fin est confirmée par les deux membres.",
                ],
              ].map(([title, text], i) => (
                <li key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{t(title)}</h3>
                    <p>{t(text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      <section
        className="landing-container landing-section landing-guides"
        data-landing-reveal
      >
        <div className="landing-section-heading">
          <span className="landing-eyebrow">{t("LES RESSOURCES MENTORA")}</span>
          <h2>
            {t("Quatre guides gratuits.")}
            <br />
            <span>{t("Zéro raison de rester bloqué.")}</span>
          </h2>
          <p>
            {t(
              "Des repères concrets pour ton prochain article. Gratuits, à lire directement dans Mentora après connexion.",
            )}
          </p>
        </div>
        <div className="landing-guide-grid">
          {memberGuides.map((g) => (
            <button
              key={g.slug}
              onClick={() => onOpen("guides", g.slug)}
              className="landing-guide"
            >
              <span className="landing-guide-number">{g.number}</span>
              <BookOpen size={25} />
              <div>
                <small>{t("GUIDE GRATUIT")}</small>
                <h3>{t(g.title)}</h3>
                <p>{t(g.description)}</p>
              </div>
              <ArrowUpRight size={21} />
            </button>
          ))}
        </div>
      </section>
      <section
        className="landing-container landing-section landing-community"
        data-landing-reveal
      >
        <div className="landing-community-art" aria-hidden="true">
          <span>
            <MessageCircle size={36} />
          </span>
          <div>
            {t("Général")}
            <MessageCircle size={18} />
          </div>
          <div>
            {t("Questions")}
            <Search size={18} />
          </div>
          <div>
            {t("Présentations")}
            <Users size={18} />
          </div>
        </div>
        <div>
          <span className="landing-eyebrow">
            {t("L’ENTRAIDE FAIT PARTIE DU PARCOURS")}
          </span>
          <h2>
            {t("Tu n’avances")}
            <br />
            <span>{t("plus dans ton coin.")}</span>
          </h2>
          <p>
            {t(
              "La communauté vit dans Mentora. Débutants et parrains ont chacun leur espace pour poser des questions et partager leurs expériences.",
            )}
          </p>
          <p className="landing-community-beta">
            {t(
              "La messagerie privée se découvre en bêta, depuis les paramètres de ton compte. Discord complète la communauté et le support.",
            )}
          </p>
          <div className="landing-community-actions">
            <button
              className="landing-secondary"
              onClick={() => onOpen("community")}
            >
              {t("Découvrir la communauté")}
              <ArrowUpRight size={17} />
            </button>
            <a
              className="landing-text-link"
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Rejoindre le Discord")}
              <ArrowUpRight size={17} />
            </a>
          </div>
        </div>
      </section>
      <div className="landing-container landing-section" data-landing-reveal>
        <PublicFAQ commerce={commerce} />
      </div>
      <section
        className="landing-container landing-section"
        data-landing-reveal
      >
        <div className="landing-final">
          <span className="landing-eyebrow">
            {t("ON AVANCE MIEUX ENSEMBLE.")}
          </span>
          <h2>
            {t("Ton prochain cap")}
            <br />
            <span>{t("commence ici.")}</span>
          </h2>
          <p>
            {t(
              "Des ressources pour apprendre. Une communauté pour échanger. Des personnes pour avancer.",
            )}
          </p>
          <button
            className="landing-primary"
            onClick={() => onJoin("beginner")}
          >
            {t("Rejoindre Mentora")}
            <ArrowRight size={19} />
          </button>
        </div>
      </section>
    </div>
  );
}
export function HowMentoraWorks({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="mentora-landing landing-container landing-section">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">MENTORA</span>
        <h1>{t("Ton resell, bien entouré.")}</h1>
        <p>
          {t(
            "Crée ton profil, découvre les membres et retrouve les ressources dans ton espace Mentora.",
          )}
        </p>
      </div>
      <div className="landing-role-grid">
        {[
          [
            "01",
            "Crée ton profil.",
            "Choisis ton rôle et présente ton expérience, tes objectifs et tes spécialités.",
          ],
          [
            "02",
            "Explore Mentora.",
            "Découvre les parrains, les guides gratuits et les conversations de ta communauté.",
          ],
          [
            "03",
            "Construis la suite.",
            "Envoie une demande adaptée à ton besoin et suis les réponses dans ton espace membre.",
          ],
        ].map(([n, title, text]) => (
          <article key={n}>
            <small>{n}</small>
            <h2>{t(title)}</h2>
            <p>{t(text)}</p>
          </article>
        ))}
      </div>
      <div className="landing-section">
        <PublicFAQ />
      </div>
      <button className="landing-primary" onClick={onJoin}>
        {t("Rejoindre Mentora")}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
