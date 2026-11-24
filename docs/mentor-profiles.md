# Profils Parrains et informations complémentaires

Publication publique demandée explicitement le 24 novembre 2026. `mentorActivity` est stable ; les API conservent les contrôles de session, rôle Parrain, blocage et origine. Aucun statut de vérification n'est accordé ou supprimé par cette fonctionnalité.

## Données et compatibilité

Migration additive dans `migrateOnboarding` : table `mentor_activities(user_id, answers, updated_at)`. Les deux scripts de migration existants l'appellent. Les réponses sont des tableaux d'identifiants et des textes « Autre » séparés, validés côté serveur. Aucune donnée ancienne n'est supprimée ni aucun questionnaire rendu obligatoire aux membres existants.

Le questionnaire initial Parrain comporte sept questions. Les méthodes historiques restent conservées dans les réponses et les recherches. Les méthodes compatibles préremplissent le complément lors de sa première ouverture. Les nouvelles catégories et spécialités ne sont pas déduites automatiquement d'anciennes étiquettes.

La biographie existante est réutilisée : le texte du portfolio est lu lorsqu'il existe, avec repli sur le champ du profil. Les nouvelles écritures synchronisent les deux emplacements historiques dans une transaction. Une présentation vide est autorisée pour un Parrain et masque la section. Les contraintes Débutant restent inchangées. Les images publiques du parcours restent disponibles dans la carte d'activité ; les preuves privées et la vérification interne restent inchangées.

Les données complémentaires sont publiques sur un profil visible. Les budgets et objectifs financiers restent privés. Les mises à jour ne prennent jamais un identifiant de propriétaire fourni par le client. Décocher la seconde main supprime les spécialisations devenues incompatibles côté client et serveur. Les sélections peuvent être vidées ; les textes « Autre » non sélectionnés ne sont pas conservés.

## Interface et fonctionnalités conservées

Bannière violette, avatar superposé, dates réelles disponibles, expérience, places, partage. Présentation dépliable, compétences initiales, carte d'activité avec méthodes repliées, prestations et actions selon leurs permissions existantes. Le bouton de modification est réservé au propriétaire. Les prix restent en crédits. Aucun badge de vérification sur cette fiche.

Le complément est accessible depuis Modifier mon profil et ne bloque aucun autre parcours. Il reste prérempli et modifiable. L'édition des autres préférences est simplement masquée pendant l'ouverture du complément pour présenter une seule question à la fois.

## Validation

- `scripts/test-intake.ts` : deux parcours Débutant, sept questions Parrain, éligibilité, conservation des méthodes/proofs historiques, compétences inchangées, conditions et champs Autre, persistance, modifications et effacement, rôle/propriétaire/blocage/CSRF, API publiques et confidentialité financière.
- `scripts/test-manual-bank.ts` et `scripts/test-ambassadors.ts` : crédits, commissions et retraits existants.
- TypeScript et build Next.js ; aucun script lint n'est configuré dans le projet.
- Parcours navigateur sur base locale isolée : biographie Lire la suite/Voir moins, méthodes repliées, questionnaire prérempli, retour, spécialisation conditionnelle effacée, modification/enregistrement/rechargement, profil propriétaire et profil consulté par un autre membre, mobile et ordinateur.

Pour conserver un jeu local de démonstration, `MENTORA_KEEP_UI_FIXTURE=1 node --import tsx scripts/test-intake.ts` affiche son répertoire temporaire. Aucun compte, message, paiement ou prestation de test n'est créé en production.
