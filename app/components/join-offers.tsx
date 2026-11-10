"use client";
import { useEffect, useState } from "react";
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
type Data = ReturnType<typeof joinOffers> & { currentPlan: string; subscriptionStatus: string };
const euro = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const icons = [Leaf, Zap, Crown, Gem];
export function JoinOffers({ onManage }: { onManage: () => void }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [annual, setAnnual] = useState(false),
    [busy, setBusy] = useState(false),
    [checkoutError, setCheckoutError] = useState(""),
    [retry, setRetry] = useState(0);
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
  async function pay(id: string) {
    if (busy) return;
    setBusy(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/admin/monetization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          offer: annual ? `${id}-annual` : id,
          key: crypto.randomUUID(),
          returnTo: "billing",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.url)
        throw Error(result.error || "Le paiement test n’a pas pu être ouvert.");
      window.location.assign(result.url);
    } catch (failure) {
      setCheckoutError((failure as Error).message);
      setBusy(false);
    }
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
  const hasSubscription = !["free", "canceled", "incomplete_expired"].includes(data.subscriptionStatus);
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
          Espace privé · Paiements Stripe en mode test.
        </small>
      </header>
      <div
        className="join-period"
        role="group"
        aria-label="Période de facturation"
      >
        <button aria-pressed={!annual} disabled={busy} onClick={() => setAnnual(false)}>
          Mensuel
        </button>
        <button aria-pressed={annual} disabled={busy} onClick={() => setAnnual(true)}>
          Annuel <span>−{data.discount} %</span>
        </button>
      </div>
      {checkoutError && <p role="alert">{checkoutError}</p>}
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
                {p.id === data.currentPlan && (
                  <span className="join-label">Plan actuel</span>
                )}
                {p.id === "plus" && (
                  <span className="commerce-pill">Pour aller plus loin</span>
                )}
              </div>
              {annual && p.cents > 0 && (
                <p className="join-annual-total">
                  {euro(p.annualCents)} facturés par an · {p.credits * 12} crédits
                  versés à chaque paiement annuel
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
                      {annual && r === data.comparison[3]
                        ? `${p.credits * 12} crédits par an`
                        : i === 0 ? r.label : r.label + " : " + r.values[i]}{" "}
                      {r.upcoming && (
                        <small className="join-soon">Bientôt</small>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {p.id !== "free" && p.id !== data.currentPlan && (
                <button
                  className="join-plan-action"
                  disabled={busy}
                  onClick={() => hasSubscription ? onManage() : void pay(p.id)}
                >
                  {hasSubscription ? `Gérer mon abonnement pour passer à ${p.name}`
                    : `Payer ${euro(annual ? p.annualCents : p.cents)} / ${annual ? "an" : "mois"} · ${p.name}`}
                  <ChevronRight size={18} />
                </button>
              )}
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
                    {annual && r === data.comparison[3] ? "Crédits par an" : r.label}
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
                        annual && r === data.comparison[3] ? data.plans[i].credits * 12 : value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.currentPlan !== "plus" && (
          <button
            className="commerce-primary"
            disabled={busy}
            onClick={() => hasSubscription ? onManage() : void pay("plus")}
          >
            <Crown />
            {hasSubscription ? "Gérer mon abonnement" : "Payer l’offre Plus"}
            <ArrowRight />
          </button>
        )}
      </section>
    </section>
  );
}
