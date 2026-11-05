"use client";
import { useEffect, useState } from "react";
import { Check, LockKeyhole, Sparkles } from "lucide-react";
import type { PricingProposal } from "@/lib/pricing-proposal";
const euros = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
export function AdminPricing() {
  const [data, setData] = useState<PricingProposal | null>(null),
    [error, setError] = useState(""),
    [annual, setAnnual] = useState(false),
    [plus, setPlus] = useState(50),
    [studio, setStudio] = useState(10),
    [detail, setDetail] = useState<string | null>(null);
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
  if (!data) return <p role="status">Chargement de la proposition…</p>;
  const paid = data.plans.filter((p) => p.monthly > 0);
  const monthly =
    plus * (annual ? paid[0].annual / 12 : paid[0].monthly) +
    studio * (annual ? paid[1].annual / 12 : paid[1].monthly);
  return (
    <section className="pricing-lab">
      <div className="pricing-private">
        <LockKeyhole size={16} />
        <strong>Étude privée · ton compte uniquement</strong>
        <span>Maquette — aucun paiement activé</span>
      </div>
      <header className="pricing-hero">
        <span className="eyebrow">PROPOSITION TARIFAIRE</span>
        <h2>{data.heading}</h2>
        <p>{data.intro}</p>
      </header>
      <div
        className="pricing-switch"
        role="group"
        aria-label="Périodicité envisagée"
      >
        <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
          Mensuel
        </button>
        <button aria-pressed={annual} onClick={() => setAnnual(true)}>
          Annuel · environ 2 mois offerts
        </button>
      </div>
      <div className="pricing-cards">
        {data.plans.map((plan) => (
          <article
            key={plan.id}
            className={`pricing-card ${plan.recommended ? "recommended" : ""}`}
          >
            <span className="pricing-label">
              {plan.recommended
                ? "Piste recommandée"
                : plan.monthly === 0
                  ? "Le socle gratuit"
                  : "Dans un second temps"}
            </span>
            <h3>{plan.name}</h3>
            <p className="pricing-audience">{plan.audience}</p>
            <div className="pricing-amount">
              {euros(annual ? plan.annual : plan.monthly)}
              <small> / {annual && plan.monthly > 0 ? "an" : "mois"}</small>
            </div>
            <p className="pricing-equivalent">
              {annual && plan.monthly > 0
                ? `${euros(plan.annual / 12)}/mois en équivalent · règlement annuel envisagé`
                : plan.monthly > 0
                  ? "Sans engagement · hypothèse de prix public"
                  : "Sans abonnement payant"}
            </p>
            <p>{plan.tagline}</p>
            <ul>
              {plan.features.map((f) => (
                <li key={f.text}>
                  <Check size={16} />
                  <span>
                    {f.text}
                    <small>{f.status}</small>
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="btn secondary"
              aria-expanded={detail === plan.id}
              onClick={() => setDetail(detail === plan.id ? null : plan.id)}
            >
              Examiner cette offre
            </button>
            {detail === plan.id && (
              <p className="pricing-detail">
                {plan.monthly === 0
                  ? "Cette offre maintient l’accès à l’entraide et permet de découvrir la valeur des outils avant de payer."
                  : `À valider : les outils de ${plan.name} apportent-ils assez de valeur pour justifier ${euros(plan.monthly)} chaque mois ? Ils doivent être construits et testés avant toute commercialisation.`}
              </p>
            )}
          </article>
        ))}
      </div>
      <aside className="pricing-recommendation">
        <Sparkles size={22} />
        <div>
          <h3>Ce que je lancerais en premier</h3>
          <p>{data.recommendation}</p>
        </div>
      </aside>
      <section className="pricing-simulator">
        <h3>Et si certains membres s’abonnaient ?</h3>
        <p>
          Une simulation modifiable, pas une prévision. Aucun compte réel n’est
          utilisé.
        </p>
        <div className="pricing-inputs">
          <label>
            Abonnés {paid[0].name}
            <input
              type="number"
              min="0"
              max="100000"
              value={plus}
              onChange={(e) =>
                setPlus(
                  Math.max(0, Math.min(100000, Number(e.target.value) || 0)),
                )
              }
            />
          </label>
          <label>
            Abonnés {paid[1].name}
            <input
              type="number"
              min="0"
              max="100000"
              value={studio}
              onChange={(e) =>
                setStudio(
                  Math.max(0, Math.min(100000, Number(e.target.value) || 0)),
                )
              }
            />
          </label>
        </div>
        <div className="pricing-results">
          <div>
            <strong>{euros(monthly)}</strong>
            <span>
              {annual
                ? "Équivalent mensuel brut"
                : "Encaissement mensuel brut théorique"}
            </span>
          </div>
          <div>
            <strong>{euros(monthly * 12)}</strong>
            <span>
              {annual
                ? "Encaissement annuel brut théorique"
                : "Sur 12 mois sans départ d’abonnés"}
            </span>
          </div>
        </div>
        <small>
          Avant taxes, frais de paiement, remboursements, hébergement et temps
          de support. Ce n’est pas un bénéfice. Les prix et leur traitement
          fiscal restent à définir avant lancement.
        </small>
      </section>
      <div className="pricing-bottom">
        <section>
          <h3>Un lancement en quatre étapes</h3>
          <ol>
            {data.launch.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        <section>
          <h3>Le cadre à conserver</h3>
          <ul>
            {data.principles.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
