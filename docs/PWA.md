# Mentora PWA et Web Push

## Installation
Le site fonctionne toujours dans un navigateur. Le manifeste Next.js `/manifest.webmanifest` déclare Mentora, le mode standalone, les couleurs et les icônes du logo existant. Le bouton Installer Mentora est disponible en bas du site et dans Paramètres. Il ouvre la proposition native lorsque le navigateur la fournit, sinon un guide adapté. Aucune permission push n’est demandée au chargement.

Sur iPhone/iPad (iOS 16.4+ pour les push) : Safari → Partager → Sur l’écran d’accueil → Ajouter, puis ouvrir cette icône. Le logo doit apparaître sur l’écran d’accueil et l’application s’ouvrir sans barre d’adresse. Une installation déjà détectée masque la proposition. Certains navigateurs ne permettent pas de détecter une installation faite ailleurs ; le site reste utilisable.
Sur Android/ordinateur : Installer Mentora ou le menu d’installation de Chrome/Edge. Safari Mac propose Fichier → Ajouter au Dock. La disponibilité dépend du navigateur et du système.

## Notifications
Dans l’application installée : se connecter → Paramètres → Notifications → Activer les notifications push → Autoriser → Envoyer une notification de test. Le test est limité à un par minute et par appareil. Verrouiller ensuite le téléphone et faire envoyer une demande par un autre compte pour vérifier une notification d’événement. Toucher celle-ci doit ouvrir les demandes. Vérifier aussi le mode Concentration et les notifications système.

Les clés VAPID sont communes à l’application et stables. En production Vercel :
- `VAPID_PUBLIC_KEY` : clé publique, transmise à un membre connecté pour s’abonner.
- `VAPID_PRIVATE_KEY` : Secret Vercel, jamais exporté vers le navigateur.
- `VAPID_SUBJECT` : `mailto:mentora.officiel@gmail.com`.

Le script `node scripts/generate-vapid.mjs` crée une paire dans `.env.vapid.local`, exclu de Git, avec des permissions privées et sans écrasement. Ne pas régénérer les clés après activation : une rotation exige le réabonnement des appareils. Après changement des variables Vercel, redéployer. Pour les essais locaux, utiliser une paire distincte. Ne pas mettre les clés privées dans NEXT_PUBLIC_*.

## Architecture
Better Auth détermine l’utilisateur des API ; aucun identifiant utilisateur fourni par le client n’est utilisé pour choisir un destinataire. PostgreSQL en production, SQLite pour les tests. Migrations additives : push_subscriptions, push_preferences, push_outbox. Un endpoint ne peut pas être réassigné à un autre membre. Les clés d’abonnement ne sont pas renvoyées par les API de liste.

Les événements email_events existants alimentent les deux canaux via enqueueMail/enqueuePush. Les e-mails gardent leurs préférences ; les push sont explicitement activés par appareil, l’alerte de places étant désactivée par défaut. La désactivation des e-mails ne désactive pas les push. Les tests d’e-mails et les relances ne créent pas de push. La pertinence de l’événement, le destinataire, les abonnements et le suivi du parrain sont revérifiés avant l’envoi. Les notifications ne contiennent pas les données des membres.

Chaque événement/type/appareil a une clé unique en base. Les envois sont réclamés atomiquement avec un bail et réessayés au plus 5 fois. Une même notification utilise le même tag sans renotify ; cela limite également l’affichage en double lors d’une reprise après incident. Les réponses 404/410 suppriment l’abonnement. La déconnexion tente de retirer cet appareil et désabonne le navigateur ; la suppression du compte retire toutes ses données push.

L’envoi commence après les réponses des API existantes ; le cron e-mail existant sert aussi de reprise. Son rythme actuel est quotidien : en cas d’incident ou d’un gros volume en attente sans activité, la reprise n’est pas immédiate. Les notifications de plus de 24 h sont ignorées ; leur historique technique est purgé après 30 jours. Un push accepté par le service ne garantit pas son affichage si l’appareil est hors ligne, si les permissions changent ou si le système le bloque.

## Hors ligne et mises à jour
Le service worker met uniquement en cache `/offline.html` et le logo statique. Aucune page privée, réponse d’API ou donnée membre n’entre dans Cache Storage. Les navigations utilisent le réseau sans cache ; une panne affiche la page hors ligne. Les requêtes API ne sont pas interceptées. Le worker n’utilise pas de cache de bundles Next.js, évitant de bloquer une ancienne version. Le bandeau de mise à jour existant reste actif ; les nouvelles versions du worker sont vérifiées au retour dans l’application.

## Vérifications
- `node --import tsx scripts/test-push.ts` : événements, appareils, préférences, déduplication et confidentialité (transport simulé, aucun envoi réel).
- `node scripts/test-pwa.mjs` : cache statique uniquement et destinations des notifications.
- `node scripts/test-push-http.mjs` : API sur serveur local uniquement ; comptes fictifs, aucun envoi réel.
- `pnpm typecheck` et `pnpm build`.
- `TEST_URL=http://localhost:3000 pnpm test` : fonctions existantes sur copie locale.
- Vérifier manuellement iPhone et Android : installation, icône, permission volontaire, test, réception application fermée, clic, désactivation, deuxième appareil et fonctionnement hors ligne.

Références : https://nextjs.org/docs/app/guides/progressive-web-apps ; https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
