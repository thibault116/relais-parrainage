# Catalogue et demandes privés — 16 novembre 2026

Toutes les entrées, images et actions restent réservées au compte principal, côté serveur, y compris pour les autres modérateurs. Aucun changement de release membre ni annonce Discord.

- Administration : les anciens raccourcis Tarifs / Monétisation sont retirés. Les écrans Abonnement, Crédits, Prestations et Rémunération du menu restent utilisables.
- Retraits : filtres de statut appliqués avant pagination ; affichage explicite du titulaire et de l’IBAN complet avec consultation auditée et bouton de copie. Aucune donnée bancaire dans la réponse de liste ni dans les annonces. Les décisions et références réutilisent la réservation des gains et le journal existants.
- Prestations : titre, description, image facultative (JPG/PNG/WebP, 4 Mo), prix et visibilité. Les images sont conservées dans le stockage privé, servies uniquement au compte principal et jamais incluses dans une URL publique de Blob.
- Découvrir et profil : catalogue privé, recherche, tri par prix, fiche détaillée et demande avec besoin facultatif. Statistiques issues des données existantes, satisfaction calculée à partir des avis notés au moins 4/5 ; aucune valeur de démonstration présentée comme un résultat réel.
- Demandes : Prestations / Demandes libres ; instantané du prix et description, acceptation, refus avec motif obligatoire et restitution unique, réalisation. Les crédits sont réservés à la demande comme dans l’ancienne réservation. Le créneau est « À convenir ». Aucune négociation automatique du prix.
- Le bouton de message réutilise la messagerie existante et son consentement de contact. En test individuel, il n’est pas possible de s’envoyer un MP à soi-même : un message l’explique, sans inventer de compte ni ouvrir l’accès à un autre membre.
- La rémunération et les réservations existantes sont conservées. Le tutoriel porte maintenant le titre La rémunération, avec le texte fourni par le propriétaire.

## Passage réel : pas activé par ce déploiement

Le propriétaire a demandé le mode réel le 16 novembre. La configuration installée est encore le bac à sable `mentora-admin-test`. Il ne suffit pas de retirer les mentions « test » : les identifiants clients et abonnements Stripe test ne sont pas utilisables en réel. Les crédits et gains fictifs doivent rester séparés des paiements réels, et ne doivent jamais être virés comme des gains réels.

Avant activation, il reste à raccorder un compte Stripe réel activé et son webhook signé réel ; fournir la version des conditions commerciales validées ; confirmer le taux de rémunération réel (1,50 € par crédit n’est qu’une hypothèse de test, économiquement déficitaire pour certaines offres) et les informations légales manquantes. Ne jamais recopier les soldes de test en solde réel. Ne jamais fournir de clé secrète dans le chat. Les clés réelles seront enregistrées directement dans Vercel.

Les trois variables des virements manuels réels restent non activées. Aucun paiement ni virement réel n’a été lancé pour tester ces écrans.

## Vérifications

`scripts/test-private-services.ts` : isolation anonyme/membre/autre modérateur, origine et champs stricts, images privées, visibilité, besoin vide, double requête, crédit réservé une fois, refus motivé et remboursement unique, acceptation et réalisation, conservation du motif.
`scripts/test-manual-bank.ts` : filtres, accès, chiffrement, consultation auditée, transitions, restitutions, concurrence et notifications.

## Préparation technique du réel ajoutée

Le code supporte maintenant une bascule explicite, toujours limitée au propriétaire principal. Les tables financières réelles `money_live_*` sont créées à côté des tables de test, sans copie des soldes, des clients Stripe, des IBAN ou des gains d’essai. Le catalogue et ses images restent partagés. Une nouvelle saisie bancaire sera nécessaire dans l’environnement réel. Les signatures des webhooks déterminent leur environnement ; une signature de test ne peut jamais créditer la comptabilité réelle. Les données existantes restent conservées dans les tables de test. La séparation est testée dans `scripts/test-money-modes.ts`, sans aucun appel Stripe réel.

### Configuration indispensable dans Vercel Production

Ne pas remplacer les clés du bac à sable : ajouter des variables distinctes.

1. `STRIPE_LIVE_SECRET_KEY` : clé secrète ou restreinte **live** du compte Stripe activé, enregistrée en Secret. Autorisations nécessaires aux clients, Checkout, Billing, factures, remboursements et portail. Ne jamais la coller dans le chat.
2. `STRIPE_LIVE_WEBHOOK_SECRET` : secret **live** du webhook `https://mentora-resell.vercel.app/api/stripe/webhook`, pour `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` et `charge.refunded`. Format Snapshot compatible avec l’API de l’intégration. Le webhook doit viser le compte plateforme, pas Connect.
3. `MENTORA_COMMERCIAL_VALIDATED=true` et `MENTORA_COMMERCIAL_VALIDATION_REFERENCE` : référence réelle de la validation commerciale/juridique, à compléter par le titulaire. Aucun numéro de validation ni document juridique n’a été inventé.
4. `MENTORA_LIVE_TERMS_VERSION` : identifiant de la version des CGV effectivement finalisées et publiées. Le paiement réel conserve cette version acceptée. L’acceptation renvoie aux CGV, plus aux conditions des essais. Ne pas utiliser un identifiant test ni laisser des informations légales non renseignées.
5. `MENTORA_LIVE_PAYOUT_CENTS` : rémunération réelle du parrain par crédit, en centimes. À décider explicitement ; aucune reprise automatique de l’hypothèse d’essai à 150 centimes.
6. Pour les demandes de virement manuel réelles : `MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED=true`, `MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED=true` et `MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE`, après validation du fonctionnement manuel. Elles ne peuvent plus transformer les anciens gains de test en gains réels.
7. Seulement lorsque les éléments précédents sont prêts : `MENTORA_BILLING_MODE=live`, puis redéployer. Il n’y a jamais de repli automatique vers une clé test si la configuration réelle manque. Sans configuration complète, les encaissements sont refusés.

Aucune de ces variables réelles n’a été créée ni activée lors du déploiement. Le bac à sable existant continue de fonctionner. L’autorisation du propriétaire de passer au réel est enregistrée dans la conversation ; les renseignements et secrets live nécessaires restent à fournir directement dans les services concernés. Aucun compte Stripe Connect ni aucun virement automatique ne sont réintroduits.

Sources techniques officielles : https://docs.stripe.com/keys et https://docs.stripe.com/webhooks.
