# Nouveau domaine Mentora — 19 novembre 2026

Domaine vérifié dans le projet Vercel existant : https://www.mentora-resell.app. Le domaine sans www redirige vers www.

Les liens publics sont centralisés dans `lib/site.ts` : e-mails, guides partagés, annonces Discord, panneaux, ressources, métadonnées et retours de paiement. Les sessions des anciens domaines et les endpoints Stripe restent compatibles ; aucune clé Stripe ni règle financière changée. L’extension conserve son autorisation sur l’ancien domaine et ajoute le nouveau.

La reprise de l’historique utilise `/api/admin/discord-links`, réservé au compte principal côté serveur et vérifié avec le contrôle d’origine pour chaque écriture. L’interface figure dans Administration → Tickets Discord. Analyse paginée des salons, fils actifs et archives publiques/privées rejointes accessibles au bot ; les refus de permissions sont indiqués. Les messages d’autres auteurs sont signalés et jamais édités avec le token du bot. Les messages du bot et du webhook d’annonces sont modifiés en place ; aucune nouvelle publication et aucun nouveau ping collectif. Une copie avant/après est conservée dans `discord_link_changes`, et le résultat est relu après chaque modification. Une nouvelle exécution ne modifie pas les messages déjà actualisés.

Les messages envoyés depuis le compte Discord du propriétaire nécessitent sa session : l’interface fournit le texte original avec uniquement les adresses remplacées. Les e-mails déjà livrés ne peuvent pas être changés dans les boîtes des destinataires ; les nouveaux envois et ceux encore en file utilisent le nouveau domaine.

Tests : `test-domain-links.ts`, `test-discord-community.ts`, `test-discord-member-guides.ts`, `test-discord-changelog.ts`, `test-emails.ts`, `test-member-guides.ts`. Tests de Discord et SMTP uniquement avec simulateurs locaux avant toute reprise réelle. Compilation Next.js et TypeScript réussies. Les paramètres et ancres des guides sont conservés ; les domaines étrangers, les contenus et pièces jointes sont préservés. Le contrôle d’accès non authentifié renvoie 403.
