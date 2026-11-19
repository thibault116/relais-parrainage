# Parcours d’inscription interactifs

## Entrée et persistance

`/inscription` affiche d’abord deux grandes cartes « Je suis débutant » et « Je suis parrain ». Le choix ouvre `/inscription?role=beginner` ou `/inscription?role=mentor` ; aucun sélecteur permettant de changer librement de rôle n’est affiché pendant les questions. L’authentification Better Auth reste inchangée. Ses appels de création/connexion interviennent uniquement sur le dernier écran ; aucun mot de passe n’est copié dans le brouillon navigateur.

Le parcours Débutant contient 10 questions sans ventes et 9 avec ventes ; le parcours Parrain en contient 8. Les sélections et champs « Autre » sont structurés séparément. Le modèle partagé `lib/intake.ts` décrit les questions, valide les montants, l’éligibilité et la capacité exacte, et invalide les réponses devenues incompatibles. Une capacité de 4–5 ou plus de 5 demande un nombre explicite ; la limite existante de 10 places est conservée.

Les réponses complètes sont enregistrées dans `onboarding_answers.answers`, au format `version: 2`. Le profil et les réponses sont sauvegardés dans la même transaction. La table existante et les identifiants de profils sont conservés. L’édition affiche « Mes informations et préférences » : chaque réponse est modifiable individuellement puis enregistrée.

Un brouillon sans identifiants de connexion est conservé dans `sessionStorage`, avec une durée de 24 heures, une séparation par rôle/profil et une vérification de la version de départ. Il n’est pas considéré comme une sauvegarde serveur. Si l’authentification réussit mais qu’une requête de sauvegarde échoue, les réponses restent dans le formulaire/brouillon et le membre peut relancer l’enregistrement avec sa session déjà ouverte.

## Compatibilité et migrations

- Les réponses v1 restent lisibles et les profils existants ne sont jamais obligés de refaire le questionnaire à la connexion, même si leur ancienne confirmation est absente ou périmée. La modification d’un profil existant sans nouveau questionnaire reste acceptée côté serveur.
- Lors du premier enregistrement v2, la réponse v1 est conservée sous `legacy`, exclusivement côté propriétaire/administration. Elle est reprise depuis la base par le serveur ; le client ne peut pas remplacer cette archive.
- Les références de preuves v1 restent protégées contre une suppression tant qu’elles sont référencées. L’image de réussite historique reste disponible via son endpoint ; les dossiers de vérification indépendants ne sont pas modifiés.
- Les champs historiques nécessaires à l’annuaire et aux accompagnements sont adaptés côté serveur. Les tranches d’expérience du Parrain sont affichées comme des tranches ; le champ numérique de compatibilité utilise leur borne minimale, sans inventer une date de début. Le nombre de mois d’un débutant n’est pas déduit arbitrairement de son nombre de ventes.
- Le pseudo Discord devient facultatif à l’inscription. La contrainte SQL d’unicité existante est conservée avec un identifiant interne lorsque le contact n’est pas renseigné ; cet identifiant n’est jamais affiché comme un vrai pseudo Discord.
- La migration additive `profile_terms_acceptances` conserve la version des CGU et la date acceptées pour les nouveaux profils. Elle est incluse dans `migrateOnboarding` et créée de manière compatible à la première sauvegarde sur une installation existante. Aucune table ni donnée existante n’est supprimée.

## Confidentialité et vérification

`GET /api/me` ne retourne que le questionnaire du membre connecté. Les projections publiques retirent le budget et le montant de l’objectif financier, ainsi que le budget des anciens questionnaires. Les routes d’annuaire, de détail et d’abonnés utilisent cette projection ; la recherche textuelle n’utilise que les réponses publiques. Les spécialités historiques restent filtrables et les nouvelles méthodes d’achat sont proposées dans le même filtre.

Les critères d’éligibilité Parrain restent vérifiés côté serveur : moins de six mois est refusé. Aucune approbation ni preuve n’est créée automatiquement, aucun tarif de prestation n’est modifié à partir de l’objectif financier.

## Vérification

`node --import tsx scripts/test-intake.ts` crée une base temporaire, y applique les migrations puis teste les deux branches Débutant, le Parrain, les incompatibilités, les capacités explicites, les montants invalides/personnalisés, les droits, les sauvegardes/relectures/modifications, la version des conditions et la confidentialité des réponses dans les recherches, fiches et abonnés. Les anciens comptes et les références de preuves sont également couverts. Aucun service externe n’est appelé.

Contrôles navigateur effectués avec une base temporaire distincte : trois parcours, choix multiples et personnalisés, retour arrière, changement de branche, deux curseurs, écran de compte final, connexion d’un compte fictif avec conservation des réponses, modification d’une seule réponse puis rechargement, mode clair/sombre et réduction des animations.

Cette refonte remplace une fonctionnalité `onboardingV2` déjà stable et utilise ses contrôles existants. Elle n’active aucune autre fonctionnalité en bêta et ne modifie pas les autorisations des comptes.
