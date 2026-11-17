# Crédits et prestations — espace principal privé, 17 novembre 2026

Aucun accès membre ajouté ; routes réservées à isCrmOwner côté serveur. Aucun changement de member-release ni annonce Discord. Les paiements réels restent désactivés.

## Grilles de la maquette

| Pack | Lancement | Black Friday | Définitif |
|---|---|---|---|
| Découverte | 500 / 9,99 € | 510 / 8,90 € | 500 / 10,49 € |
| Essentiel | 1 020 / 19,99 € | 1 050 / 17,90 € | 1 020 / 20,99 € |
| Avancé | 2 100 / 39,99 € | 2 150 / 35,90 € | 2 100 / 42,99 € |
| Maxi | 4 870 / 89,99 € | 4 900 / 80,90 € | 4 870 / 99,99 € |

Sélection privée de la grille, lancement par défaut. Prix effectif calculé à partir du total exact. Aucun prix barré fictif. Identifiants v3 immuables dans les commandes et webhooks. Les anciennes commandes restent interprétables et les paiements conservés. Plus de nouvel abonnement ni portail de souscription ; les anciennes URL présentent les crédits. L'action propriétaire `credits-only` annule les contrats récurrents du client associé, libère leur planification et expire leurs Checkout récurrents, sans facturation finale ni perte de solde. Les anciennes fonctions de réconciliation restent pour les événements historiques.

## Validation d'une prestation

Les crédits sont réservés une seule fois à la demande. L'acceptation et le message automatique sont enregistrés dans la même transaction, puis le client ouvre la conversation privée de la prestation dans Messages. Le montant n'est pas débité une deuxième fois.

`reserved → accepted → completion_pending → completed`

Le parrain demande la clôture ; le débutant répond Oui ou Non au message. Non rétablit accepted, Oui seul libère la rémunération. Les révisions empêchent les réponses périmées, la transaction verrouille le compte et les événements ont des clés uniques. La disponibilité continue à compter completion_pending. Les retraits ne peuvent utiliser que completed. Les réservations historiques terminées restent inchangées.

La simulation autorise les deux vues Parrain/Débutant uniquement dans le namespace de test du propriétaire. Aucun message n'est envoyé aux autres membres. L'auto-confirmation d'une prestation réelle par son propre parrain est refusée côté serveur. Aucun déploiement général ni activation de véritables participants n'est effectué.

Nouveau taux des réservations : 1,6 centime par crédit (1,60 € pour 100 crédits), arrondi au centime sur chaque prestation. Montants des réservations et retraits existants non recalculés. Les rémunérations disponibles/en attente proviennent des états serveur ; aucune disponibilité dérivée d'un bouton client.

## Vérifications

Suites locales isolées : private-services (droits, CSRF, faux propriétaire, chat, double validation, Oui/Non, doublons, réponses périmées, gains en attente, crédit v3 après rattrapage et remboursement), credit-pricing-v2 (3 grilles et ancien catalogue), credit-transition (Stripe simulé uniquement), manual-bank (audit, réservations, refus/restitution), money-modes (isolation test/réel) et monetization. Compilation Next.js puis contrôle mobile de la version déployée.
