# Administration : pack privé et messagerie mobile

Portée : compte principal uniquement. Aucun changement de member-release ni annonce Discord. Le pack administrateur est un achat réel de 1,00 € pour 10 000 crédits ; il utilise les mêmes commandes, signatures de webhook, contrôle de montant, journal de crédits et remboursements proportionnels que les autres recharges. Les essais automatiques utilisent une base locale isolée et n'effectuent aucun encaissement.

Lien privé : /?mobile=credits&creditOffer=credits-admin-v1-10000-eur1#profile. Chaque achat utilise une nouvelle clé d'idempotence ; un même événement ne peut pas créditer deux fois. Les autres membres et modérateurs restent refusés côté serveur. L'offre n'est pas ajoutée au catalogue public des packs.

Le nouveau Checkout utilise branding_settings.display_name="Mentora". Ce réglage concerne le titre des nouvelles pages Stripe ; il ne remplace pas l'identité légale du marchand figurant sur les documents Stripe. Les anciennes sessions ouvertes ne sont pas modifiées.

Menu principal privé : catégorie Général, sans Accompagnements en cours, Objectifs, ni Notes partagées ; Crédits et Gérer mon profil y figurent. Les autres membres conservent leur navigation. La mention 100 % gratuit est retirée de la bannière de l'aperçu propriétaire. Les prestations n'affichent plus de coût indicatif en euros pour l'acheteur ; la rémunération prévue du créateur reste disponible.

La messagerie utilise une hauteur de viewport unique dans l'aperçu propriétaire sur téléphone. Les anciens calculs de hauteur sont conservés pour les autres membres, désactivés pour cet aperçu. Les fils défilent séparément des zones de saisie. Le clavier réduit l'espace réservé au fil, les textarea restent limités à 40–88 px et les menus/bannières sont masqués pendant la saisie. Aucun déplacement de la page n'est imposé à chaque frappe. Les écouteurs et styles temporaires sont nettoyés à la sortie du chat.

Vérifications : compilation Next.js ; tests isolés des prix, achats répétés, doublons, remboursements partiels/totaux, débits de réservation, accès refusés, menus propriétaire/membre. Contrôle visuel de la saisie avec viewport mobile normal et réduit. Aucun message réel ni paiement réel envoyé par l'agent.
