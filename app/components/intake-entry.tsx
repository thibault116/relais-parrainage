import { ArrowRight, Sprout, GraduationCap } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import "../intake.css";

export function IntakeEntry() {
  return (
    <main className="intake-shell intake-registration intake-entry">
      <header className="intake-header">
        <a href="/" className="intake-brand" aria-label="Mentora, accueil">
          <BrandLogo />
          <span>Mentora</span>
        </a>
        <a href="/?connexion=1">Déjà membre ?</a>
      </header>
      <section
        className="intake-entry-content"
        aria-labelledby="intake-choice-title"
      >
        <span className="intake-eyebrow">BIENVENUE SUR MENTORA</span>
        <h1 id="intake-choice-title">Choisis ce qui te correspond</h1>
        <div className="intake-role-cards">
          <a className="intake-role-card" href="/inscription?role=beginner">
            <span className="intake-role-art">
              <Sprout size={34} />
            </span>
            <h2>Je suis débutant</h2>
            <p>
              Je veux me lancer dans l’achat-revente, ou je suis déjà lancé et
              je veux augmenter mes bénéfices.
            </p>
            <span className="intake-role-action">
              Commencer mon parcours <ArrowRight size={19} />
            </span>
          </a>
          <a className="intake-role-card" href="/inscription?role=mentor">
            <span className="intake-role-art">
              <GraduationCap size={34} />
            </span>
            <h2>Je suis parrain</h2>
            <p>
              J’ai de l’expérience dans l’achat-revente et je souhaite
              transmettre mes connaissances pour aider des débutants.
            </p>
            <span className="intake-role-action">
              Partager mon expérience <ArrowRight size={19} />
            </span>
          </a>
        </div>
      </section>
    </main>
  );
}
