import { annualDiscount, annualPrice, plans } from "./monetization/catalog";
import { pricingProposal } from "./pricing-proposal";
export function joinOffers() {
  return {
    discount: annualDiscount,
    plans: plans.map((p) => ({
      ...p,
      annualCents: annualPrice(p.cents),
    })),
    comparison: pricingProposal.comparison.map((r) => ({
      ...r,
      upcoming: [
        "Historique de progression",
        "Modèles de plans d’action",
        "Statistiques de progression",
        "Export de bilans",
        "Bilan hebdomadaire automatique",
      ].includes(r.label),
    })),
  };
}
