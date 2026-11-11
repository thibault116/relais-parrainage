const documents = [
  {
    title: "Mentions légales",
    description: "Identifie qui édite et héberge Mentora.",
    checklist: [
      "Renseigne le nom ou la dénomination de l’éditeur, son statut, son adresse, son e-mail et son téléphone. Complète avec le capital, l’immatriculation et le numéro de TVA selon le statut.",
      "Identifie le directeur de la publication et ajoute la dénomination, l’adresse et le téléphone de l’hébergeur.",
      "Vérifie les mentions liées à ton activité et prépare une politique de confidentialité distincte.",
    ],
    draft: "Mentora est édité par [nom ou société], [statut et immatriculation], domicilié à [adresse]. Contact : [e-mail et téléphone]. Directeur de la publication : [nom]. Le site est hébergé par [dénomination, adresse et téléphone].",
    source: "https://entreprendre.service-public.gouv.fr/vosdroits/F37351",
    sourceLabel: "Mentions obligatoires · Service Public",
  },
  {
    title: "Conditions générales d’utilisation (CGU)",
    description: "Décris les règles de la plateforme et les engagements de chacun.",
    checklist: [
      "Explique qui peut créer un compte, les rôles des parrains et débutants, les limites du parrainage et les conditions de fermeture d’un compte.",
      "Décris les règles de publication, de messagerie et de communauté, le signalement de contenus, la modération et les voies de contestation applicables.",
      "Précise les droits sur les contenus, les usages interdits et le contact pour l’assistance. Renvoie vers la politique de confidentialité et sépare les règles d’utilisation des conditions d’achat.",
    ],
    draft: "Mentora met en relation des parrains et des débutants. Les membres s’engagent à [règles de conduite]. Un contenu peut être signalé via [canal]. Mentora traite les signalements selon [procédure et modalités de contestation].",
    source: "https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-enquetes-et-les-controles/les-obligations-dinformation-des-plateformes-numeriques",
    sourceLabel: "Information des utilisateurs de plateformes · DGCCRF",
  },
  {
    title: "Conditions générales de vente (CGV)",
    description: "Décris ce que le client achète, auprès de qui et à quelles conditions.",
    checklist: [
      "Détermine qui vend et facture chaque prestation, qui encaisse et qui traite les réclamations. Indique le statut professionnel ou non des parrains quand il affecte les droits du client.",
      "Décris les offres, les prix et taxes, la durée et le renouvellement des abonnements, leur résiliation en ligne, et les règles des crédits et des réservations.",
      "Précise la livraison ou l’exécution, les annulations, remboursements, garanties applicables, le droit de rétractation et son formulaire. Indique le médiateur de la consommation si applicable.",
    ],
    draft: "L’offre [nom] est vendue par [identité]. Le prix total est de [montant et taxes] pour [durée ou prestation]. Les crédits sont utilisables pour [usage et durée de validité]. Le client peut résilier ou demander une annulation selon [modalités]. Rétractation, garanties et réclamations : [règles applicables et coordonnées].",
    source: "https://entreprendre.service-public.gouv.fr/vosdroits/F33527",
    sourceLabel: "Conditions générales de vente · Service Public",
  },
];

export function AdminLegalGuide() {
  return (
    <section className="commerce-page">
      <header className="commerce-heading">
        <h1>Mentions légales, CGU et CGV</h1>
        <p>Guide privé de rédaction pour Mentora</p>
        <a className="btn secondary" href="/administration/demandes-juridiques">Consulter les demandes juridiques</a>
      </header>
      <p>Complète les éléments entre crochets avec tes informations et fais valider les textes avant leur publication. Pour les CGV, commence par déterminer qui vend les prestations et quel rôle Mentora joue dans la transaction.</p>
      {documents.map((document) => (
        <details className="commerce-card commerce-legal" key={document.title}>
          <summary>{document.title}</summary>
          <p>{document.description}</p>
          <ul>
            {document.checklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <h2>Trame à compléter</h2>
          <p>{document.draft}</p>
          <a href={document.source} target="_blank" rel="noreferrer">{document.sourceLabel}</a>
        </details>
      ))}
    </section>
  );
}
