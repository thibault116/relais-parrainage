// Owner-only proposal, delivered by the authenticated pricing endpoint.
export const pricingProposal = {
  heading: "Quatre plans. Des crédits à utiliser selon ses besoins.",
  intro:
    "Ta proposition Free, Starter, Plus et Pro, reprise depuis tes maquettes. Étude privée uniquement : aucun abonnement, crédit ou changement d’accès n’est activé.",
  plans: [
    {
      id: "free",
      name: "Free",
      credits: 0,
      description: "Découvrir Mentora et commencer à échanger.",
    },
    {
      id: "starter",
      name: "Starter",
      credits: 10,
      description: "Structurer ses premiers accompagnements.",
    },
    {
      id: "plus",
      name: "Plus",
      credits: 22,
      description: "Suivre sa progression avec des outils avancés.",
    },
    {
      id: "pro",
      name: "Pro",
      credits: 38,
      description: "Piloter plusieurs accompagnements en profondeur.",
    },
  ],
  comparison: [
    {
      label: "Accès à la communauté",
      values: ["Inclus", "Inclus", "Inclus", "Inclus"],
    },
    {
      label: "Découvrir les parrains",
      values: ["Inclus", "Inclus", "Inclus", "Inclus"],
    },
    { label: "Messagerie", values: ["Inclus", "Inclus", "Inclus", "Inclus"] },
    { label: "Crédits par mois", values: ["0", "10", "22", "38"] },
    {
      label: "Objectifs et tâches des binômes",
      values: ["Basique", "Basique", "Avancé", "Avancé"],
    },
    {
      label: "Historique de progression",
      values: ["30 jours", "3 mois", "Illimité", "Illimité"],
    },
    {
      label: "Modèles de plans d’action",
      values: ["Non inclus", "3 modèles", "5 modèles", "Tous"],
    },
    {
      label: "Statistiques de progression",
      values: ["Non inclus", "Basiques", "Avancées", "Professionnelles"],
    },
    {
      label: "Export de bilans",
      values: ["Non inclus", "Non inclus", "PDF", "PDF + CSV"],
    },
    {
      label: "Bilan hebdomadaire automatique",
      values: ["Non inclus", "Non inclus", "Basique", "Avancé"],
    },
    {
      label: "Espaces d’accompagnement simultanés",
      values: ["1", "2", "5", "Illimité"],
    },
  ],
  packs: [
    { credits: 5, price: 8.9 },
    { credits: 10, price: 16.9 },
    { credits: 20, price: 32.9 },
    { credits: 40, price: 62.9 },
  ],
  uses: [
    {
      name: "Analyse de compte Vinted",
      credits: 12,
      description: "Périmètre de l’analyse, livrable et délai à préciser.",
    },
    {
      name: "Appel de 30 minutes",
      credits: 20,
      description: "Intervenant, disponibilités et rémunération à définir.",
    },
    {
      name: "Boost de visibilité du profil parrain",
      credits: null,
      description: "Coût, durée et emplacement du boost à définir.",
    },
    {
      name: "Recherche de compatibilité entre profils",
      credits: null,
      description:
        "Coût et critères de compatibilité à définir. Interprétation du libellé de ta capture, à confirmer.",
    },
  ],
  recommendation:
    "Le socle gratuit garde de la valeur : communauté, découverte et messagerie restent accessibles. Les crédits donnent une utilité concrète aux offres payantes. Avant de fixer les abonnements, définir surtout qui réalise les analyses et les appels, combien cette personne reçoit et combien de prestations peuvent être assurées.",
  decisions: [
    "Prix mensuels de Starter, Plus et Pro non fournis : à définir. Aucun tarif annuel n’est supposé.",
    "La mention « crédits PM (1,50 €) » doit être clarifiée : prix de vente, valeur de référence ou rémunération du parrain ? Tes packs sont conservés tels quels.",
    "Starter fournit 10 crédits, alors que la première prestation chiffrée en demande 12. Prévoir le cumul, une prestation à 10 crédits ou une recharge clairement expliquée.",
    "Préciser ce qui distingue tâches basiques et avancées, statistiques avancées et professionnelles, ainsi que les limites par rôle.",
  ],
  suggestions: [
    "Afficher un solde et un historique des crédits : reçus, dépensés, restitués et date d’expiration éventuelle.",
    "Définir séparément le report des crédits mensuels et la durée de validité des crédits achetés, y compris après résiliation.",
    "Réserver les crédits à la demande, les débiter à la réalisation et les restituer si la prestation est refusée ou annulée selon les règles annoncées.",
    "Décrire chaque prestation : résultat attendu, délai, personne responsable et nombre de retours inclus.",
    "Identifier les boosts comme sponsorisés, sans les confondre avec un badge de confiance ou la compatibilité réelle.",
    "Conserver les données de progression et les binômes existants en cas de changement d’offre ; définir ce qui reste consultable sans supprimer l’historique.",
  ],
};
export type PricingProposal = typeof pricingProposal;
