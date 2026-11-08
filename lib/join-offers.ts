import { plans } from "./monetization/catalog";
import { pricingProposal } from "./pricing-proposal";
export const annualDiscount = 20;
export function joinOffers() {
  return {
    discount: annualDiscount,
    plans: plans.map((p) => ({
      ...p,
      annualCents: Math.round((p.cents * 12 * (100 - annualDiscount)) / 100),
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
