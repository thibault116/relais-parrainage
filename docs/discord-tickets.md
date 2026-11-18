# Support Discord Mentora

Application propriétaire « Mentora », séparée du webhook des annonces. Le serveur reçoit des interactions HTTPS signées Ed25519 sur /api/discord/interactions. Aucun Gateway, intent privilégié ou serveur permanent n'est nécessaire.

Variables Vercel serveur : DISCORD_TICKET_APPLICATION_ID et DISCORD_TICKET_PUBLIC_KEY (valeurs publiques), DISCORD_TICKET_BOT_TOKEN (Secret, jamais dans le navigateur). Enregistrer l'URL https://mentora-resell.vercel.app/api/discord/interactions dans le portail développeur après déploiement. La vérification PING fonctionne avec identifiant et clé publique, avant même la configuration du salon.

Dans Menu → Administration → Tickets Discord, renseigner le serveur, le salon existant « ouvrir un ticket » et éventuellement une catégorie. Le compte propriétaire principal est seul autorisé. L'identité du bot, le serveur, le type des salons et le propriétaire Discord sont vérifiés via l'API avant enregistrement. Le propriétaire du serveur Discord est le destinataire du support.

Publier le panneau crée un message Mentora violet avec un choix de catégorie ; une publication ultérieure modifie ce même message. Aucun @everyone. Une réponse réseau incertaine bloque un renvoi automatique ; un bouton retrouve le message d'origine. L'historique des annonces Mentora n'est pas modifié.

Parcours membre : catégorie → description (10 à 1 800 caractères) → salon privé. Un seul ticket ouvert par personne. Réponse éphémère avec le lien vers son ticket. Les captures peuvent être envoyées dans le salon Discord. Les autres membres ne reçoivent aucune permission sur le ticket. @everyone ne peut pas le voir ; seuls le demandeur, le propriétaire et le bot ont des autorisations explicites. Les administrateurs Discord contournent intrinsèquement les restrictions des salons : le bot ne peut pas retirer ce pouvoir.

Le demandeur ou le propriétaire peut fermer le ticket ; il reste lisible, mais le demandeur ne peut plus y écrire. Aucun salon/message n'est supprimé. L'action est auditée. En cas d'interruption, un contrôle retrouve le salon via son marqueur de sujet, réapplique ses permissions privées et restaure le bouton de fermeture sans créer un second salon.

La base ne stocke que les identifiants Discord, catégorie, état, dates et actions. Le texte du problème reste dans le salon Discord ; il n'est pas enregistré dans la base Mentora. Ne demander ni mot de passe ni coordonnées de paiement dans un ticket. La conservation de l'historique Discord reste sous le contrôle du propriétaire.

Sources : https://docs.discord.com/developers/interactions/receiving-and-responding ; https://docs.discord.com/developers/resources/guild ; https://docs.discord.com/developers/components/reference.
