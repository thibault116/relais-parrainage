# Rémunération des parrains — Stripe Connect, test privé

## Périmètre actuel

Interface dans Menu → Paramètres → Rémunération et Administration → Monétisation → Rémunérations. UI et API réservées au compte administrateur principal, vérifié par session, identifiant de modérateur et e-mail propriétaire. Les autres membres, y compris les autres administrateurs et les comptes bêta, n’ont aucun accès. Aucun changement d’annonce membre ni d’annonce Discord.

Le client `stripeTest()` refuse les clés réelles. Les soldes de la plateforme et du compte connecté doivent renvoyer `livemode=false`, et chaque transfert/payout est contrôlé avant enregistrement. Le passage en production financière est volontairement impossible dans cette version.

## Compte bancaire et identité

La création d’un compte connecté utilise Accounts v1 avec les propriétés `controller` (collecte des exigences chez Stripe, dashboard Express, transferts et calendrier manuel). Cette variante s’intègre aux objets Transfer et Payout v1 déjà utilisés par Mentora, sans migration des paiements existants. Stripe conserve l’identité, les justificatifs et l’IBAN. Mentora ne garde que le rattachement utilisateur/compte Stripe, le pays déclaré et les identifiants d’opérations. Les éventuels nom de banque et quatre derniers chiffres sont relus chez Stripe, pas stockés.

Le membre ouvre un lien Stripe éphémère et authentifié depuis Mentora. Au retour, le serveur relit les capacités et `payouts_enabled` : un retour sur le site n’est pas considéré comme une validation du dossier. Un lien expiré se renouvelle avec « Compléter mon dossier Stripe ». Le bouton de dashboard permet de gérer la banque chez Stripe. Le compte utilise l’accord de service complet et demande `card_payments` et `transfers`, exigés ensemble par Stripe pour le compte FR de ce bac à sable US. L’application n’ajoute pas d’encaissement direct par les parrains. Ne pas substituer l’accord `recipient` : il relève d’un autre parcours pour les virements transfrontaliers.

## Gains et retraits

Les gains proviennent exclusivement des `money_bookings` terminées, rattachées au propriétaire de la prestation via `money_services.owner_id`. Le taux est celui figé dans `payout_cents` lors de la réservation, jamais une conversion du portefeuille de crédits. Le prototype de réservation reste privé : ne pas l’ouvrir aux membres en retirant simplement un contrôle d’accès.

La demande réserve atomiquement l’ensemble des gains disponibles dans `money_connect_allocations`. Une prestation ne peut être réservée deux fois. Le montant et le destinataire ne sont jamais fournis par le navigateur. Le serveur transfère ces fonds de la plateforme au compte connecté puis demande un payout en contexte `Stripe-Account` du parrain, vers sa banque par défaut. Le compte propre de Mentora n’est pas le destinataire de ce payout.

Une erreur de transfert définitive libère les gains. Après un transfert confirmé, un échec de virement conserve les gains sur le compte connecté : la reprise ne crée pas un second transfert. Un payout en attente n’est pas affiché comme versé. Les demandes ambiguës conservent leur clé d’idempotence ; après 23 heures, une tentative ambiguë nécessite une vérification dans Stripe. Un règlement différé peut être repris plus tard si aucune tentative bancaire n’a encore été émise. Les crédits ne sont pas débités par un retrait.

Un échec bancaire tardif après un premier statut `paid` reste pris en compte. Les événements Connect relisent le payout exact, même s’il n’est plus dans les retraits récents ; un ancien événement ne peut pas écraser un échec bancaire confirmé par un état en attente ou payé de la même tentative.

Un remboursement de prestation dont les gains sont réservés ou transférés est bloqué : il nécessite d’abord une vérification/régularisation Stripe. Les transferts annulés manuellement dans le dashboard et litiges éventuels demandent un traitement administrateur ; cette version n’effectue pas de récupération automatique d’argent déjà versé.

## Configuration Stripe indispensable

1. Activer/configurer **Connect dans le bac à sable existant**. Ne pas activer les paiements réels. Stripe peut demander au titulaire du compte de compléter son profil de plateforme et d’accepter ses conditions. Les pays autorisés et transferts transfrontaliers dépendent de cette configuration.
2. Conserver `STRIPE_SECRET_KEY` en mode test, avec les droits Accounts, Account Links/Login Links, Balances, Transfers et Payouts nécessaires. Ne jamais publier cette clé dans GitHub ou dans `NEXT_PUBLIC_*`.
3. Ajouter une destination d’événements de **comptes connectés** (Accounts v1, événements snapshot) vers `https://mentora-resell.vercel.app/api/stripe/webhook`. Événements : `account.updated`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`. Renseigner sa clé de signature dans **`STRIPE_CONNECT_WEBHOOK_SECRET`** sur Vercel, puis redéployer. La signature existante `STRIPE_WEBHOOK_SECRET` des abonnements/recharges reste en place.
4. Depuis Rémunération, choisir le pays du titulaire de test, confirmer le mode test, puis compléter le parcours Stripe avec les données de test documentées. L’identité réelle et les conditions légales ne sont pas validées automatiquement par Mentora.
5. Un solde plateforme EUR disponible est nécessaire pour transférer les rémunérations. Un montant minimal peut être imposé par Stripe selon compte/pays/devise. Ne jamais augmenter automatiquement le retrait ni créer de faux gains pour contourner ce minimum.

Le bouton « Actualiser mes gains et mes retraits » fonctionne aussi sans webhook Connect, par lecture authentifiée des statuts Stripe. Les webhooks permettent la mise à jour lorsque Mentora est fermé. Les événements sont filtrés par compte connecté enregistré et compte administrateur principal ; leur répétition relit l’objet Stripe sans créer de transfert ni de payout.

## Validation

`node --import tsx scripts/test-connect.ts` utilise une base SQLite temporaire et un client Stripe simulé : accès anonyme/membre, isolement, clés live, propriété du compte, prestations éligibles, concurrence, idempotence, fonds insuffisants, payout refusé, timeout après émission, reprise, règlements différés et événements étrangers/répétés. `scripts/test-payouts.ts` vérifie aussi le parcours historique, qui reste séparé. `pnpm build` vérifie TypeScript et les routes Next.js.

L’essai réel sandbox de bout en bout doit comprendre l’onboarding d’un compte connecté, une prestation de test terminée, le transfert à ce compte puis le payout. Le test historique de 200 € vers la banque fictive de la plateforme ne valide pas ce nouveau parcours Connect. Aucun passage live n’est autorisé par ce document.

Vérification en production privée le 12 novembre 2026 : UI chargée pour le propriétaire, endpoint anonyme refusé (403), largeur mobile de 390 px sans débordement horizontal. L’API Stripe du bac à sable a refusé la création d’un compte connecté car Connect n’est pas encore activé. Le guide d’activation du bac à sable a été ouvert dans Safari ; Stripe demande au titulaire d’examiner/confirmer les responsabilités relatives aux remboursements et contestations. Cette confirmation n’a pas été effectuée par l’assistant. L’essai Connect de bout en bout reste donc à terminer après activation et onboarding.

Suite le même jour : le propriétaire a confirmé les responsabilités puis expressément autorisé l’acceptation du Connect Platform Agreement pour ce test. La configuration a été validée dans `mentora-admin-test` ; l’interface Connect est désormais ouverte. La première création FR a permis de détecter l’exigence des deux capacités mentionnées ci-dessus.

Sources officielles consultées :
- https://docs.stripe.com/connect/migrate-to-controller-properties
- https://docs.stripe.com/connect/hosted-onboarding?accounts-namespace=v1
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/connect/manual-payouts
- https://docs.stripe.com/connect/webhooks?accounts-namespace=v1
