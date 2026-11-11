import { legalContact, termsVersion, testSalesVersion } from "@/lib/legal-versions";

export const contact = <a href={`mailto:${legalContact}`}>{legalContact}</a>;
export const documents: Record<string, React.ReactNode> = {
  "mentions-legales": <>
    <p>Mentora est un service d’entraide entre revendeurs. Son adresse publique est <a href="https://mentora-resell.vercel.app/">mentora-resell.vercel.app</a>.</p>
    <h2>Éditeur et publication</h2>
    <p>Contact Mentora : {contact}.</p>
    <p className="legal-note">Restent à renseigner après vérification : identité et statut de l’éditeur, adresse et téléphone, responsable de publication et, selon le statut, immatriculation, capital et numéro de TVA. Ces mentions sont incomplètes.</p>
    <h2>Hébergement</h2>
    <p>Hébergement de l’application : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis. <a href="https://vercel.com/legal/dpa">Identification publiée par Vercel</a>. Le téléphone à mentionner pour le service d’hébergement reste à confirmer.</p>
    <h2>Réclamations et médiation</h2>
    <p>Les réclamations peuvent être adressées à {contact}. Les coordonnées du médiateur de la consommation restent à compléter après désignation avant l’ouverture des ventes aux consommateurs.</p>
    <p><a href="https://entreprendre.service-public.gouv.fr/vosdroits/F37351">Mentions obligatoires · Service Public</a></p>
  </>,
  cgu: <>
    <p>Version {termsVersion}. Ces conditions encadrent l’utilisation de Mentora. Consulte les <a href="/juridique/mentions-legales">mentions légales</a> et la <a href="/juridique/confidentialite">politique de confidentialité</a> pour identifier le service et comprendre le traitement des données.</p>
    <h2>Objet et accès</h2>
    <p>Mentora permet aux membres de créer un profil, trouver un binôme, échanger des conseils et suivre un accompagnement autour de l’achat-revente. Les fonctionnalités signalées comme bêta, dont la messagerie privée, peuvent évoluer. Mentora ne garantit ni ventes, ni revenus, ni résultat commercial.</p>
    <h2>Compte et profil</h2>
    <p>Protège tes identifiants et fournis des informations exactes. Les éléments d’un profil visible peuvent être consultés publiquement, notamment depuis sa fiche. Les coordonnées privées ne doivent pas être publiées dans le profil ou la communauté. Tu peux masquer ton profil ou retirer les contenus que l’interface te permet de gérer.</p>
    <h2>Contributions et échanges</h2>
    <p>Publie seulement des contenus que tu as le droit de partager. En publiant, tu autorises leur hébergement et leur affichage aux destinataires prévus par la fonctionnalité. Tu conserves tes droits sur tes contenus. Les échanges sur Discord ou des places de marché suivent leurs propres conditions.</p>
    <h2>Modération</h2>
    <p>Les <a href="/juridique/communaute">règles de la communauté</a> détaillent les comportements attendus et les voies de signalement. Un contenu peut être retiré ou un accès restreint pour faire cesser une violation, protéger les membres ou respecter une obligation légale. Une décision de modération peut être contestée auprès de {contact} en indiquant sa référence ou les éléments permettant de l’identifier.</p>
    <h2>Fermeture et évolution du service</h2>
    <p>Tu peux demander la fermeture de ton compte via {contact}. L’exercice de tes droits sur les données et le traitement d’une éventuelle demande liée à un achat sont distincts de la fermeture du compte. Pour une modification substantielle des conditions, la nouvelle version doit être portée à la connaissance des membres concernés.</p>
  </>,
  cgv: <>
    <p className="legal-note">Projet à compléter avant commercialisation. Les paiements Mentora sont exclusivement des essais Stripe réservés au compte administrateur. Le public ne peut acheter ni abonnement, ni crédits, ni prestation.</p>
    <h2>Parcours actuellement testés</h2>
    <p>Le plan Free est le plan par défaut. Starter, Plus et Pro sont testés au mois ou à l’année, avec un prix en euros affiché avant Stripe Checkout. L’abonnement se renouvelle selon la période choisie tant qu’il n’est pas résilié. Le portefeuille est crédité après confirmation du paiement. Les crédits annuels sont versés en une fois. Les packs de 5, 10, 20 et 40 crédits et les quantités personnalisées sont des achats ponctuels. Les justificatifs disponibles figurent dans l’historique de facturation ou le portail Stripe.</p>
    <h2>Usage des crédits et des prestations</h2>
    <p>Dans le test, les crédits servent à réserver une prestation. Ils sont personnels, non transférables entre membres et non convertibles en argent par l’acheteur. La durée de validité, le sort des crédits non utilisés après résiliation, les conditions commerciales d’annulation et la répartition des responsabilités entre Mentora et les parrains restent à définir. Les règles de test ne fixent pas les droits des futurs clients.</p>
    <h2>Résiliation, rétractation et remboursement</h2>
    <p>La résiliation arrête les renouvellements futurs. Le parcours de test programme la fin de l’abonnement en fin de période. La rétractation est un droit distinct dont les délais, modalités et exceptions dépendent du contrat. Consulte la <a href="/juridique/contrats">page dédiée et le formulaire type</a>. Aucun délai commercial supplémentaire ni règle de remboursement volontaire n’a été fixé.</p>
    <h2>Informations à compléter</h2>
    <p>Identité du vendeur et rôle contractuel de Mentora, prix TTC et fiscalité, modalités exactes d’exécution et de facturation, règles du portefeuille, garanties applicables, traitement des réclamations et coordonnées du médiateur. La confirmation contractuelle devra être remise sur un support durable avant l’ouverture des achats réels.</p>
    <p><a href="https://entreprendre.service-public.gouv.fr/vosdroits/F33527">Conditions générales de vente · Service Public</a></p>
  </>,
  "conditions-test": <>
    <p>Version {testSalesVersion}. Les actions de paiement Mentora sont réservées à l’administrateur et exécutées dans le bac à sable Stripe. Elles servent à tester les offres, la facturation, le portefeuille et les réservations, sans encaissement ni versement réel.</p>
    <p>Avant de poursuivre, vérifie la formule, la période ou la quantité, ainsi que le montant simulé. En acceptant ces conditions de test, tu autorises la création d’une session Stripe de test et l’enregistrement de la version acceptée avec la commande. Les crédits de test ne sont ni transférables ni convertibles en argent.</p>
    <p><a href="/juridique/cgv">Projet de CGV pour la commercialisation</a> · <a href="/juridique/confidentialite">Confidentialité</a></p>
  </>,
  confidentialite: <>
    <p>Cette notice décrit les traitements identifiés sur Mentora. L’identité juridique et l’adresse du responsable du traitement restent à compléter. Pour toute question ou demande, contacte {contact}.</p>
    <h2>Données, finalités et fondements</h2>
    <dl>
      <dt>Compte et accompagnement · exécution du service demandé</dt>
      <dd>Nom ou pseudonyme, e-mail, identifiant, mot de passe sous forme de condensat, sessions, réponses de profil et d’accompagnement, abonnements à des profils, tâches et notes. Les champs requis servent à créer le compte ou utiliser la fonctionnalité. Les informations facultatives peuvent être omises quand l’interface le prévoit.</dd>
      <dt>Annuaire, communauté et messagerie · exécution du service demandé</dt>
      <dd>Profil et photo, biographie, données d’activité ou d’expérience, et éléments du portfolio si tu les ajoutes. Nous traitons aussi les messages et pièces jointes selon les fonctionnalités utilisées. Les profils visibles et leurs médias peuvent être consultés sans compte selon les règles de visibilité de l’annuaire. Le pseudo Discord est transmis au binôme autorisé. Les messages de communauté sont accessibles aux participants autorisés du salon. Les messages privés sont destinés aux participants autorisés de la conversation.</dd>
      <dt>Sécurité et modération · intérêt légitime à protéger le service et les membres, ou obligation légale selon la demande</dt>
      <dd>Journaux techniques, activité du compte, restrictions d’accès, signalements et décisions. Les justificatifs adressés pour examen sont accessibles aux personnes habilitées. Les preuves déposées dans un portfolio visible relèvent, elles, de la publication du profil.</dd>
      <dt>Notifications · exécution du service pour les messages de compte, consentement pour les notifications push</dt>
      <dd>Adresse e-mail, préférences, identifiants techniques d’abonnement push et, selon l’événement, aperçu du contenu. Modifie tes préférences dans Paramètres. Tu peux retirer ton consentement au push en désactivant les notifications ou en révoquant l’autorisation dans ton navigateur.</dd>
      <dt>Demandes juridiques · traitement de la demande et obligations légales applicables</dt>
      <dd>Identité et coordonnées fournies, contrat ou emplacement du contenu, déclaration, horodatage et suites données. Une adresse e-mail est nécessaire pour envoyer l’accusé et la réponse par ce canal. Certains signalements de protection des mineurs peuvent être déposés sans communiquer ces informations.</dd>
      <dt>Facturation · environnement administrateur de test</dt>
      <dd>Références Stripe, offres, montants, factures, commandes et mouvements de crédits. Les données de carte sont saisies chez Stripe. Mentora reçoit des références et, pour la gestion du moyen de paiement, des informations masquées. Les traitements commerciaux et leurs bases légales devront être confirmés avant toute vente réelle.</dd>
    </dl>
    <h2>Destinataires et prestataires</h2>
    <p>Selon leur rôle, les autres membres, la modération et l’administration accèdent aux données nécessaires. L’application et les fichiers utilisent Vercel et Vercel Blob. La base de production Neon est documentée à Francfort. Gmail assure l’envoi d’e-mails. Les notifications push passent par le service de ton navigateur. Stripe intervient pour les essais de paiement. Google Fonts fournit les polices et reçoit les informations techniques liées au téléchargement. Discord reçoit les données que tu lui transmets lorsque tu ouvres son service.</p>
    <p>La région de la base ne couvre pas tous les traitements. Les entités contractantes, les transferts éventuels hors EEE, les garanties applicables et les modalités d’obtention de leur copie restent à documenter dans le registre et à préciser ici.</p>
    <h2>Conservation</h2>
    <p>Le compte, les profils et les contributions sont conservés pour fournir le service tant qu’ils restent nécessaires à cet usage. Une fermeture de compte entraîne la suppression des données liées couvertes par la procédure, sous réserve des éléments nécessaires à la sécurité, au traitement d’un litige ou à une obligation légale. Les durées par catégorie, les délais de purge des sauvegardes et l’archivage des signalements et déclarations doivent encore être validés et appliqués.</p>
    <h2>Tes droits</h2>
    <p>Selon les conditions prévues par le RGPD, tu peux demander l’accès, la rectification, l’effacement, la limitation et la portabilité, t’opposer à un traitement ou retirer ton consentement. Écris à {contact}. Tu peux aussi <a href="https://www.cnil.fr/fr/adresser-une-plainte">adresser une plainte à la CNIL</a>. Les éléments d’identité ne seront demandés qu’en cas de doute raisonnable.</p>
    <p><a href="https://www.cnil.fr/fr/informer-les-personnes">Information des personnes · CNIL</a></p>
  </>,
  cookies: <>
    <p>Le code du site ne charge pas de traceurs publicitaires ni d’outil de mesure d’audience. Les traceurs de Mentora servent au fonctionnement de la session et aux réglages de l’interface.</p>
    <dl>
      <dt>Session de connexion</dt>
      <dd>Le cookie de session Better Auth maintient la connexion et sécurise l’accès à l’espace membre. Il est lié à la durée de la session. Tu peux te déconnecter ou le supprimer dans ton navigateur.</dd>
      <dt>Préférences stockées dans le navigateur</dt>
      <dd>La mémorisation de la langue et de l’apparence est facultative. Tu peux choisir chacune et retirer ton autorisation via « Gérer mes cookies ». Le choix est conservé pendant 180 jours. Les marqueurs techniques pour les rappels d’installation, les annonces lues, la position d’un bouton déplacé et l’association des notifications sont propres à cet appareil.</dd>
      <dt>Fonctionnement hors ligne</dt>
      <dd>Le service worker conserve une page de secours et une icône pour le mode hors ligne. Il ne met pas les réponses privées en cache.</dd>
      <dt>Services externes</dt>
      <dd>Les polices sont chargées depuis Google Fonts. Stripe Checkout et Discord s’ouvrent sur leurs propres sites et disposent de leurs propres politiques.</dd>
    </dl>
    <p>Tu peux effacer les données du site via les réglages de ton navigateur. Mentora te propose un choix pour la mémorisation facultative de l’apparence et de la langue. Les réglages d’hébergement et les services tiers doivent être contrôlés avant d’ajouter une mesure d’audience ou une intégration.</p>
    <p><a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi">Cookies et traceurs · CNIL</a></p>
  </>,
  contrats: <>
    <p>Mentora n’ouvre pas de vente au public à ce stade. Ces parcours enregistrent une déclaration et fournissent un accusé de réception. L’équipe vérifie ensuite le contrat concerné et communique les suites.</p>
    <h2>Rétractation</h2>
    <p>En principe, pour un contrat de prestation de services à distance conclu par un consommateur, le délai est de quatorze jours à compter de la conclusion du contrat. Le consommateur n’a pas à se justifier. Les exceptions et conséquences d’un début d’exécution à la demande expresse du consommateur dépendent de la qualification du contrat et des conditions prévues par la loi.</p>
    <p><a href="/juridique/retractation">Formulaire de rétractation</a></p>
    <h3>Modèle de déclaration</h3>
    <p>À adresser à Mentora via le formulaire ou à {contact}. « Je vous informe que je souhaite me rétracter du contrat suivant : [offre ou prestation et référence], conclu le [date]. Nom et prénom : [nom]. Adresse : [adresse]. Date : [date]. Signature si la déclaration est transmise sur papier. »</p>
    <h2>Résiliation</h2>
    <p>La résiliation met fin au contrat pour l’avenir selon ses conditions et les droits applicables. La confirmation de traitement précise la date de fin et les effets. Les abonnements Stripe test se gèrent également dans l’espace Abonnement de l’administrateur.</p>
    <p><a href="/juridique/resilier">Formulaire de résiliation</a></p>
    <h2>Remboursements</h2>
    <p>En cas de rétractation ouvrant droit à remboursement, les sommes dues sont en principe remboursées sans retard injustifié et au plus tard quatorze jours après information du professionnel, par le moyen de paiement initial sauf accord exprès dans les conditions légales. Le sort des crédits utilisés, les annulations et les remboursements commerciaux restent à définir et à faire valider avant l’ouverture des ventes.</p>
    <p><a href="https://www.legifrance.gouv.fr/codes/id/LEGIARTI000053303365/">Modalités de rétractation en ligne</a> · <a href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226828">Délais et modalités de remboursement</a> · <a href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032807216/">Résiliation en ligne</a> · <a href="https://entreprendre.service-public.gouv.fr/vosdroits/F23455">Commerce en ligne · Service Public</a></p>
  </>,
  communaute: <>
    <p>Mentora est un espace d’entraide autour de l’achat-revente. Discute avec respect et décris tes expériences avec sincérité.</p>
    <h2>Règles de participation</h2>
    <ul>
      <li>Pas de harcèlement, menace, discrimination, injure, divulgation de données privées ni usurpation d’identité.</li>
      <li>Pas d’escroquerie, de contrefaçon, d’incitation à une activité illicite, de messages indésirables répétés ou de promesses trompeuses de revenus.</li>
      <li>Respecte les droits sur les images et textes. Masque les coordonnées, informations bancaires et identifiants de tiers sur les captures.</li>
    </ul>
    <h2>Signaler un contenu ou une interaction</h2>
    <p>Tu peux utiliser les commandes de signalement disponibles sur les profils ou dans la messagerie. Si tu estimes qu’un contenu est illicite, utilise le formulaire public avec un lien exact ou les informations permettant de le localiser et une explication précise. Évite de joindre ou recopier un contenu illicite.</p>
    <p><a className="btn" href="/juridique/signaler">Signaler un contenu illicite</a></p>
    <h2>Traitement et contestation</h2>
    <p>La modération examine les éléments transmis. Une décision peut conduire au maintien ou au retrait du contenu ou à une restriction d’accès. Pour demander le réexamen d’une décision, contacte {contact} avec sa référence, tes motifs et les éléments utiles. La procédure détaillée et les voies de recours applicables selon le statut DSA de Mentora restent à confirmer.</p>
    <p><a href="https://www.arcom.fr/espace-professionnel/reglement-sur-les-services-numeriques-ou-dsa-obligations-et-services-concernes">Obligations DSA · Arcom</a></p>
  </>,
};
