# Coordonnées bancaires et demandes manuelles — prototype privé

Ce parcours remplace la vue Stripe dans Rémunération pour le compte administrateur principal uniquement. Les API exigent la session propriétaire, son e-mail et son statut de modérateur. Aucun membre ni autre administrateur n'y accède. Aucun changement de release membre ou Discord.

Le formulaire collecte seulement titulaire, pays (France, Belgique, autre) et IBAN. Validation ibantools et cohérence pays/préfixe côté serveur. Il n'utilise aucun composant Connect, ne crée aucun compte financier et n'appelle aucun service bancaire. Les anciens comptes et historiques Stripe restent intacts.

## Stockage

BANK_DETAILS_ENCRYPTION_KEY : 32 octets aléatoires, encodés en 64 caractères hexadécimaux, variable Vercel Secret serveur uniquement. Sans cette clé le formulaire ne peut pas enregistrer de coordonnées. Aucun secret de secours ni réutilisation du secret d'authentification. Ne pas remplacer cette clé sans une migration de chiffrement : les coordonnées déjà enregistrées deviendraient illisibles. Ne jamais la journaliser ou la committer.

AES-256-GCM avec IV aléatoire et données authentifiées liées au propriétaire et à la finalité (coordonnées courantes ou identifiant de demande). Nom du titulaire et IBAN sont chiffrés ensemble. Le serveur renvoie seulement le titulaire, le pays et les quatre derniers caractères de l'IBAN. Les erreurs et journaux ne contiennent pas le formulaire reçu. Réponses private/no-store, mutations protégées par origine.

## Demandes

Les sommes viennent exclusivement des réservations de prestations terminées. Le montant, le bénéficiaire et le solde ne sont jamais acceptés du navigateur. Aucun seuil commercial : une somme positive dès 1 centime est acceptée. Pas de demande de zéro euro. Les crédits ne sont pas convertibles.

La demande conserve un instantané chiffré des coordonnées et réserve atomiquement les gains dans le même registre d'allocation que l'ancien parcours Stripe. Impossible de réserver le même gain deux fois, y compris entre les deux parcours. Un remboursement de prestation affectée est bloqué. L'annulation libère les gains une seule fois. Les clés d'idempotence sont liées au propriétaire.

Mes retraits rassemble demandes manuelles et anciens retraits Connect. Une demande manuelle est « À traiter · test », jamais « Payé » : aucune route ne permet de fabriquer une confirmation de virement. Les API ne déclenchent aucun virement, aucune exportation bancaire et aucun mouvement réel. Ce prototype enregistre et annule des demandes ; il n'est pas un système de versement opérationnel en argent réel. Avant toute commercialisation, faire valider le modèle, les obligations d'identification, de facturation, comptables et de paiement par les professionnels compétents. Le choix manuel ne garantit aucune dispense réglementaire.

## Vérification

node --import tsx scripts/test-manual-bank.ts : base temporaire, clé éphémère, aucune requête bancaire. Vérifie accès, CSRF, validation FR/BE, chiffrement, isolation, idempotence, 1 centime, annulation et allocations communes. Les données de test sont effacées ensuite.

L'ajout de la clé privée en environnement Vercel Production a été refusé par le contrôle automatique faute d'accord explicite. L'interface et les tests sont préparés ; l'enregistrement restera inactif tant que l'administrateur n'aura pas autorisé et configuré cette clé. L'environnement Production désigne l'hébergement du site, pas l'activation de virements réels.

## Activation du 14 novembre 2026

Après présentation du formulaire et explication du refus automatique, le propriétaire a explicitement autorisé la création de BANK_DETAILS_ENCRYPTION_KEY. La clé a été générée aléatoirement en mémoire, transmise à Vercel par l’entrée standard du CLI et enregistrée comme Secret, sur relais-parrainage / Production uniquement. Elle n’a pas été affichée ni conservée dans un fichier local ou dans Git. Cette activation ne déclenche aucun versement et ne met pas en service des paiements réels.
