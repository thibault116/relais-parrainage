"use client";
import { useEffect, useState, useRef } from "react";
import {
  Leaf,
  Zap,
  Crown,
  Gem,
  Check,
  X,
  ChevronRight,
  Clock3,
  ArrowRight,
} from "lucide-react";
import type { joinOffers } from "@/lib/join-offers";
type Data = ReturnType<typeof joinOffers>;
const euro = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const icons = [Leaf, Zap, Crown, Gem];
export function JoinOffers({ onFree }: { onFree: () => void }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [annual, setAnnual] = useState(false),
    [selected, setSelected] = useState("plus"),
    [details, setDetails] = useState(false),
    [retry, setRetry] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/offers", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  function choose(id: string) {
    setSelected(id);
    setDetails(true);
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      }),
    );
  }
  if (error)
    return (
      <section className="commerce-page">
        <p role="alert">{error}</p>
        <button
          className="commerce-primary"
          onClick={() => setRetry((x) => x + 1)}
        >
          Réessayer
        </button>
      </section>
    );
  if (!data) return <p role="status">Chargement des offres…</p>;
  const plan = data.plans.find((p) => p.id === selected) || data.plans[2];
  return (
    <section className="join-offers commerce-page">
      <header className="join-heading">
        <h1>
          Nous <span>rejoindre</span>
        </h1>
        <p>
          Choisis l’offre qui correspond à tes objectifs et à ton rythme sur
          Mentora.
        </p>
        <small>
          Présentation en bêta · Les abonnements ne sont pas encore ouverts aux
          membres.
        </small>
      </header>
      <div
        className="join-period"
        role="group"
        aria-label="Période de facturation"
      >
        <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
          Mensuel
        </button>
        <button aria-pressed={annual} onClick={() => setAnnual(true)}>
          Annuel <span>−{data.discount} %</span>
        </button>
      </div>
      <div className="join-cards">
        {data.plans.map((p, i) => {
          const Icon = icons[i];
          return (
            <article
              className={`commerce-card join-plan ${p.id === "plus" ? "featured" : ""}`}
              key={p.id}
            >
              <div className="join-card-title">
                <Icon className={p.id === "free" ? "free-icon" : ""} />
                <div>
                  <h2>{p.name}</h2>
                  <strong>
                    {euro(annual ? p.annualCents / 12 : p.cents)}
                    <small>
                      {" "}
                      / mois{annual && p.cents > 0 ? " équivalent" : ""}
                    </small>
                  </strong>
                </div>
                {p.id === "free" && <span className="join-label">Gratuit</span>}
                {p.id === "plus" && (
                  <span className="commerce-pill">Pour aller plus loin</span>
                )}
              </div>
              {annual && p.cents > 0 && (
                <p className="join-annual-total">
                  {euro(p.annualCents)} facturés par an · crédits indiqués par
                  mois
                </p>
              )}
              <ul>
                {(i === 0
                  ? data.comparison.slice(0, 3)
                  : [
                      data.comparison[3],
                      data.comparison[4],
                      data.comparison[5],
                      data.comparison[6],
                      ...(i > 1 ? data.comparison.slice(8, 10) : []),
                    ]
                ).map((r) => (
                  <li key={r.label}>
                    {r.upcoming ? <Clock3 /> : <Check />}
                    <span>
                      {i === 0 ? r.label : r.label + " : " + r.values[i]}{" "}
                      {r.upcoming && (
                        <small className="join-soon">Bientôt</small>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="join-plan-action"
                onClick={() => (p.id === "free" ? onFree() : choose(p.id))}
                aria-label={
                  p.id === "free"
                    ? "Continuer avec Free"
                    : `Découvrir l’offre ${p.name}`
                }
              >
                {p.id === "free"
                  ? "Continuer gratuitement"
                  : `Découvrir ${p.name}`}
                <ChevronRight size={18} />
              </button>
            </article>
          );
        })}
      </div>
      <section
        className="join-comparison"
        aria-labelledby="join-comparison-title"
      >
        <h2 id="join-comparison-title">
          Comparer les <span>abonnements</span>
        </h2>
        <p>Toutes les fonctionnalités de chaque offre, en un coup d’œil.</p>
        <div
          className="join-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tableau comparatif, défilement horizontal si nécessaire"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Fonctionnalités</th>
                {data.plans.map((p, i) => {
                  const Icon = icons[i];
                  return (
                    <th
                      scope="col"
                      className={p.id === "plus" ? "highlight" : ""}
                      key={p.id}
                    >
                      <Icon />
                      <span>{p.name}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.comparison.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    {r.label}
                    {r.upcoming && <small className="join-soon">Bientôt</small>}
                  </th>
                  {r.values.map((value, i) => (
                    <td className={i === 2 ? "highlight" : ""} key={i}>
                      {value === "Inclus" ? (
                        <Check className="included" aria-label="Inclus" />
                      ) : value === "Non inclus" ? (
                        <X className="excluded" aria-label="Non inclus" />
                      ) : value === "Professionnelles" ? (
                        <abbr title="Professionnelles">Pro.</abbr>
                      ) : value === "Basiques" ? (
                        "Basique"
                      ) : value === "Avancées" ? (
                        "Avancé"
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="commerce-primary" onClick={() => choose(selected)}>
          <Crown />
          Découvrir l’offre {plan.name}
          <ArrowRight />
        </button>
      </section>
      {details && (
        <section
          ref={detailRef}
          className="commerce-card join-summary"
          role="status"
        >
          <h2>
            {plan.name} · {annual ? "Annuel" : "Mensuel"}
          </h2>
          <p>
            {annual
              ? `${euro(plan.annualCents)} par an, soit ${euro(plan.annualCents / 12)} par mois en équivalent.`
              : `${euro(plan.cents)} par mois.`}
          </p>
          <p>{plan.credits} crédits par mois prévus dans cette offre.</p>
          <p>
            Cette page présente les formules à venir. Ton accès actuel reste
            inchangé ; aucun abonnement ni paiement n’est créé ici.
          </p>
          <button className="commerce-row" onClick={() => setDetails(false)}>
            Fermer le récapitulatif
          </button>
        </section>
      )}
    </section>
  );
}
