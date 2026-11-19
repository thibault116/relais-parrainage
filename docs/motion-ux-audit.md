# Mentora — mouvement et expérience, 19 novembre 2026

## Périmètre

Travail local, non déployé. Prolonge la refonte d’accueil non publiée décrite dans `accueil-marketplace-audit.md`.

Référence consultée : https://grail-app.com. Principes retenus : titre ample, profondeur de plans, interface persistante transformée au scroll, rythme par chapitres. Aucun élément graphique de Grail copié. Défilement natif, sans capture de la molette ni WebGL.

## Changements

- Public : arrivée du titre et du logo, profondeur de l’aperçu, quatre chapitres synchronisés au scroll (selon disponibilité du commerce), navigation directe entre chapitres. Sur mobile, une scène plus courte réserve de la place au titre et au texte.
- Guides : « Guides gratuits », « GUIDE GRATUIT » et badge « 100 % gratuit » dans les aperçus, section et catalogue. Rémunération des parrains explicitée dans le parcours correspondant.
- La mention sur les crédits, les guides distincts et l’absence de résultat garanti est le dernier élément du pied de page public.
- Espace membre : arrivées des cartes visibles, réactions tactiles et survols, ouverture des dialogues, transitions des écrans, indicateur actif mobile et latéral. Tous les écrans conservés.
- Messages privés, communautaires et de prestations : arrivée discrète des messages ajoutés après l’historique initial. Pas de transformation du conteneur de discussion ni du champ. Le chargement d’historique et les modifications n’animent pas de nouveau tous les messages.
- Correction du parcours invité vers Découvrir/Prestations : reprise de la destination après connexion au lieu d’un espace vide sur PC.

## Architecture et performances

`lib/motion.ts` : durées 120/220/320/700 ms, easing commun, calcul des scènes et détection des messages ajoutés. Un seul ordonnanceur rAF et un seul écouteur passif de scroll pour les scènes actives, toutes les lectures de géométrie avant les écritures.

`MotionProvider` : préférences système + réglage Mentora, détection pointer coarse/économie de données/matériel modeste. IntersectionObserver pour n’animer que les cartes visibles, WeakSet pour ne pas rejouer les cartes existantes. MutationObserver limité aux nouveaux nœuds et attribut `open`. Observateurs, animations et rAF nettoyés au démontage.

Les interactions métier ne dépendent jamais de la fin d’une animation. Les vues ne sont pas remontées avec une nouvelle clé. Pas de nouvelle dépendance npm.

Principaux fichiers : `app/components/motion-system.tsx`, `scroll-scene.ts`, `product-story.tsx`, `public-home.tsx`, `public-product-preview.tsx`, `workspace-nav.tsx`, `mobile-experience.tsx`, `community.tsx`, `service-conversations.tsx`, `member-guides.tsx`, `app/motion.css`, `app/layout.tsx`, `app/page.tsx`, `lib/motion.ts`, `lib/en.json`.

## Vérifications réalisées

- Compilation Next.js de production et TypeScript : passent. Le premier build a signalé une alerte de sécurité Next.js ; le deuxième termine. Cette alerte demande une investigation/mise à niveau séparée avant déploiement, pas une garantie d’absence de vulnérabilité.
- `scripts/test-motion.ts` : passe. Bornes et transformations des scènes, historique initial/préfixé/modifié inchangé, ajouts seuls, un écouteur de scroll/resize, lectures groupées, nettoyage complet.
- `scripts/test-member-guides.ts` : passe sur base et archive de test isolées. Quatre guides/images, lecture authentifiée pour les rôles, refus invités/téléchargements, liens partageables, slug invalide.
- Navigateur local : 320×740, 390×844, 768×1024, 1440×1000 sans débordement horizontal. Thèmes sombre et clair.
- Défilement réel et sélection des chapitres : transformations/rotation/profondeur observées ; titre mobile vérifié sous la scène après correction.
- Réglage « Réduire les animations » : active bien l’attribut global ; version à rubriques manuelles, un seul texte de chapitre visible. Réglage remis dans son état initial après essai.
- Comptes QA uniquement dans SQLite local : connexion normale, navigation, cartes et ouverture de profil, guides, paramètres, messages et notifications. Envoi privé et communautaire confirmé dans l’interface ; champ toujours utilisable. Aucun message réel envoyé à un membre.
- Prestations locales : catalogue, fiche sans image vide, formulaire facultatif et saisie, version mobile. Aucune réservation ni transaction.
- Parcours invité → connexion → catalogue Prestations confirmé sur le build final.
- Note de version : nouveau titre visible, acquittement conservé après rechargement. Aucun dialogue sur l’accueil non connecté.
- Console du navigateur : aucune erreur ou alerte relevée dans la session finale.
- `git diff --check` : passe.

## Limites et mise à disposition

Les tests de téléphone utilisent un viewport de navigateur, pas un clavier iOS/Android physique. Un essai sur appareil réel reste utile pour confirmer les particularités du clavier et la fluidité matérielle. Aucun benchmark FPS ou audit Lighthouse chiffré n’est revendiqué.

Les règles financières, les permissions et les services externes n’ont pas été changés. Paiements, remboursements, notifications push et déploiement de production n’ont pas été exécutés. Les comptes, prestations et messages temporaires de cette session sont supprimés en fin de vérification. Le serveur de prévisualisation reste local.

## Préparation de publication demandée le 19 novembre

L’alerte relevée sur Next.js 16.4.2 a été traitée par la mise à jour corrective vers 16.4.5. La dépendance transitive Zod 4.1.11 est remplacée par 4.6.7 via une surcharge pnpm ciblée. L’audit du registre après installation relève zéro vulnérabilité. Les tests motion et guides et la compilation de production ont été relancés avec ces correctifs et passent. Aucune bibliothèque d’animation ajoutée.

La publication est autorisée par le propriétaire dans la conversation. Cible vérifiée par Vercel CLI : équipe `thibault116s-projects`, projet `relais-parrainage`, branche de production `main`, Node.js 24.x. Aucune variable d’environnement ni règle commerciale modifiée.
