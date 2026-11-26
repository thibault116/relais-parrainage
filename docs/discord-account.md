# Compte Discord — prototype administrateur

## Mise en place

L'application Discord et le bot Mentora existants sont réutilisés. Dans le portail développeur Discord → application Mentora → OAuth2 → Redirects, enregistrer exactement :

`https://www.mentora-resell.app/api/discord-account/callback`

Dans Vercel → relais-parrainage → Production, ajouter `DISCORD_OAUTH_CLIENT_SECRET` en type Secret avec le **Client Secret OAuth2** de cette même application. Le token du bot n'est pas ce secret. `DISCORD_TICKET_APPLICATION_ID` et `DISCORD_TICKET_BOT_TOKEN` sont ceux du bot existant. `BETTER_AUTH_SECRET` sert déjà à protéger l'authentification ; une clé AES-256-GCM distincte est dérivée avec HKDF et un contexte spécifique pour les jetons Discord. Ne pas exposer ces valeurs dans NEXT_PUBLIC_*, le client, le dépôt ou les logs. Une rotation de BETTER_AUTH_SECRET nécessite une reconnexion Discord.

La migration `migrateDiscordAccounts` crée une liaison au compte principal par **identifiant d'utilisateur**, à partir du propriétaire CRM existant et déjà modérateur (exactement un propriétaire distinct), jamais d'un pseudo ou d'une adresse codée en dur. En cas d'absence ou d'ambiguïté, elle n'ouvre aucun accès. Renseigner alors `MENTORA_PRIMARY_ADMIN_USER_ID` avec l'identifiant du compte Mentora existant et modérateur, puis redéployer. La liaison durable `primary_administrators` n'est pas remplacée automatiquement. Le rôle de modérateur, l'absence de blocage et l'option bêta restent obligatoires. Aucune modification automatique des autres contrôles d'administration existants.

L'interface se trouve dans Menu → Paramètres → Compte Discord et dans les paramètres généraux du propriétaire. Activer son option bêta personnelle. La connexion OAuth s'ouvre sur le domaine canonique `www.mentora-resell.app` : si l'on utilisait l'ancienne adresse Vercel, se connecter à Mentora sur le domaine canonique puis relancer la connexion Discord. Les cookies de session ne sont pas partagés entre ces deux domaines.

## Sécurité et données

Le parcours est une association à une session Better Auth existante, pas une nouvelle méthode de connexion Mentora et pas une création automatique de compte. OAuth2 authorization code avec PKCE S256, state aléatoire, cookie HttpOnly Secure SameSite=Lax, session liée, durée de dix minutes, consommation unique et contrôle d'issuer si fourni. Le scope `identify` suffit : aucun e-mail, message privé, connexion externe ou ajout automatique au serveur n'est demandé. Le serveur échange les codes et renouvelle les jetons ; ils sont chiffrés en base et ne figurent jamais dans une réponse JSON. Les pages de callback ne rendent ni code ni jeton et redirigent sans referrer.

La table `discord_account_links` impose l'unicité de l'identifiant Discord et du compte Mentora. `discord_account_flows` conserve les essais temporaires liés à la session. Le verrou temporaire de synchronisation et la génération de liaison évitent les écrasements concurrents et les écritures après dissociation. Les erreurs renvoyées sont issues d'une liste de messages courts, sans corps de réponse OAuth ni secret.

Les API vérifient le compte principal côté serveur **et** `canUseFeature(..., 'discordAccount')`, en plus de la session et de l'origine des POST. L'interface vérifie également le propriétaire et `useFeature`. Les membres normaux, autres modérateurs et bêta-testeurs n'y ont pas accès.

## Synchronisation

Les rôles sont lus sur le serveur officiel via le bot existant, à partir de l'identité obtenue par OAuth2, jamais du champ Discord historique des profils. Le mapping des identifiants est celui du panneau Choisir mes rôles. Les rôles inconnus n'accordent rien. Plusieurs régions ou deux statuts ne sont jamais choisis arbitrairement : le résultat est vide et un avertissement privé invite à corriger Discord. Un rôle supprimé est signalé. Le retrait de la région se reflète dans la synchronisation suivante.

Le statut Discord est un **instantané séparé** : aucune écriture dans profiles.role, moderators, vérifications, paiements, prestations, crédits, IBAN ou droits applicatifs. Les préférences de notification Discord ne remplacent pas les préférences e-mail/push Mentora. La région est visible sur l'aperçu du profil du propriétaire seulement ; aucune association ni aucun jeton n'est ajouté aux API publiques.

Synchronisation à la liaison, manuellement, et après les interactions des boutons/menu du bot existant pour les comptes liés autorisés. Aucun deuxième bot, Gateway permanent, worker payant ou cron ajouté. Les changements effectués par un autre bot ou un administrateur Discord ne déclenchent pas de push : utiliser Synchroniser mes rôles. Le rafraîchissement vérifie aussi que l'autorisation OAuth est toujours valide. Révocation/non-appartenance/permissions refusées effacent les données dérivées affichées ; une panne temporaire conserve le dernier instantané avec son horodatage et son erreur.

Dissocier supprime le lien local, les jetons chiffrés et les flux en attente, et tente de révoquer le jeton auprès de Discord. Une panne externe n'empêche pas la dissociation locale. Le compte Mentora, ses données et ses rôles Discord sont conservés. La suppression du compte Mentora nettoie aussi la liaison locale.

## Validation

`scripts/test-discord-account.ts` utilise une base SQLite isolée, une API OAuth2 simulée et une API bot simulée. Il couvre autorisations principal/bêta/blocage, PKCE/state/session/cookie, annulation/expiration/rejeu, chiffrement authentifié, redémarrage dans un nouveau processus, unicité de liaison, renouvellement/révocation, régions/remplacement/retrait/conflits, absence de membre/rôle/permissions et pannes temporaires, dissociation et invalidation des essais en attente. Les tests Roles et Tickets restent distincts pour les régressions. L'autorisation OAuth2 réelle doit être validée dans Discord par le propriétaire après configuration du redirect et du secret ; les simulations ne valent pas un test réel du portail.

Sources officielles : [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2), [Discord Get Guild Member](https://docs.discord.com/developers/resources/guild#get-guild-member), [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
