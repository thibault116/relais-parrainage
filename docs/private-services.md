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

Avant activation, il reste à raccorder un compte Stripe réel activé et son webhook signé réel ; isoler les comptes/écritures/historiques test et réel ; remplacer l’acceptation des conditions de test par les conditions commerciales validées ; confirmer le taux de rémunération réel (1,50 € par crédit n’est qu’une hypothèse de test, économiquement déficitaire pour certaines offres) et les informations légales manquantes. Ne jamais recopier les soldes de test en solde réel. Ne jamais fournir de clé secrète dans le chat. Les clés réelles seront enregistrées directement dans Vercel.

Les trois variables des virements manuels réels restent non activées. Aucun paiement ni virement réel n’a été lancé pour tester ces écrans.

## Vérifications

`scripts/test-private-services.ts` : isolation anonyme/membre/autre modérateur, origine et champs stricts, images privées, visibilité, besoin vide, double requête, crédit réservé une fois, refus motivé et remboursement unique, acceptation et réalisation, conservation du motif.
`scripts/test-manual-bank.ts` : filtres, accès, chiffrement, consultation auditée, transitions, restitutions, concurrence et notifications.
