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
