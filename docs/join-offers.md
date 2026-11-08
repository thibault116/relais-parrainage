# Nous rejoindre — présentation des offres

Entrée mobile dans Menu → Paramètres uniquement pour le compte administrateur principal. API /api/offers protégée par isCrmOwner : email du propriétaire et présence dans les modérateurs. Aucun autre membre, bêta ou non, ne peut y accéder. L’annonce dédiée a été retirée et son identifiant neutralisé afin de ne pas afficher une ancienne annonce après migration.

Tarifs conservés sur instruction du propriétaire : Free 0 €, Starter 14,90 €, Plus 29,90 €, Pro 49,90 €/mois. Annuel présenté avec remise de 20 % : Starter 143,04 €/an (11,92 €/mois équivalent), Plus 287,04 €/an (23,92 €/mois), Pro 479,04 €/an (39,92 €/mois). Les crédits sont toujours exprimés par mois (0, 10, 22, 38).

Comparatif de 11 lignes reprenant les formules existantes ; fonctionnalités à venir signalées. Les boutons payants ouvrent un récapitulatif explicite ; Free ouvre Découvrir. Cette présentation ne crée ni abonnement, ni paiement. Les paiements Stripe restent privés au compte propriétaire et en mode test.

Vérifications : compilation et TypeScript, contrôles d’accès HTTP : anonyme refusé, débutants normaux et bêta refusés, parrain bêta refusé, propriétaire autorisé même sans bêta ; calculs annuels, tableau et absence de lien de paiement. Rendu testé à 320, 390 et 430 px ; les petites largeurs peuvent faire défiler le tableau horizontalement dans sa région dédiée sans faire déborder la page. Le bandeau fixe est distingué du contenu au défilement.
