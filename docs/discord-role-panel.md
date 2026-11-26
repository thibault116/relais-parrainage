# Choisir mes rôles Discord

## Fonctionnement

Le panneau Rôles existant est retrouvé par son identifiant conservé en base ; le salon est renommé `choisir-mes-rôles`, sans changement d'identifiant ni de permissions de salon. Le message Mentora est modifié, jamais republié en double. La bannière violette existante est réutilisée. Les boutons historiques de notifications et leurs identifiants de rôle restent inchangés. L'ancien panneau continue de gérer les notifications avant sa mise à niveau.

Le menu géographique propose les treize régions métropolitaines, Outre-mer et International, plus un choix explicite de retrait. Les rôles sont créés avec zéro permission ou réutilisés uniquement si cette condition est vérifiée. La modification retire les autres rôles du groupe puis confirme auprès de Discord qu'il reste au maximum un rôle régional. Les rôles sans rapport ne sont jamais remplacés par une liste complète.

Un message commun ne varie pas selon son lecteur : le bouton Mon statut ouvre une réponse éphémère. Un Débutant reçoit la confirmation Devenir Parrain et un bouton Annuler ; un Parrain reçoit seulement son état actuel. La confirmation est liée au membre, au serveur et au salon, expire au bout de dix minutes et n'est utilisable qu'une fois. Le passage est définitif dans ce bot. Il n'existe aucune commande de retour Débutant. Toute interaction ultérieure corrige un éventuel double statut et rétablit le statut Parrain confirmé si une opération précédente a été interrompue. Un administrateur Discord ou un autre bot reste techniquement capable de gérer des rôles hors de ce système ; aucun worker Gateway permanent n'est requis ni ajouté.

## Persistance et sécurité

Migration additive via migrateDiscordCommunity : discord_member_preferences (région, confirmation permanente du statut, verrou temporaire), discord_role_actions (action, intention, résultat et erreur) et discord_role_confirmations (jetons privés à usage unique). Aucun secret d'authentification Discord n'est enregistré dans ces tables. Un verrou par membre sérialise les modifications ; une intention persistée rend les reprises idempotentes, y compris les boutons de notifications. L'identifiant d'interaction empêche les doublons. Les verrous abandonnés expirent après trois minutes ; le traitement HTTP Vercel est limité à une minute.

Le bot conserve son endpoint HTTP existant, sa vérification de signature Ed25519 et ses réponses éphémères différées. Les actions sont liées à l'application, au serveur, au membre et au message du panneau. Les confirmations privées utilisent leur propre jeton lié au membre au lieu de l'identifiant du panneau commun. Le bot vérifie Gérer les rôles, sa hiérarchie, les droits d'envoi et de lecture du salon, et Gérer les salons avant le renommage. Les rôles de statut ne peuvent contenir de droits d'administration/modération ; leurs permissions de salon sont également contrôlées lors de l'installation. Aucun droit du bot ni aucun rôle existant n'est étendu automatiquement.

## Mentora et Discord

Aucune synchronisation de rôles vérifiée n'existait entre l'authentification Mentora et les rôles Discord ; les champs Discord historiques du profil sont déclaratifs, pas une preuve d'identité. Le changement Discord ne modifie donc ni profiles.role, ni les questionnaires, vérifications, prestations, permissions applicatives, crédits, gains, paiements ou coordonnées bancaires. La confirmation privée le précise. Une synchronisation future exigerait un rattachement d'identité vérifié et les validations propres au profil Parrain Mentora.

## Déploiement et contrôle

Dans Tickets Discord → Présentation du serveur Discord : charger les salons, vérifier les permissions des rôles, mettre à jour Choisir mes rôles. Le test d'intégration régional agit uniquement sur le bot lui-même : Bretagne, Île-de-France, puis retrait. Il préserve sa configuration et refuse le test si le bot a déjà un rôle régional ou un statut membre. Aucun membre humain n'est promu pour les tests.

Les tests scripts/test-discord-roles.ts utilisent une API Discord simulée et une base SQLite isolée : rôles sans droits, 15 choix et retrait, remplacement exclusif, notifications libres, répétition idempotente, confirmation/annulation/expiration, autre membre refusé, refus des rôles sensibles ou trop hauts, pannes, reprise, verrouillage, conservation des autres rôles et nouveau processus. Les tests Discord Community et Tickets vérifient les régressions. Aucun salon de test réel ou message d'annonce n'est créé par ces tests.

Références officielles : https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx ; https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx ; https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx.
