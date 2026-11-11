# Annonces Discord de Mentora

L’accès est réservé au compte administrateur principal, avec contrôle de session et de modérateur côté serveur.

## Utilisation

1. Dans Menu → Administration → **Annonces Discord**, clique sur **Analyser GitHub**.
2. Au premier lancement, le suivi démarre sur la production active pour éviter une annonce historique inattendue. Tu peux définir le SHA complet d’un commit de départ antérieur avant la première publication.
3. Le générateur compare ce point au commit de la production active. Il reprend les notes françaises des nouvelles versions de `lib/member-release.ts`, les déduplique et les classe en Nouveautés, Améliorations et Corrections. Ce fichier doit continuer à ne contenir que des évolutions visibles des membres. Les changements admin et techniques n’en modifient pas l’identifiant.
4. Relis et, si nécessaire, modifie le brouillon. Chaque ligne d’un champ correspond à un point. Le rappel d’actualisation est compris dans la limite de 2 000 caractères.
5. **Tester sans envoyer** valide le payload et sa longueur. Ce bouton ne contacte jamais Discord.
6. Pour publier réellement, confirme que le contenu concerne les membres, puis clique sur **Publier sur Discord**. L’historique conserve le commit, le contenu, l’heure et l’identifiant du message.

Un brouillon manuel permet de rédiger une annonce même lorsque le générateur ne trouve aucune nouvelle note membre. La publication exige toujours que le brouillon corresponde à la production actuellement active.

## Automatique

La case **Publier automatiquement les prochaines versions destinées aux membres** est désactivée par défaut. Son activation est une autorisation d’envoyer les prochaines annonces générées.

Le contrôle s’exécute après une requête sur la production, sans ralentir le rendu de la page. Un contrôle de secours utilise le cron quotidien déjà présent. Il vérifie le déploiement et son commit sur le domaine officiel avant analyse et avant envoi. Un déploiement de test, une ancienne production, un rollback incompatible, une comparaison incomplète ou l’absence d’une nouvelle note membre bloquent l’envoi. Un brouillon retouché manuellement n’est pas publié automatiquement.

L’analyse est limitée à 30 commits par comparaison pour tenir dans le temps d’exécution serveur. Si la plage est plus longue ou les notes trop longues, l’administrateur doit choisir le premier point de suivi approprié ou préparer un résumé manuel. Aucun LLM externe n’est utilisé.

## Sécurité et doublons

- La variable serveur **DISCORD_CHANGELOG_WEBHOOK_URL** contient le webhook sensible. Elle n’est jamais envoyée au navigateur et seul le domaine Discord autorisé peut être utilisé.
- `allowed_mentions.parse=[]` interdit les notifications de masse involontaires. L’embed utilise la bannière Mentora et une bordure violette.
- Le commit cible est unique. Un verrou en base protège les publications concurrentes et le suivi ne progresse qu’après confirmation de Discord.
- En cas de timeout, d’arrêt du serveur ou de réponse ambiguë, l’envoi reste bloqué pour éviter un doublon. Si le message existe dans le salon, son identifiant peut être fourni pour vérifier sa référence et l’ajouter à l’historique sans republier.
- Si aucun message ne peut être retrouvé après un envoi incertain, l’état doit être examiné avant toute remise en file. Le système ne retente pas aveuglément un envoi ambigu.

## Configuration

- **DISCORD_CHANGELOG_WEBHOOK_URL**, Secret Vercel en production. Le webhook fourni a été enregistré, sans envoi d’annonce.
- **VERCEL_ENV**, **VERCEL_GIT_COMMIT_SHA** et **VERCEL_DEPLOYMENT_ID**, variables système Vercel servant à la vérification de production.
- **CRON_SECRET**, secret existant du cron quotidien.
- **CHANGELOG_GITHUB_TOKEN**, facultatif. Un jeton serveur en lecture seule sur le dépôt peut augmenter le quota GitHub. Le dépôt public fonctionne aussi sans jeton.

Les tables sont créées par la migration additive exécutée lors de `pnpm build`. Le bouton automatique doit être activé depuis le compte administrateur après relecture de la configuration.

## Tests

`node --import tsx scripts/test-discord-changelog.ts` utilise une base SQLite temporaire, des réponses GitHub simulées et un serveur HTTP local imitant Discord. Aucun appel n’est envoyé au webhook réel. Les tests couvrent les 2 000 caractères, la classification, les publications concurrentes, la déduplication, les réponses ambiguës et l’exclusion des déploiements de test.

Une vérification en lecture seule sur les vrais commits GitHub a également confirmé que les notes de l’interface membre sont retenues et que les changements privés ne sont pas repris.
