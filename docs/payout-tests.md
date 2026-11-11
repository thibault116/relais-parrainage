# Retraits administrateur : essais privés

Dans Menu → Paramètres → Rémunération, le compte administrateur principal dispose du bloc **Tester un retrait**. Le même bloc existe dans la rémunération du tableau de monétisation privé.

- **0 €** : enregistre le parcours dans Mentora, sans appel Stripe et sans virement. Stripe exige un entier strictement positif pour un payout.
- **0,01 €** : crée un objet Payout Stripe en mode test uniquement, avec une clé d’idempotence persistante. Aucun argent réel ne bouge. Le versement utilise la destination EUR par défaut du compte Stripe de la plateforme ; ce prototype ne provisionne pas de compte Connect pour un autre parrain.
- **Actualiser les statuts Stripe** : relit les virements de test en attente. « En attente » n’est jamais présenté comme « Versé ».
- Les crédits et les rémunérations de prestations ne sont jamais débités par ce parcours. L’historique utilise une table séparée `money_payout_tests`.
- Les montants sont limités côté serveur à 0 ou 1 centime. Les API sont réservées au compte principal avec contrôle de session et de modérateur, et protègent les mutations par contrôle d’origine.
- Une référence ne peut appartenir à deux comptes ou servir pour deux montants. Une requête ambiguë réutilise la même référence pendant moins de 23 heures ; au-delà, une vérification Stripe est exigée pour éviter de recréer un payout dont la clé d’idempotence aurait expiré.

## Configuration éventuelle

La variable existante `STRIPE_SECRET_KEY` doit être une clé `sk_test_` ou `rk_test_`. Les clés live sont refusées. Une clé restreinte doit avoir les permissions de lecture/écriture des Payouts. Pour 0,01 €, le bac à sable doit autoriser les versements, disposer d’un solde EUR disponible et d’une destination bancaire de test EUR. Mentora n’ajoute aucune donnée bancaire réelle. Si Stripe refuse l’opération, le registre indique l’échec sans inventer une réussite ni augmenter le montant demandé.

Le bouton 0 € permet de vérifier immédiatement le parcours sans prérequis bancaire. Les versements réels et les retraits des autres membres restent désactivés.

## Vérifications

`node --import tsx scripts/test-payouts.ts` utilise une base temporaire et un client Stripe simulé. Vérifie 0 €, 0,01 €, l’historique, les doubles clics, l’isolation, les erreurs, la reprise, le refus des autres montants et des clés live.

Sources : https://docs.stripe.com/api/payouts/create et https://docs.stripe.com/testing
