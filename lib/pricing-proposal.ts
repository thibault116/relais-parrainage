// Server-delivered proposal: never import this value into a client component.
export const pricingProposal = {
  heading: "Des outils pour progresser. L’entraide reste accessible.",
  intro:
    "Une piste de monétisation pour Mentora : garder les échanges gratuits et faire payer les outils qui font gagner du temps. Ces prix sont des hypothèses à tester auprès des membres.",
  plans: [
    {
      id: "free",
      name: "Communauté",
      audience: "Pour découvrir et trouver son binôme",
      monthly: 0,
      annual: 0,
      recommended: false,
      tagline: "Le cœur de Mentora, accessible à tous.",
      features: [
        {
          text: "Profil, annuaire et demandes de parrainage",
          status: "Existant",
        },
        {
          text: "Communauté et messages entre contacts acceptés",
          status: "Existant · selon accès bêta",
        },
        { text: "Tâches essentielles et notifications", status: "Existant" },
        {
          text: "Suivi de membres et avis après accompagnement",
          status: "Existant",
        },
      ],
    },
    {
      id: "plus",
      name: "Progression",
      audience: "Pour les revendeurs qui veulent mieux s’organiser",
      monthly: 9.9,
      annual: 99,
      recommended: true,
      tagline: "Un cadre clair pour passer à l’action.",
      features: [
        { text: "Tout le socle gratuit", status: "Inclus dans la proposition" },
        {
          text: "Plans d’action et modèles d’objectifs prêts à adapter",
          status: "À développer",
        },
        {
          text: "Journal de progression et bilan mensuel personnel",
          status: "À développer",
        },
        {
          text: "Rappels programmés et tâches récurrentes",
          status: "À développer",
        },
        {
          text: "Bibliothèque de checklists : annonces, sourcing, expédition",
          status: "À créer",
        },
      ],
    },
    {
      id: "studio",
      name: "Studio Parrain",
      audience: "Pour les parrains qui accompagnent plusieurs membres",
      monthly: 19.9,
      annual: 199,
      recommended: false,
      tagline: "Moins d’administration, plus de temps pour transmettre.",
      features: [
        {
          text: "Tout le socle gratuit et les outils Progression",
          status: "Inclus dans la proposition",
        },
        {
          text: "Tableau de bord multi-binômes et alertes de décrochage",
          status: "À développer",
        },
        {
          text: "Modèles de parcours à réutiliser pour chaque débutant",
          status: "À développer",
        },
        {
          text: "Bibliothèque privée de ressources à partager",
          status: "À développer",
        },
        {
          text: "Bilans exportables et rappels de suivi automatisés",
          status: "À développer",
        },
      ],
    },
  ],
  recommendation:
    "Commencer avec Communauté gratuite + Progression à 9,90 €/mois. Proposer Studio Parrain seulement lorsque plusieurs parrains confirment un vrai besoin de gestion multi-binômes. Ne pas faire payer simplement le droit d’aider ou de trouver un parrain.",
  launch: [
    "Présenter cette maquette à 10 débutants et 5 parrains. Demander quels outils ils utiliseraient chaque semaine et ce qui justifierait un paiement.",
    "Développer un premier avantage concret, puis le faire tester en bêta. Mesurer son usage avant de rendre une offre payante.",
    "Tester un prix fondateur de 6,90 €/mois pendant 12 mois pour les 50 premiers abonnés Progression, puis 9,90 €/mois annoncé dès le départ.",
    "Lancer d’abord au mois, sans engagement. Ajouter l’année à 99 € ou 199 € une fois la valeur confirmée : l’équivalent de deux mois offerts environ.",
  ],
  principles: [
    "Aucun accès actuel n’est retiré. Cette page ne change pas les droits des membres.",
    "Le paiement ne donne ni badge vérifié, ni priorité artificielle dans l’annuaire, ni garantie de réponse d’un parrain.",
    "Aucun accompagnement humain illimité, appel ou résultat financier n’est promis dans ces prix.",
    "Les abonnements soutiendraient les outils de Mentora. Ils ne rémunéreraient pas automatiquement les parrains ; une éventuelle offre d’accompagnement payant demanderait un modèle distinct.",
  ],
};
export type PricingProposal = typeof pricingProposal;
