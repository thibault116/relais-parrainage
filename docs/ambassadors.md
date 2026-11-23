# Programme Ambassadeurs — pilote privé

Version préparée le 23 novembre 2026. Réservé au compte administrateur principal, avec opt-in bêta. Aucun déploiement de ce code n’ouvre le programme aux autres membres.

## Périmètre livré

- Administration → Ambassadeurs : recherche de membres existants, attribution d’un code unique, taux individuel ou taux par défaut, suspension, réactivation, retrait définitif, suivi des commissions, retraits et audit.
- Général → Ambassadeur : démonstration locale sans écritures financières, suivi de test du propriétaire et achats Stripe de test, avec et sans code.
- Le statut est indépendant des rôles Débutant, Parrain et Discord. Aucun faux compte n’est créé en production.
- L’API `/api/admin/ambassadors` impose la session du propriétaire principal et la bêta côté serveur. Les mutations exigent la même origine. Un utilisateur ordinaire, y compris bêta ou modérateur, n’y accède pas.
- Tous les appels du pilote s’exécutent sous `withMoneyMode("test")`. Les clés live sont refusées par le client Stripe de test. Aucun coupon live, réduction sur paiement live ou retrait réel n’est disponible. La version membre et les annonces Discord ne changent pas.

## Réduction et attribution

Valeurs initiales : réduction 500 points de base (5 %), commission 500 points de base sur le prix initial du pack, maturité 30 jours et retrait minimum 2 000 centimes (20 €).

Calcul entier : `floor((centimes * taux_en_points_de_base + 5000) / 10000)`. Arrondi au centime le plus proche ; un demi-centime s’arrondit vers le haut. Sur 2 000 centimes, remise 100, paiement 1 900, commission 100.

Les coupons et codes promotionnels Stripe sont le seul moteur de réduction. Le devis Mentora est une prévisualisation ; le webhook vérifie le code Stripe effectivement appliqué et les totaux Stripe. Le nombre de crédits reste celui du pack. Seuls les packs de lancement sont éligibles : ni l’offre administrateur à 1 €, ni les grilles privées Black Friday/définitive.

Une seule attribution par commande et par paiement. Aucun cookie d’affiliation, rattachement perpétuel ou commission sur un achat ultérieur sans code. L’auto-achat et les comptes avec le même e-mail normalisé sont refusés. Les comptes bloqués sont inéligibles. Cela ne prétend pas détecter à lui seul toutes les identités multiples : avant le lancement, définir la politique antifraude, les contrôles humains et l’usage éventuel de Stripe Radar, sans fingerprinting ajouté implicitement.

Les prix, crédits, rémunérations et retraits des prestations sont conservés. Les taux sont figés par achat ; une modification de configuration n’est pas rétroactive. Une suspension locale bloque immédiatement les nouvelles utilisations et commissions ; la synchronisation désactive le code Stripe. En cas d’échec, le code reste fermé côté Mentora et l’erreur est affichée pour une reprise manuelle. Le retrait du statut conserve les droits acquis, les lignes comptables et l’audit.

## Webhooks et fonds

Endpoint existant : `https://www.mentora-resell.app/api/stripe/webhook`.

Événements de paiement utilisés : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Ajouter au webhook **de test** `transfer.reversed` et `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. L’objet de contestation est relu depuis Stripe pour ne pas appliquer un ancien statut reçu en retard. Les signatures et le mode sont vérifiés dans le gestionnaire existant.

Le crédit et la commission sont idempotents. Une erreur après le crédit mais avant la commission provoque une reprise sans crédit doublé. Un paiement non confirmé, échoué, sans code ou provenant d’un auto-achat ne produit pas de commission.

Un remboursement partiel réduit la commission au prorata du paiement remboursé, avec reprise arrondie au centime supérieur. Un remboursement intégral l’annule. Une contestation ouverte/perdue bloque la commission ; une contestation gagnée la restaure, déduction faite des remboursements. Le gel antifraude manuel est audité. Les commissions déjà versées ne sont pas supprimées : une correction peut rendre le solde négatif et bloquer les versements suivants. La récupération après paiement doit faire l’objet d’un examen humain ; aucune reprise bancaire automatique n’est lancée.

Le solde retirable est calculé sur les commissions nettes arrivées à maturité, moins les demandes réservées et les versements. Le verrou de compte sérialise les demandes concurrentes. Chaque demande réserve précisément ses commissions. Un refus avant transfert libère la réserve. Une suspension n’annule pas les sommes acquises.

## Stripe Connect : test uniquement

Le pilote réutilise la liaison de compte Connect et l’onboarding hébergé Stripe existants. Mentora ne reçoit ni IBAN ni justificatif d’identité dans ce programme. Les coordonnées déjà utilisées pour les retraits manuels des parrains restent dans leur architecture actuelle.

Le seuil, le solde, le compte destinataire, les capacités et les exigences de vérification sont contrôlés à la demande puis à l’approbation. Après confirmation administrateur, seuls un transfert et un versement **fictifs** sont possibles. Les références et clés d’idempotence sont conservées. Un transfert sur le solde Connect ne signifie pas « Payé » : seule la confirmation du versement Stripe le permet. Les notifications Connect `payout.paid`, `payout.failed`, `payout.updated`, `payout.canceled` relisent le versement actuel. Un échec bancaire garde les fonds réservés dans Connect ; une reprise utilise le transfert existant et un nouvel essai de versement. Un résultat ambigu reste réservé, sans relance automatique. Après 23 heures sans référence de transfert, une reprise exige un rapprochement manuel dans Stripe.

## Avant un lancement réel

1. Faire valider les conditions du programme, le statut fiscal/social des bénéficiaires, la facturation, la TVA et les obligations comptables. Ne pas déclarer les CGV actuelles juridiquement validées.
2. Définir les règles pour les mineurs avec un professionnel et Stripe. Le pilote ne collecte pas leur âge et ne peut pas certifier leur éligibilité ; un retrait exige l’examen explicite du bénéficiaire, en plus de Stripe.
3. Confirmer avec Stripe l’éligibilité du modèle d’affiliation, les pays de plateforme/bénéficiaires, les capacités Connect, les frais, les responsabilités, le financement et les délais bancaires. Le bac à sable historique n’est pas une preuve de configuration live compatible.
4. Valider la rentabilité de chaque pack avec ses crédits bonus, frais de paiement et de Connect, TVA applicable, remboursements et coûts d’exploitation. Le tableau actuel affiche le reliquat théorique **avant frais et taxes** : il ne constitue pas une validation économique. Les promotions passées ne sont pas modifiées. L’architecture actuelle arrondit la rémunération par prestation : une prestation de 1 crédit rémunère 2 centimes à ce taux. Le tableau présente aussi le scénario de dépenses en prestations de 1 crédit, qui peut être déficitaire avant même les frais. Cette règle existante n’est pas modifiée par le programme.
5. Configurer `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` du bac à sable pour les essais de paiement. Pour l’onboarding test, activer Connect et les événements de compte connecté avec `STRIPE_CONNECT_WEBHOOK_SECRET`. Ne transmettre aucun secret dans le chat.
6. Effectuer un paiement test complet dans le dashboard Stripe, puis vérifier le webhook signé, les crédits, la commission, les remboursements et les contestations. Le serveur de tests automatisés injecte un faux client Stripe et n’émet aucun mouvement externe.
7. Avant ouverture publique, construire puis auditer le parcours membre et son autorisation serveur. Le pilote n’a aucune option pour ouvrir le programme au public ou passer les retraits en live : cette activation exige une nouvelle décision explicite et une modification contrôlée.
8. Valider le mécanisme de rapprochement et de récupération en cas de remboursement après un versement. Tester les échecs pays/banque et les minimums Stripe : le seuil Mentora de 20 € ne supprime pas les limites propres au prestataire.

## Sources officielles consultées

- Stripe, coupons et codes promotionnels : https://docs.stripe.com/payments/checkout/discounts
- Stripe, charges et transferts séparés (responsabilité plateforme, remboursements) : https://docs.stripe.com/connect/separate-charges-and-transfers
- Stripe, vérifications des comptes connectés : https://docs.stripe.com/connect/required-verification-information
- Service Public, activité entrepreneuriale des mineurs : https://entreprendre.service-public.gouv.fr/vosdroits/F31627

## Livraison et vérifications

Fichiers principaux : `lib/ambassadors/schema.ts`, `service.ts`, `withdrawals.ts` ; API privée `app/api/admin/ambassadors/route.ts` ; interface `app/components/ambassadors.tsx` et `app/ambassadors.css`. Navigation, gestion des comptes, achat de crédits et gestionnaires Stripe existants sont raccordés sans remplacer l’architecture.

Migration additive de sept tables dans chaque espace test/live : configuration, ambassadeurs, commandes attribuées, commissions, demandes de retrait, allocations et audit. Aucune suppression de données existantes. Le build existant appelle cette migration via `migrateMonetization`.

Commande : `node --import tsx scripts/test-ambassadors.ts`. Le script crée puis supprime sa base SQLite temporaire. Il couvre les accès propriétaire/bêta/modérateur/ordinaire, activation et unicité, synchronisation en panne, absence d’auto-achat, commandes avec/sans code, crédits et rémunération des prestations inchangés, arrondis, webhooks doublés/échoués, remboursements partiels et intégraux, contestation antérieure à la confirmation, délai et gel, retraits concurrents, refus, retrait du statut, versement confirmé, échec bancaire et reprise, résultat ambigu avec réutilisation de la clé Stripe, transfert inversé, dette après remboursement et refus du mode live. Les API sans session sont testées en refus d’accès.

La compilation Next.js et TypeScript et les parcours navigateur mobile/ordinateur ont également été contrôlés. Ces tests n’équivalent pas à un paiement réel ni à un versement bancaire réel.
