# Accueil et prestations — 19 novembre 2026

Implémentation locale, sans déploiement ni annonce Discord.

## Fonctionnement

- Navigation principale identique sur ordinateur et téléphone : Accueil, Prestations, Communauté, Messages.
- Accueil connecté : cartes de membres réels, recherche, Tous / Parrains / Débutants, panneau de filtres combinables (plateforme, compétences/besoins, méthodes d’achat, disponibilité, expérience), réinitialisation et pagination.
- Le menu reste accessible par le bouton dans l’en-tête mobile et dans la barre latérale. Les destinations secondaires sont conservées, dont Mes prestations pour la gestion côté parrain.
- Prestations réutilise PrivateServiceCatalog sans modifier ses cartes, son dialogue, ses demandes, ses prix en crédits ni les paiements.
- La fiche complète de profil reste celle de Directory. Les liens de prestations vers le parrain et les anciennes URL mobile=discover et services=1 restent compatibles.
- Les profils masqués/bloqués restent exclus. Les capacités complètes restent visibles dans la découverte sociale avec leur disponibilité réelle ; le filtrage historique par capacité est conservé pour les autres clients de l’API.
- Les réponses financières restent exclues de l’API publique. Aucune migration ni modification des données existantes.

## Fichiers

- app/page.tsx : cartes et recherche de l’accueil ; liens et ouverture des profils.
- app/components/workspace-destinations.ts : destinations et compatibilité.
- app/components/workspace-nav.tsx : menu secondaire ordinateur.
- app/components/mobile-experience.tsx : navigation mobile, catalogue dédié et partage de la lecture des profils enregistrés.
- lib/profile-discovery.ts : filtres et correspondances compatibles avec les anciens questionnaires.
- app/api/profiles/route.ts : recherche des deux rôles et filtres sur les seules données publiques.
- app/discovery.css et app/layout.tsx : présentation responsive, thèmes et réduction des animations.
- lib/member-release.ts : notes prêtes pour une prochaine publication.
- scripts/test-discovery.ts : tests isolés de recherche, confidentialité, autorisations et liens.

## Vérifications

- Build Next.js / TypeScript réussi.
- test-discovery.ts : deux rôles pour les deux types de comptes, filtres combinés, recherche, pagination, compatibilité des anciennes données, informations financières privées, profils masqués et bloqués, ancienne navigation et destinations secondaires.
- test-intake.ts : inscription, édition des réponses, confidentialité et comptes existants.
- test-private-services.ts : réservations, crédits, refus, double validation, gains et protection des accès ; serveur Stripe fictif utilisé par les tests existants, aucun paiement réel.
- Navigateur avec base SQLite locale isolée : accueil et catalogue, téléphone et ordinateur, thèmes clair/sombre, panneau de filtres, fiche existante, détails de prestation, besoin facultatif, lien vers le parrain, menu secondaire et ancien lien du catalogue.

Les membres et prestations des captures de contrôle sont des fixtures locales, absentes de la production.
