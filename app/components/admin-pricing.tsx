"use client";
import { useEffect, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import type { PricingProposal } from "@/lib/pricing-proposal";
const euros = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export function AdminPricing() {
  const [data, setData] = useState<PricingProposal | null>(null);
  const [error, setError] = useState("");
  const [planIndex, setPlanIndex] = useState(1);
  const [packIndex, setPackIndex] = useState(-1);
  const [analyses, setAnalyses] = useState(1);
  const [calls, setCalls] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/pricing", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Chargement de l’étude privée…</p>;
  const pack = data.packs[packIndex];
  const available = data.plans[planIndex].credits + (pack?.credits ?? 0);
  const spent =
    analyses * data.uses[0].credits! + calls * data.uses[1].credits!;
  const balance = available - spent;
  const count = (value: string) =>
    Math.max(0, Math.min(1000, Math.floor(Number(value) || 0)));
  return (
    <section className="pricing-lab pricing-credit-lab">
      <div className="pricing-private">
        <LockKeyhole size={16} />
        <strong>Étude privée · ton compte uniquement</strong>
        <span>Maquette — aucun paiement activé</span>
      </div>
      <header className="pricing-hero">
        <span className="eyebrow">TES OFFRES MENTORA</span>
        <h2>{data.heading}</h2>
        <p>{data.intro}</p>
      </header>
      <div className="pricing-cards">
        {data.plans.map((plan, i) => (
          <article className="pricing-card" key={plan.id}>
            <span className="pricing-label">
              {i === 0 ? "Le socle gratuit" : "Abonnement envisagé"}
            </span>
            <h3>{plan.name}</h3>
            <p className="pricing-audience">{plan.description}</p>
            <div className="pricing-amount">
              {i === 0 ? euros(0) : "À définir"}
              <small>{i === 0 ? " / mois" : " · prix mensuel"}</small>
            </div>
            <p className="pricing-credit-count">
              <strong>{plan.credits}</strong> crédits / mois
            </p>
            <ul>
              {data.comparison.slice(4).map((row) => (
                <li key={row.label}>
                  <span>
                    {row.label}
                    <small>{row.values[i]}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="pricing-detail">
              Communauté, découverte des parrains et messagerie incluses.
            </p>
          </article>
        ))}
      </div>
      <section className="pricing-comparison">
        <h3>Comparer les quatre plans</h3>
        <div
          className="pricing-table-scroll"
          role="region"
          aria-label="Comparatif des offres, défilement horizontal"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Fonctionnalités</th>
                {data.plans.map((p) => (
                  <th scope="col" key={p.id}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.comparison.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pricing-detail">
          Répartition envisagée uniquement : les accès actuels des membres
          restent inchangés.
        </p>
      </section>
      <section className="pricing-comparison">
        <h3>Recharges de crédits PM</h3>
        <div className="pricing-pack-grid">
          {data.packs.map((p) => (
            <article key={p.credits}>
              <strong>{p.credits} crédits</strong>
              <b>{euros(p.price)}</b>
              <small>{euros(p.price / p.credits)} / crédit</small>
            </article>
          ))}
        </div>
        <p className="pricing-detail">
          Prix repris à l’identique. Le coût unitaire réel varie de 1,57 € à
          1,78 € environ, au-dessus de la référence de 1,50 € indiquée dans ta
          capture.
        </p>
      </section>
      <section className="pricing-comparison">
        <h3>Comment dépenser les crédits ?</h3>
        <div className="pricing-use-grid">
          {data.uses.map((use) => (
            <article key={use.name}>
              <h4>{use.name}</h4>
              <strong>
                {use.credits === null
                  ? "Coût à définir"
                  : `${use.credits} crédits`}
              </strong>
              <p>{use.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="pricing-simulator">
        <h3>Tester un mois d’utilisation</h3>
        <p>
          Simulation locale : aucune réservation, aucun achat, aucun crédit
          réel. Aucun report de solde supposé.
        </p>
        <div className="pricing-inputs">
          <label>
            Plan
            <select
              value={planIndex}
              onChange={(e) => setPlanIndex(Number(e.target.value))}
            >
              {data.plans.map((p, i) => (
                <option value={i} key={p.id}>
                  {p.name} · {p.credits} crédits
                </option>
              ))}
            </select>
          </label>
          <label>
            Recharge
            <select
              value={packIndex}
              onChange={(e) => setPackIndex(Number(e.target.value))}
            >
              <option value={-1}>Aucune recharge</option>
              {data.packs.map((p, i) => (
                <option value={i} key={p.credits}>
                  {p.credits} crédits · {euros(p.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Analyses de compte · {data.uses[0].credits} crédits
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={analyses}
              onChange={(e) => setAnalyses(count(e.target.value))}
            />
          </label>
          <label>
            Appels de 30 min · {data.uses[1].credits} crédits
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={calls}
              onChange={(e) => setCalls(count(e.target.value))}
            />
          </label>
        </div>
        <div className="pricing-results" aria-live="polite">
          <div>
            <strong>{available} crédits</strong>
            <span>Disponibles · {spent} demandés</span>
          </div>
          <div>
            <strong>{Math.abs(balance)} crédits</strong>
            <span>
              {balance < 0
                ? "Manquants pour ce programme"
                : "Restants après ce programme"}
            </span>
          </div>
        </div>
        <small>
          Recharge : {euros(pack?.price ?? 0)}.{" "}
          {planIndex === 0
            ? "Plan Free gratuit."
            : "Prix de l’abonnement non inclus : à définir."}{" "}
          Les boosts et la compatibilité ne sont pas calculés tant que leurs
          coûts ne sont pas fixés.
        </small>
      </section>
      <aside className="pricing-recommendation">
        <Sparkles size={22} />
        <div>
          <h3>Mon avis sur ton modèle</h3>
          <p>{data.recommendation}</p>
        </div>
      </aside>
      <div className="pricing-bottom">
        <section>
          <h3>Points à trancher</h3>
          <ul>
            {data.decisions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Ce que j’ajouterais</h3>
          <p className="pricing-detail">
            Suggestions, distinctes de tes quatre plans.
          </p>
          <ul>
            {data.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
