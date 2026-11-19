"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  PublicProductPreview,
  type ProductScreen,
} from "./public-product-preview";
import { clamp, sceneFrame, subscribeMotionFrame } from "@/lib/motion";
import { useMotionPreferences } from "./motion-system";
import { t } from "./language";
const chapters: {
  id: ProductScreen;
  name: string;
  title: string;
  text: string;
}[] = [
  {
    id: "discover",
    name: "Découvrir",
    title: "Une expérience qui correspond à ton besoin.",
    text: "Explore les profils et les spécialités des membres. Trouve un parrain dont le parcours t’intéresse avant de prendre contact.",
  },
  {
    id: "services",
    name: "Prestations",
    title: "Un besoin précis. Une demande claire.",
    text: "Lis la description de la prestation, consulte son prix en crédits et précise ton besoin si tu le souhaites. Retrouve ensuite son statut dans tes demandes.",
  },
  {
    id: "community",
    name: "Communauté",
    title: "Une question trouve sa place.",
    text: "Général, Questions et Présentations : échange dans l’espace de ton rôle, avec d’autres débutants ou d’autres parrains.",
  },
  {
    id: "guides",
    name: "Guides gratuits",
    title: "Les bons repères, toujours à portée de main.",
    text: "Quatre guides gratuits pour démarrer, choisir ton matériel, préparer tes annonces et trouver ton stock. Lis-les directement dans Mentora.",
  },
];
export function ProductStory({
  onOpen,
  commerce = false,
}: {
  onOpen: (screen: ProductScreen) => void;
  commerce?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const { reduced, compact } = useMotionPreferences();
  const track = useRef<HTMLDivElement>(null),
    scene = useRef<HTMLDivElement>(null),
    index = useRef(0);
  const items = chapters.filter((c) => commerce || c.id !== "services");
  useEffect(() => {
    const el = track.current,
      stage = scene.current;
    if (!el || !stage || reduced) return;
    let unsubscribe: (() => void) | undefined;
    const measure = () => {
      const steps = [...el.querySelectorAll<HTMLElement>("[data-story-step]")];
      const centers = steps.map((s) => {
        const r = s.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      const target =
        matchMedia("(max-width:760px)").matches
          ? Math.min(innerHeight - 40, (stage.getBoundingClientRect().bottom + innerHeight) / 2)
          : innerHeight * 0.5;
      const progress = clamp(
          (target - centers[0]) / Math.max(centers[1] - centers[0], 1),
          0,
          items.length - 1,
        ),
        next = Math.round(progress);
      return () => {
        stage.style.setProperty("--story-progress", String(progress));
        stage
          .querySelectorAll<HTMLElement>("[data-scene-panel]")
          .forEach((panel, i) => {
            const frame = sceneFrame(i, progress, compact);
            panel.style.transform = frame.transform;
            panel.style.opacity = String(frame.opacity);
            panel.style.zIndex = String(items.length - Math.abs(i - next));
          });
        if (index.current !== next) {
          index.current = next;
          setSelected(next);
        }
      };
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        unsubscribe?.();
        unsubscribe = entry.isIntersecting
          ? subscribeMotionFrame(measure)
          : undefined;
      },
      { rootMargin: "150px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      unsubscribe?.();
      stage.style.removeProperty("--story-progress");
      stage.querySelectorAll<HTMLElement>("[data-scene-panel]").forEach((p) => {
        p.style.removeProperty("transform");
        p.style.removeProperty("opacity");
        p.style.removeProperty("z-index");
      });
    };
  }, [commerce, reduced, compact, items.length]);
  const active = items[Math.min(selected, items.length - 1)];
  const choose = (i: number) => {
    setSelected(i);
    if (!reduced) {
      track.current
        ?.querySelectorAll<HTMLElement>("[data-story-step]")
        [
          i
        ]?.scrollIntoView({ behavior: "smooth", block: matchMedia("(max-width:760px)").matches ? "start" : "center" });
    }
  };
  return (
    <section
      className={`landing-section landing-tour immersive-tour ${reduced ? "story-reduced" : ""}`}
      id="mentora-application"
      aria-labelledby="tour-title"
    >
      <div className="landing-section-heading">
        <span className="landing-eyebrow">{t("DÉCOUVRE L’APPLICATION")}</span>
        <h2 id="tour-title">
          {t("Pensée pour le resell.")}
          <br />
          <span>{t("Faite pour avancer.")}</span>
        </h2>
        <p>
          {t(
            "Fais défiler pour explorer Mentora, ou choisis directement une rubrique.",
          )}
        </p>
      </div>
      <div className="scroll-story-track" ref={track}>
        <div className="story-canvas" ref={scene}>
          <div className="story-canvas-halo" aria-hidden="true" />
          <div className="story-visual-stack" aria-hidden="true">
            <div className="story-backplane backplane-one" />
            <div className="story-backplane backplane-two" />
            {items.map((c, i) => (
              <div
                data-scene-panel
                key={c.id}
                className={`story-scene-panel ${active.id === c.id ? "is-current" : ""}`}
              >
                <PublicProductPreview screen={c.id} />
              </div>
            ))}
          </div>
          <nav
            className="story-chapter-nav"
            aria-label={t("Explorer les fonctionnalités")}
          >
            {items.map((c, i) => (
              <button
                key={c.id}
                aria-pressed={active.id === c.id}
                onClick={() => choose(i)}
              >
                <span>0{i + 1}</span>
                {t(c.name)}
              </button>
            ))}
          </nav>
          <div className="story-progress-track" aria-hidden="true">
            <i
              style={{
                transform: `scaleX(${(Math.min(selected, items.length - 1) + 1) / items.length})`,
              }}
            />
          </div>
        </div>
        <div className="story-steps">
          {items.map((c, i) => (
            <article
              className={`story-step ${active.id === c.id ? "is-current" : ""}`}
              data-story-step
              key={c.id}
            >
              <small>
                0{i + 1} / 0{items.length} · {t(c.name)}
              </small>
              <h3>{t(c.title)}</h3>
              <p>{t(c.text)}</p>
              <button
                className="landing-text-link"
                onClick={() => onOpen(c.id)}
              >
                {t(
                  c.id === "guides"
                    ? "Lire les guides gratuits"
                    : "Ouvrir dans Mentora",
                )}
                <ArrowUpRight size={18} />
              </button>
            </article>
          ))}
        </div>
      </div>
      <p className="landing-preview-caption">
        {t("Aperçu d’interface · contenus et rubriques réels")}
      </p>
    </section>
  );
}
