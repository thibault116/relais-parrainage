# Monétisation privée — Stripe test

Accessible dans Administration → Monétisation uniquement au propriétaire principal (email et compte modérateur vérifiés côté serveur). Aucun accès pour les autres membres, y compris les autres administrateurs. Les droits actuels des membres restent inchangés.

## Configuration
- STRIPE_SECRET_KEY : clé test uniquement ; clés live refusées.
- STRIPE_WEBHOOK_SECRET : signature de /api/stripe/webhook.
- MENTORA_BILLING_ORIGIN : optionnel, origine HTTPS du site (sinon BETTER_AUTH_URL).
- MENTORA_TEST_PAYOUT_CENTS : hypothèse de rémunération en centimes par crédit, 150 par défaut. Figée à la réservation. Aucun virement ni conversion du portefeuille.

Le bac à sable mentora-admin-test et le webhook de production sont configurés. Aucun paiement réel activé. Ne pas utiliser de carte réelle : carte Stripe test 4242 4242 4242 4242, date future et CVC fictif.

## Parcours
1. Abonnements : Free, Starter 14,90 € / 10 crédits, Plus 29,90 € / 22 crédits, Pro 49,90 € / 38 crédits. Comparaison des fonctionnalités conservée.
2. Portefeuille : recharges de 5, 10, 20 ou 40 crédits, historique, factures et remboursements test. Les crédits ne sont ajoutés que par webhook signé, pas par le retour navigateur. Actualiser après quelques secondes.
3. Prestations : créer/modifier/archiver une prestation puis la publier dans le catalogue privé.
4. Réserver : le même compte administrateur joue le débutant ; besoin et créneau, déduction atomique.
5. Réservations : accepter, terminer, refuser ou annuler ; restitution unique. Un remboursement de prestation terminée annule la rémunération due.
6. Rémunérations : suivi des montants prévus et dus, aucun versement automatique.

Le portail Stripe permet factures, moyen de paiement et résiliation en fin de période. Le changement de formule peut être programmé au prochain renouvellement via un échéancier Stripe, sans débit ni crédit anticipé. La résiliation annule cet échéancier et prend effet en fin de période ; la reprise réactive le renouvellement. Les crédits cumulés sont conservés. Un remboursement monétaire retire proportionnellement les crédits, arrondis au supérieur ; si déjà consommés, le solde peut devenir négatif et bloque de nouvelles réservations.

## Vérifications effectuées
- Build Next.js et tests locaux (scripts/test-monetization.ts).
- Refus anonyme API et refus des signatures invalides/clés live.
- Double webhook, réservations concurrentes, restauration et remboursements partiels.
- Checkout réel sandbox 8,90 €, crédit de 5 puis remboursement.
- Abonnement sandbox Starter : 10 crédits, renouvellement via horloge Stripe : 20 cumulés, résiliation : Free.
- Paiement refusé : aucun crédit ajouté.
- Interface : création, réservation à 12 crédits, acceptation, réalisation, rémunération due 18 €.

Tests Stripe effectués avec un compte local fictif et événements Stripe signés rejoués sur le serveur local. Les tests ne modifient aucun compte membre en production. Le versement aux parrains et l’ouverture au public nécessiteront une phase distincte.

## Point économique à décider avant ouverture
À 1,50 € de rémunération par crédit, Pro contient 57 € de rémunération potentielle pour 49,90 € encaissés, avant frais. Ce taux est une hypothèse de test à revoir, pas un tarif de rémunération validé.

## Accès administrateur dédiés
La formule s’affiche près du logo et sur le profil uniquement pour le propriétaire. Dans le menu mobile, Abonnement et Crédits réutilisent le système privé existant. Le profil parrain propriétaire dispose aussi de Prestations et Rémunération. Les nouvelles routes summary et billing vérifient l’identité du propriétaire côté serveur. Aucun autre membre ne reçoit ces entrées.

Tests supplémentaires : refus anonyme des deux nouvelles API, carte masquée et factures réelles sandbox, changement Starter → Plus au renouvellement via horloge Stripe, résiliation et reprise, portail de changement de carte. Contrôle visuel avec compte fictif local et largeur 320/390 px. Aucune donnée réelle modifiée.
