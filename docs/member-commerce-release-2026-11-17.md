# Ouverture des prestations aux membres

Décision explicite du propriétaire le 17 novembre 2026 : rendre les crédits et les prestations accessibles à tous les comptes membres, en paiements réels. Cette autorisation de publication ne constitue pas une validation juridique des textes existants, laissés inchangés à sa demande.

Activation serveur : MENTORA_MEMBER_COMMERCE_ENABLED=true et MENTORA_MEMBER_COMMERCE_AUTHORIZATION_REFERENCE (référence de la décision). Le flag commerce est stable après validation des scénarios. Les clés Stripe, webhook, version des conditions, taux de rémunération et chiffrement bancaire existants sont réutilisés. Aucun secret n'est exposé.

Les membres ne peuvent ouvrir que les quatre packs de lancement. Les prix Black Friday, définitifs, les anciennes offres et le pack privé 10 000 crédits / 1 € sont refusés par le serveur pour tout autre compte que le propriétaire. Les outils CRM, publication Discord, configuration Stripe et administration des retraits restent privés.

Les réservations séparent acheteur et parrain, figent prix et rémunération, réservent les crédits une seule fois et verrouillent les deux comptes dans un ordre stable. Accepter/terminer/refuser appartient au vendeur, confirmer la fin et annuler à l'acheteur. Une réponse négative reprend la prestation ; une confirmation ancienne ou répétée ne libère rien deux fois. Les messages sont limités aux participants et le rôle est calculé par le serveur.

Les essais du propriétaire sont autorisés y compris sur ses propres prestations en mode réel. Les nouvelles réservations de test administrateur sont identifiées, et les prestations où acheteur et vendeur sont identiques, y compris historiques, sont exclues des gains retirables. Le pack à prix réduit ne peut pas générer une créance de virement.

Les demandes de retrait sont manuelles, chiffrées, réservées et auditées. Aucun transfert bancaire ni appel Stripe Connect n'est exécuté automatiquement. Le propriétaire effectue le virement depuis sa banque avant de marquer la demande comme payée.

Validation : scripts/test-member-commerce.ts (base isolée, Stripe simulé en mémoire, sans réseau bancaire), tests Discord avec faux serveur local, compilation Next et vérifications visuelles après déploiement. Aucun paiement réel n'est exécuté par l'agent.
