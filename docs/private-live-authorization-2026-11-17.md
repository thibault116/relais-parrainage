# Activation des encaissements réels privés

Le 17 novembre 2026, le propriétaire a explicitement demandé d'activer les vrais paiements sur son seul compte, en conservant les CGV/CGU existantes et en indiquant qu'il s'occuperait personnellement de ces documents.

Cette autorisation d'exploitation privée est distincte d'une validation juridique. Aucun drapeau COMMERCIAL_VALIDATED n'est créé, aucune référence de revue juridique n'est inventée et aucun document légal n'est modifié. L'autorisation est enregistrée dans MENTORA_PRIVATE_ADMIN_LIVE_ENABLED et MENTORA_PRIVATE_ADMIN_LIVE_AUTHORIZATION_REFERENCE. La version identifie le texte actuellement en place, sans le présenter comme relu ou approuvé.

Toutes les pages et API financières restent réservées à isCrmOwner. Checkout refait ce contrôle avant toute requête Stripe réelle. Les webhooks continuent à vérifier signature, mode, propriétaire et montant avec déduplication. Le compte Stripe doit autoriser les encaissements et son webhook réel actif doit couvrir paiements et remboursements. Une configuration incomplète refuse le paiement, sans retour implicite au mode test.

Le passage à live conserve la comptabilité fictive dans money_* et utilise uniquement money_live_* pour les achats réels. Aucun crédit, gain, IBAN, client Stripe ou retrait de test n'est recopié. Les versements manuels réels gardent leur contrôle d'activation séparé ; aucun virement n'est déclenché.

Vérification : droits principal seul, signatures et séparation test/réel, refus d'une configuration incomplète, puis diagnostic en lecture seule auprès de Stripe et contrôle de l'affichage privé. Aucun paiement réel ni acceptation des conditions n'est exécuté par l'agent.
