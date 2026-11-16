# Barème privé confirmé le 16 novembre 2026

Réservé au compte administrateur principal. Aucun changement de release membre, aucun pop-up ni annonce Discord. Paiements réels toujours conditionnés aux secrets live et à la validation commerciale existante.

## Offres nouvelles

Abonnements mensuels : Free 0 € / 0 crédit ; Starter 14,90 € / 700 crédits ; Plus 29,90 € / 1 600 crédits ; Pro 49,90 € / 2 800 crédits. Fonctionnalités inchangées. Annuel conservé avec remise de 20 %, versement de 12 fois le nombre mensuel à chaque facture annuelle, comme auparavant.

Recharges issues des captures :

| Nom | Prix | Crédits achetés | Bonus | Total |
|---|---:|---:|---:|---:|
| Découverte | 10 € | 500 | 0 | 500 |
| Essentiel | 18 € | 900 | 100 | 1 000 |
| Avantage | 36 € | 1 800 | 200 | 2 000 |
| Maxi | 64 € | 3 200 | 800 | 4 000 |

Quantités personnalisées : 2 centimes par crédit, sans bonus automatique ; de 25 à 10 000 crédits. Le minimum de 25 correspond au minimum de paiement par carte de 0,50 € en EUR, pas à un minimum de retrait. 100 crédits personnalisés coûtent bien 2 €.

Rémunération d’une nouvelle réservation : 1 centime par crédit, soit 1 € pour 100 crédits, que les crédits soient achetés ou bonus. Configuration Production MENTORA_TEST_PAYOUT_CENTS=1 et MENTORA_LIVE_PAYOUT_CENTS=1 ; cette dernière ne suffit pas à activer le réel.

## Conservation et sécurité

Les nouvelles offres utilisent des identifiants v2. Les anciens packs et quantités personnalisées v1 restent résolus uniquement pour confirmer les anciennes sessions. Le serveur refuse de créer de nouveaux paiements sur les anciens packs. Les nouvelles souscriptions conservent l’identifiant de l’offre exacte dans les métadonnées Stripe et dans la commande. Une ancienne facture est traitée selon les métadonnées figées sur cette facture, pas selon la formule courante.

Aucun portefeuille, abonnement Stripe existant, prix de prestation déjà créé ou historique de paiement n’est converti automatiquement. Les anciens abonnements gardent leurs droits contractuels jusqu’à un changement d’offre ; leur quota effectif est affiché dans Mon abonnement. Les réservations existantes conservent leur rémunération figée. La nouvelle rémunération s’applique aux nouvelles réservations. Les crédits bonus font partie du total accordé une seule fois après confirmation du paiement ; un remboursement retire la proportion correspondante du total, bonus inclus.

Vérification dédiée : scripts/test-credit-pricing-v2.ts ; complétée par les suites monétisation et séparation test/réel et la compilation Next.js.

Sources pour les clés et le webhook : https://docs.stripe.com/keys ; https://docs.stripe.com/webhooks ; minimum EUR : https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts.
