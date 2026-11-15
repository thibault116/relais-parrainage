# Coordonnées bancaires et demandes manuelles — prototype privé

Ce parcours remplace la vue Stripe dans Rémunération pour le compte administrateur principal uniquement. Les API exigent la session propriétaire, son e-mail et son statut de modérateur. Aucun membre ni autre administrateur n'y accède. Aucun changement de release membre ou Discord.

Le formulaire collecte seulement titulaire, pays (France, Belgique, autre) et IBAN. Validation ibantools et cohérence pays/préfixe côté serveur. Il n'utilise aucun composant Connect, ne crée aucun compte financier et n'appelle aucun service bancaire. Les anciens comptes et historiques Stripe restent intacts.

## Stockage

BANK_DETAILS_ENCRYPTION_KEY : 32 octets aléatoires, encodés en 64 caractères hexadécimaux, variable Vercel Secret serveur uniquement. Sans cette clé le formulaire ne peut pas enregistrer de coordonnées. Aucun secret de secours ni réutilisation du secret d'authentification. Ne pas remplacer cette clé sans une migration de chiffrement : les coordonnées déjà enregistrées deviendraient illisibles. Ne jamais la journaliser ou la committer.

AES-256-GCM avec IV aléatoire et données authentifiées liées au propriétaire et à la finalité (coordonnées courantes ou identifiant de demande). Nom du titulaire et IBAN sont chiffrés ensemble. Le serveur renvoie seulement le titulaire, le pays et les quatre derniers caractères de l'IBAN. Les erreurs et journaux ne contiennent pas le formulaire reçu. Réponses private/no-store, mutations protégées par origine.

## Demandes

Les sommes viennent exclusivement des réservations de prestations terminées. Le montant, le bénéficiaire et le solde ne sont jamais acceptés du navigateur. Aucun seuil commercial : une somme positive dès 1 centime est acceptée. Pas de demande de zéro euro. Les crédits ne sont pas convertibles.

La demande conserve un instantané chiffré des coordonnées et réserve atomiquement les gains dans le même registre d'allocation que l'ancien parcours Stripe. Impossible de réserver le même gain deux fois, y compris entre les deux parcours. Un remboursement de prestation affectée est bloqué. L'annulation libère les gains une seule fois. Les clés d'idempotence sont liées au propriétaire.

Mes retraits rassemble demandes manuelles et anciens retraits Connect. Les demandes manuelles possèdent les statuts En attente, En traitement, Payé et Refusé (Annulé conservé pour l’annulation par l’auteur). Un statut Payé est une déclaration administrative de paiement hors plateforme, pas une confirmation bancaire automatique. En mode test il est explicitement affiché « Payé · test ». Les API ne déclenchent aucun virement, aucune exportation bancaire et aucun mouvement réel. Ce prototype enregistre, traite, refuse et marque les demandes payées en simulation ; il ne déclenche aucun mouvement bancaire réel. Avant toute commercialisation, faire valider le modèle, les obligations d'identification, de facturation, comptables et de paiement par les professionnels compétents. Le choix manuel ne garantit aucune dispense réglementaire.

## Vérification

node --import tsx scripts/test-manual-bank.ts : base temporaire, clé éphémère, aucune requête bancaire. Vérifie accès, CSRF, validation FR/BE, chiffrement, isolation, idempotence, 1 centime, annulation et allocations communes. Les données de test sont effacées ensuite.

L'ajout de la clé privée en environnement Vercel Production a été refusé par le contrôle automatique faute d'accord explicite. L'interface et les tests sont préparés ; l'enregistrement restera inactif tant que l'administrateur n'aura pas autorisé et configuré cette clé. L'environnement Production désigne l'hébergement du site, pas l'activation de virements réels.

## Activation du 14 novembre 2026

Après présentation du formulaire et explication du refus automatique, le propriétaire a explicitement autorisé la création de BANK_DETAILS_ENCRYPTION_KEY. La clé a été générée aléatoirement en mémoire, transmise à Vercel par l’entrée standard du CLI et enregistrée comme Secret, sur relais-parrainage / Production uniquement. Elle n’a pas été affichée ni conservée dans un fichier local ou dans Git. Cette activation ne déclenche aucun versement et ne met pas en service des paiements réels.

## Administration des retraits — 15 novembre 2026

Administration → Retraits, réservé au propriétaire principal côté UI et serveur. Liste paginée de toutes les demandes, consultation explicite de l’instantané bancaire déchiffré (POST privé/no-store), journal des actions et décisions. Aucune coordonnée complète ne transite dans l’URL, les notifications ou le journal. Fermer la fenêtre efface les coordonnées révélées de l’état du composant.

Les nouveaux états sont dans money_bank_workflow, ajouté sans reconstruire les anciennes tables ni réinitialiser les états existants. Chaque changement prend le même verrou par propriétaire que les allocations financières. Révision optimiste et clé d’idempotence empêchent les doubles décisions concurrentes. En attente → En traitement / Refusé ; En traitement → Payé / Refusé. Payé et Refusé sont terminaux. Une référence non vide et une confirmation sont obligatoires pour Payé ; un motif est obligatoire pour Refusé. Une réservation Payé reste allouée ; un refus la libère une seule fois, sans supprimer une éventuelle nouvelle réservation ultérieure.

Le journal money_bank_audit est en ajout uniquement via l’application : auteur, demande, ancien/nouvel état, révision, référence, motif et date. Les consultations bancaires sont également tracées. La politique de conservation des pièces financières et des traces doit être validée avant commercialisation ; cette version ne prétend pas être juridiquement validée.

Notifications : l’audit alimente la boîte existante de notifications du membre ; les transitions en traitement/payé/refusé ajoutent atomiquement des tâches dans push_outbox pour les appareils du seul bénéficiaire. Le worker existant traite ces messages. Les anciens événements de statut devenus obsolètes sont ignorés ; les clés événement/appareil évitent les doublons. Pas d’IBAN, de titulaire, de référence ou de montant dans les push.

Les anciennes API de création/reprise de retraits Stripe et de tests de payout refusent maintenant les POST avec 410 (après vérification des droits). Les historiques sont conservés, et les abonnements/recharges Stripe Checkout et Billing restent intacts. Le nouveau parcours manuel n’importe ni n’appelle Stripe Connect.

## Activation réelle ultérieure — non effectuée

La politique ne devient réelle qu’après configuration explicite des TROIS variables de déploiement :
- MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED=true
- MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED=true
- MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE=<référence de la validation professionnelle>

Aucune de ces variables n’est ajoutée ou activée dans cette intervention. Ce mécanisme ne réalise pas une validation juridique : elle relève du propriétaire et de ses professionnels. Une seule variable ne suffit pas. Le mode est figé par demande pour que les simulations anciennes ne deviennent jamais des paiements réels. Même après activation, les virements se font manuellement dans la banque ; Mentora ne dispose d’aucune API de virement. L’accès des autres membres reste fermé : son ouverture nécessite une décision de lancement distincte et les contrôles de rôle/feature correspondants.

Tests : scénarios FR/BE, autorisations, CSRF, 1 centime, concurrence, idempotence, refus et restitution, paiement et réservation définitive, référence/confirmation obligatoires, instantané bancaire inchangé, audit sans IBAN, destinataire des notifications et blocage des anciennes routes Stripe. Tests sans réseau bancaire, avec clés et bases temporaires.

Références de sécurité consultées : https://www.cnil.fr/fr/securite-gerer-les-habilitations et https://www.cnil.fr/fr/securite-tracer-les-operations.
