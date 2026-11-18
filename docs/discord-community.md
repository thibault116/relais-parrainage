# Présentation du serveur Mentora

Administration principale → Tickets Discord → Présentation du serveur Discord.
Les cinq salons informatifs sont relevés via le bot ; seuls les messages ordinaires du propriétaire du serveur sont repris. Chaque original est archivé en base. Sa copie en embeds violets conserve le texte Unicode exactement, sans ping collectif. Une comparaison de la copie relue depuis Discord est obligatoire avant toute suppression. Les pièces jointes, stickers, sondages et composants nécessitent une reprise manuelle : jamais de suppression automatique. Toute publication incertaine se récupère par son marqueur, sans renvoi aveugle.

Le nouveau salon Inviter un reseller utilise le lien Mentora déjà existant, après vérification de son serveur auprès de Discord. Pas de promesse de rémunération ou de suivi d’invitations inventé.

Les boutons de notifications ne peuvent attribuer que les deux rôles explicitement enregistrés et dépourvus de permissions. Les identifiants du serveur, salon et panneau sont contrôlés à chaque interaction. Aucun rôle Parrain, Débutant, staff ou privilégié ne peut être attribué par ce panneau.

## Accueil automatique

Les événements GUILD_MEMBER_ADD passent par la Gateway Discord, pas par les webhooks d’interactions. Le forfait Vercel Hobby ne maintient pas ce socket en permanence.

Service dédié prêt dans `discord-worker/`, démarrage `node scripts/discord-welcome-worker.mjs`, Node 24. Une seule instance ; aucune base, volume ou URL publique n’est nécessaire côté worker. Dockerfile dédié et configuration Railway inclus. Ne pas déployer tout Next.js sur ce service.

Variable secrète à configurer directement dans le service : DISCORD_TICKET_BOT_TOKEN (même bot que Vercel ; ne jamais la publier ou la transmettre dans une conversation). DISCORD_WELCOME_GUILD_ID est facultative, par défaut le serveur Mentora existant.

Activer Server Members Intent dans Discord. Le worker ne demande ni présence, ni contenu des conversations. Il se reconnecte et reprend les sessions. Chaque événement est relayé en HTTPS à l’endpoint fixe Mentora, authentifié côté serveur, contrôlé contre l’arrivée réelle du membre et dédoublonné en base. Une requête extérieure sans authentification est refusée. Les erreurs ne journalisent ni token ni corps d’événement.

Le message de bienvenue affiche le nom, la photo et le nombre actuel de membres quand Discord le fournit. Aucun invitant n’est attribué sans preuve. Un envoi à l’état uncertain exige une vérification manuelle plutôt qu’un second message. Le service doit être réellement déployé et le log MENTORA_GATEWAY_READY observé avant d’annoncer l’automatisation active.
