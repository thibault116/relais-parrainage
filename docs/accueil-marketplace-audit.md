# Accueil marketplace — audit et vérifications (19 novembre 2026)

## État constaté dans le projet

Sources examinées : app/page.tsx, ProductStory, navigation mobile/ordinateur, lib/feature-release.ts, parcours de prestations dans lib/monetization/store.ts, commerceActor et les conditions d’activation dans lib/monetization/mode.ts, les API des guides, ainsi que les commits de novembre jusqu’à 379bb8f.

| Fonction | Disponibilité réelle / présentation retenue |
| --- | --- |
| Découverte des membres | Compte requis, profils et spécialités ; aucun profil privé réutilisé sur l’accueil. |
| Prestations et crédits | Feature commerce stable, accès membres soumis au mode live et à l’autorisation explicite de commercialisation. L’accueil reçoit seulement un booléen public dérivé de ces mêmes conditions ; les sections disparaissent si l’ouverture n’est pas confirmée. Aucun secret exposé. |
| Demande de prestation | Crédits réservés à la demande, rendus en cas de refus ; confirmation de fin par les deux membres avant disponibilité des gains. Aucun prix ou résultat inventé. |
| Communauté | Stable, conversations séparées par rôle. |
| Guides | Quatre guides stables, gratuits, connexion requise, lecture dans l’application ; aucun téléchargement proposé. |
| Messagerie privée | Feature privateMessaging encore bêta ; présentée explicitement comme bêta activable dans les paramètres, pas comme un accès universel. |
| Anciennes tâches et notes | Ne figurent plus dans le menu Général actuel ; aucune promesse de suivi avancé ou de tableau de progression sur la landing. Présentation limitée aux demandes et statuts réellement existants. |
| Vérification des parrains | Présentation publique suspendue dans le projet ; aucun badge de confiance ni certification annoncés. |
| Administration et essais privés | Tarifs de test, bonus admin et outils privés exclus de la présentation. |

## Informations anciennes corrigées

- Positionnement exclusivement centré sur un binôme remplacé par une marketplace de services, d’accompagnement et d’entraide.
- « Bêta gratuite pour le moment » remplacé par une distinction entre guides/communauté gratuits et prestations en crédits.
- « La suite se passe sur Discord » remplacé par la communauté intégrée et le rôle complémentaire de Discord.
- FAQ : suppression des anciennes affirmations sur les profils publics, les badges de vérification et une formation tierce.
- Anciennes captures de démonstration de ProductStory remplacées par des rendus publics fidèles à la navigation, au catalogue réel des guides et aux salons actuels. Aucun nom, solde, avis ni chiffre fictif.
- Le premier écran est présent dans le HTML initial, avant résolution de la session. Les annonces de version ne masquent plus l’accueil aux visiteurs déconnectés ; elles restent disponibles pour les membres.

## Périmètre technique

- Nouveaux composants publics factorisés : public-home.tsx et public-product-preview.tsx.
- ProductStory devient une présentation au clic, sans écouteur de défilement global.
- Feuille public-home.css isolée sous les classes de la landing ; elle ne cible pas l’espace membre.
- FAQ et page publique « Comment ça marche » actualisées pour éviter les contradictions.
- Parcours d’inscription existants conservés. Les liens vers un guide gardent son slug dans l’URL du parcours de connexion.
- Réglages d’apparence existants, animations réduites système et préférence locale respectés. Contenu visible si JavaScript/IntersectionObserver sont absents.
- Traductions anglaises ajoutées dans le catalogue existant ; métadonnées SEO et Open Graph actualisées.
- Aucune modification des paiements, prix, données, contrôles d’accès des guides ou règles de messagerie.

## Vérifications

Compilation Next et vérification TypeScript ; contrôle du rendu HTML initial et des deux réponses commerceAvailable (activation absente / activée). Les deux états ont été contrôlés sur des serveurs locaux uniquement. Aucun paiement déclenché, aucune variable de production modifiée.

Contrôles navigateur : ordinateur, téléphone et tablette ; variantes claire/anglaise et sombre/française ; navigation du hero, aperçu interactif, liens vers les guides et modal de connexion ; FAQ et liens légaux. Résultat : aucune erreur JavaScript/hydratation relevée ; aucun débordement à 320, 390, 768 et 1 440 pixels ; les sept pages légales répondent 200 ; les API guides et profil renvoient 401 sans connexion, et l’API admin 403. Le parcours parrain présélectionne bien ce rôle ; les destinations des guides et prestations sont conservées dans l’URL de connexion. Les captures ordinateur/mobile sont enregistrées dans outputs/mentora-landing-review (à côté du dépôt). Les animations réduites et le contenu sans observer sont également prévus dans les styles et le composant.

## Limites de la livraison

La refonte est préparée et testée localement. Elle n’est pas publiée sur Vercel dans cette intervention. L’état commerce de la production sera relu automatiquement par la page après publication, sans supposer que les conditions d’ouverture sont actives. Aucune opération supplémentaire n’a été effectuée sur Discord après la demande d’arrêt.

## Fichiers de la refonte

- `app/page.tsx` : intégration des composants publics, destinations vers les membres et retrait du contenu historique.
- `app/components/public-home.tsx` : sections de l’accueil, FAQ partagée, présentation « Comment ça marche ».
- `app/components/public-product-preview.tsx` : aperçus d’interfaces sans données privées.
- `app/components/product-story.tsx` : présentation interactive des fonctionnalités.
- `app/public-home.css` : design public, responsive, apparitions et réduction des animations.
- `app/layout.tsx` : import de styles publics, titre, description et Open Graph.
- `app/api/settings/route.ts` : indicateur public booléen d’ouverture des prestations, sans nouvelle autorisation métier.
- `app/components/release-notes.tsx` : annonce de version réservée aux membres connectés afin de laisser l’accueil immédiatement visible aux visiteurs.
- `lib/en.json` : traductions des nouveaux contenus.
- `lib/member-release.ts` : notes de version préparées pour la future publication.
- `docs/accueil-marketplace-audit.md` : audit, périmètre et résultats de vérification.
