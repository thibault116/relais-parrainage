# Relais

Plateforme française de parrainage entre membres d’une formation en achat-revente de vêtements. Interface violette, responsive, profils débutants/parrains, annuaire filtrable et prise de contact sur Discord.

## Fonctionnalités

- Comptes e-mail/mot de passe, sessions sécurisées avec Better Auth et limitation des tentatives en base.
- Questionnaire en trois étapes, adapté au rôle. Six mois d’expérience minimum pour les parrains.
- Objectifs, spécialités, références, ancienneté, tranche d’âge facultative, disponibilités, durée, délai de réponse, places disponibles et CA mensuel facultatif.
- Recherche par nom, marque, spécialité et disponibilité ; pagination.
- Pseudo Discord accessible uniquement aux membres connectés avec un profil ; lien direct si identifiant numérique renseigné. Les demandes d’amis sont faites par le membre sur Discord.
- Modification, masquage, réactivation et suppression du profil. Un profil masqué est exclu de l’annuaire et de l’API de contact.
- Charte et guide. Pas de faux membres ni statistiques inventées.

## Développement local

Node.js 24, pnpm 11 :

```sh
pnpm install
pnpm db:migrate
pnpm dev
```

SQLite persistant est utilisé dans `.data/relais.sqlite` uniquement en local. Si le port est différent de 3000, définir `BETTER_AUTH_URL` avec l’URL exacte. La base locale et ses comptes de test ne sont jamais déployés.

## Production Vercel

Projet : `relais-parrainage`. Base PostgreSQL Neon dédiée : `relais-production`, Francfort. Aucun partage de données avec Closet Pilot.

Variables serveur : `DATABASE_URL`, `BETTER_AUTH_SECRET` (aléatoire, au moins 32 caractères), `BETTER_AUTH_URL` (URL publique exacte). Les secrets sont configurés dans Vercel, jamais dans GitHub.

Commande de construction : `node --import tsx scripts/migrate.ts && next build`. Les migrations ajoutent les tables manquantes, sans réinitialiser les données. Elles s’exécutent avant la compilation pour éviter de publier une application sans schéma. Pour une équipe plus importante, déplacer les migrations dans une étape de déploiement unique.

La base de production est connectée uniquement à l’environnement Production. Configurer une base distincte et un secret propre avant d’activer un environnement Preview fonctionnel. Une instance Vercel sans base ou sans secret échoue explicitement et ne stocke jamais les profils sur disque éphémère.

## Vérifications

```sh
pnpm typecheck
pnpm build
# Serveur local et base de test initialisée :
TEST_URL=http://127.0.0.1:3001 pnpm test
```

Les tests créent puis suppriment des comptes temporaires. Ils vérifient l’inscription, la connexion, la persistance, l’isolation des comptes, les validations, l’origine des écritures, l’unicité Discord, la recherche, la confidentialité des contacts, le masquage et la suppression. Ils refusent une URL distante.

## Limites et exploitation

- Les profils et résultats financiers sont déclaratifs, sans vérification d’appartenance à la formation.
- Pas de messagerie intégrée : les conversations et demandes d’amis ont lieu sur Discord.
- Les places et la durée sont gérées par les membres. Les binômes sont confirmés sur Relais et peuvent être marqués terminés par l’un des participants. Une note unique de 1 à 5 est alors possible pour le débutant. La réalité des échanges Discord n’est pas contrôlée.
- Aucun service d’envoi d’e-mails configuré : pas de vérification d’adresse ni de récupération automatique du mot de passe pour cette première version.
- Les membres peuvent supprimer leur profil ; les comptes sont conservés tant qu’ils ne sont pas supprimés séparément. L’API Better Auth de suppression de compte exige une authentification récente / mot de passe et efface aussi le profil.
- Avant une diffusion à grande échelle, ajouter la modération propre à la communauté, l’identité et les coordonnées de l’exploitant ainsi qu’un service d’e-mails pour la récupération de compte.

## Accompagnements et notes

Le débutant demande un accompagnement depuis la fiche d’un parrain visible. Le parrain accepte ou refuse dans Mon profil. Seuls les deux participants peuvent terminer un accompagnement accepté. Seul le débutant de ce binôme terminé peut donner une note. L’écriture conditionnelle en base empêche les doublons, y compris simultanés. Un binôme ne peut être créé qu’une fois pour les mêmes comptes. Les notes sont conservées lors du masquage d’un profil, mais retirées lors de la suppression du compte concerné. Aucune note ne donne accès au contact d’un profil masqué.

Le groupe Discord est accessible depuis l’en-tête et le bloc communautaire : https://discord.gg/SRVs9Y5ze.


## Vérification des parrains

Les dossiers privés contiennent six réponses : ancienneté, plateformes, tranche de ventes, domaines d’aide, motivation sans limite de caractères et justificatifs. Deux catégories de preuves sont conseillées, une suffit. Chaque catégorie accepte des liens HTTPS ou des images/PDF (4 Mo par fichier, 12 fichiers par compte). Les fichiers sont conservés dans Vercel Blob privé (`BLOB_READ_WRITE_TOKEN`), avec leurs métadonnées dans `verification_files`. En local uniquement, ils sont enregistrés dans `.data/proofs`. Leur téléchargement exige une session du propriétaire ou d’un modérateur examinant le dossier auquel ils sont joints.

La validation reste humaine et ne peut pas être attribuée depuis le profil ni par le parrain lui-même. Le badge affiche les domaines examinés et la date, sans transformer une tranche déclarée en volume exact certifié. Les anciens dossiers restent consultables. Un nouveau dépôt retire le badge jusqu’au nouvel examen. Le retrait du dossier ou la suppression du profil/compte supprime aussi ses fichiers.

Configurer `MENTORA_MODERATOR_EMAILS` côté serveur, avec les adresses de comptes **déjà existants**, séparées par des virgules. La migration associe une fois chaque adresse à l’identifiant immuable du compte dans `moderators` (sans accorder l’accès dynamiquement sur une adresse non vérifiée). Cette liaison est conservée si le compte est supprimé pour éviter qu’une réinscription récupère l’accès. Pour retirer un accès, supprimer sa ligne dans `moderators` et retirer l’adresse de la configuration avant la prochaine migration. Si aucun modérateur actif n’est configuré, les dépôts sont fermés et l’interface le précise. Aucun utilisateur n’est nommé modérateur par défaut.

Test local : `node --import tsx scripts/test-verification.ts` avec l’application sur `http://127.0.0.1:3001`. Le script crée et supprime ses comptes temporaires et teste les accès, la confidentialité, les décisions concurrentes, les seuils, le renvoi et le retrait.


## Administration et cartes de profils

L’onglet Administration est réservé aux identifiants présents dans `moderators`. Il contient les indicateurs globaux, les comptes paginés par 30, les 100 derniers signalements (ouverts en premier), les 100 dernières notes et l’examen confidentiel des dossiers. Toutes les API vérifient ces droits côté serveur.

Un parrain actif a au moins un accompagnement en cours. Le taux d’acceptation est `(actifs + terminés) / (actifs + terminés + refusés)` ; les demandes en attente et annulées sont exclues. Les chiffres portent sur les données conservées, et ne constituent pas un historique immuable des comptes supprimés.

Les membres connectés peuvent signaler un profil. Un seul signalement ouvert par paire déclarant/profil et 5 signalements par jour sont autorisés. Un masquage de profil par la modération est conservé séparément de la visibilité choisie par le membre : il ne peut pas être annulé via l’édition du profil. Les avis masqués sont exclus des moyennes et restent enregistrés pour empêcher un second vote. Les décisions nécessitent un motif.

Les spécialités sont désormais une liste de choix cumulables. La migration retire l’ancien champ `joined` des données enregistrées et retire Streetwear/Sportswear des choix. Les profils concernés devront choisir leurs nouvelles spécialités. L’ancien palier indifférencié « 5 000 € et plus » devient non précisé, car il ne permet pas de déduire un nouveau palier fiable. Les paliers supérieurs sont 5 000–7 000 €, 7 000–10 000 € et 10 000 € et plus.

Les cartes affichent les statistiques réelles, un délai annoncé (pas un temps de réponse mesuré) et le nouveau champ `teaching`. Les binômes terminés sont comptés indépendamment des notes. Test du parcours administrateur : `node --import tsx scripts/test-admin.ts` sur le serveur local en port 3001.
