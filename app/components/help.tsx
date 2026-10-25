import {
  UserPlus,
  Search,
  MessageCircle,
  ShieldCheck,
  Star,
  EyeOff,
} from "lucide-react";
const chapters = [
  [
    "reseau",
    "Suivre des revendeurs",
    "Ouvre la fiche d’un membre et clique sur S’abonner au profil. Tu peux suivre un parrain ou un débutant, sans créer de demande de parrainage. Cet abonnement est gratuit.",
    "Dans Mon profil, les onglets Mes abonnements et Mes abonnés réunissent ton réseau. Les profils sont classés par date de mise à jour : ouvre leur fiche pour consulter les informations récentes. Les compteurs apparaissent sur les cartes. Se désabonner retire le suivi ; un profil masqué reste confidentiel. Ce suivi n’envoie pas de notifications et ne donne pas accès aux ventes ni aux échanges Discord.",
  ],
  [
    "compte",
    "Créer mon compte et mon profil",
    "Clique sur Rejoindre ou Créer un compte, puis choisis Débutant si tu cherches de l’aide, ou Parrain si tu souhaites transmettre ton expérience. Renseigne ton adresse e-mail et ton mot de passe, puis complète le questionnaire. Si tu as déjà un compte, utilise Se connecter : tu n’as pas besoin de te réinscrire.",
    "Ton pseudo Discord doit être ton nom d’utilisateur exact, sans @. Ton e-mail reste privé. Le profil parrain demande au moins six mois de pratique. Décris tes objectifs, tes spécialités, tes disponibilités et le rythme souhaité.",
  ],
  [
    "photo",
    "Personnaliser ma présentation",
    "Dans Mon profil, utilise Ajouter une photo ou Changer ma photo. Choisis une image JPEG, PNG ou WebP dans les fichiers ou la photothèque de ton appareil. Elle est recadrée au centre : place ton visage ou ton logo au milieu.",
    "Tu peux retirer la photo à tout moment et retrouver tes initiales. Modifier mon profil permet de changer ta présentation, tes objectifs et tes disponibilités. Pense à enregistrer tes modifications.",
  ],
  [
    "annuaire",
    "Trouver le bon binôme",
    "Ouvre Trouver mon binôme, puis Les parrains ou Les débutants. Recherche un prénom, une marque ou un mot-clé et utilise les filtres de spécialité et de disponibilité. Les cartes affichent la présentation, les spécialités et les informations utiles.",
    "Clique sur Découvrir le profil pour lire la fiche complète. Fais défiler la fiche vers le bas pour tout voir. Les flèches à gauche et à droite passent au profil précédent ou suivant dans les résultats de ta recherche. La croix ou la touche Échap ferme la fiche.",
  ],
  [
    "verification",
    "Comprendre les profils vérifiés",
    "Parrain vérifié signifie que l’administration a examiné un dossier et des justificatifs. Non vérifié signifie que l’expérience est uniquement déclarée par le membre. Un badge ne garantit ni les revenus futurs, ni la qualité de chaque conseil, ni l’authenticité d’un article.",
    "Pour demander la vérification, ouvre Mon profil puis Vérifier mon profil parrain. Indique ton ancienneté, tes plateformes, ta tranche de ventes, tes domaines d’aide et ta motivation. Ajoute tes justificatifs par lien ou fichier. Deux types de preuves différents sont conseillés si possible.",
  ],
  [
    "preuves",
    "Envoyer et suivre mes justificatifs",
    "Les images et PDF sont limités à 4 Mo par fichier, avec 12 fichiers maximum. Masque les coordonnées des acheteurs avant de les importer. Les dossiers et fichiers ne sont pas publiés dans l’annuaire : seuls leur propriétaire et l’administration autorisée peuvent les consulter.",
    "Après l’envoi, ton dossier est en attente d’examen. Consulte le retour de l’administration dans Mon profil et complète le dossier si nécessaire. Un nouveau dépôt retire le badge précédent jusqu’au nouvel examen. Retirer le dossier supprime aussi ses fichiers.",
  ],
  [
    "demande",
    "Faire une demande de parrainage",
    "Depuis un profil parrain, un débutant peut envoyer une demande en expliquant son objectif et l’aide recherchée. Le parrain la retrouve dans Mon profil → Demandes et peut l’accepter ou la refuser. Une demande en attente ne réserve aucune place. Une place est occupée seulement après acceptation et se libère à la fin du binôme.",
    "Le nombre de places libres dépend de la capacité choisie par le parrain et des accompagnements en cours. Le parrain choisit combien de débutants il peut aider et pour quelle durée. Un profil sans place libre ne peut pas accepter davantage de débutants tant qu’une place ne se libère pas.",
  ],
  [
    "discord",
    "Échanger sur Discord",
    "Dans la fiche, clique sur Voir le contact Discord, puis copie le pseudo. Sur Discord, ouvre Amis → Ajouter un ami, colle le pseudo et présente-toi. Si le membre a renseigné son identifiant Discord, un bouton ouvre directement son profil.",
    "Les échanges se font sur Discord : Mentora ne contient pas de messagerie privée. Convenez ensemble des horaires, du délai de réponse et des objectifs. Les appels ne sont pas obligatoires. Le bouton Notre Discord permet aussi de rejoindre le groupe de la communauté.",
  ],
  [
    "suivi",
    "Suivre, terminer et donner un avis",
    "Les demandes sont dans Mon profil → Demandes. Retrouve les binômes actifs et leur historique dans Mon profil → Mes accompagnements. Une fois la demande acceptée, l’accompagnement passe en cours. Quand il se termine, chacun des deux membres peut le signaler depuis cet espace.",
    "Le débutant peut ensuite laisser une note de 1 à 5 étoiles à son parrain, une seule fois pour cet accompagnement. La moyenne et le nombre d’avis apparaissent sur le profil du parrain. La fin d’un accompagnement libère une place.",
  ],
  [
    "visibilite",
    "Masquer ou supprimer mon profil",
    "Tu as trouvé ton binôme ou tu veux faire une pause ? Dans Mon profil, clique sur Masquer mon profil. Ton profil et son contact disparaissent de l’annuaire. Tu peux le rendre visible à nouveau quand tu le souhaites.",
    "Supprimer mon profil retire la présentation et ses fichiers, mais conserve ton compte. Un pseudo déjà partagé ne peut pas être effacé du Discord d’une autre personne. Si l’administration a masqué ton profil, consulte le motif affiché : le bouton de visibilité ne lève pas ce masquage.",
  ],
  [
    "securite",
    "Signaler un problème et demander de l’aide",
    "Ouvre la fiche du membre concerné et utilise le signalement pour expliquer le problème. L’administration peut examiner les signalements, masquer un profil ou un avis et demander des précisions sur un dossier.",
    "Pour une question sur le fonctionnement, rejoins le groupe Discord depuis Notre Discord. Ne communique jamais ton mot de passe. L’entraide est gratuite : personne ne doit te promettre un revenu garanti.",
  ],
  [
    "navigation",
    "Retrouver mon espace et les mises à jour",
    "Le logo Mentora en haut à gauche ramène à l’accueil. Depuis l’accueil, Mon espace ouvre l’outil si tu es connecté. Mon profil contient tes informations, tes accompagnements et ta demande de vérification.",
    "Si la bannière annonce une nouvelle version, enregistre les modifications en cours puis clique sur Recharger la page. En cas d’erreur, lis le message affiché et réessaie. Se déconnecter ferme ta session sans supprimer ton compte.",
  ],
  [
    "administration",
    "Le rôle de l’administration",
    "L’espace Administration est réservé au compte autorisé. Il réunit les comptes créés, les parrains actifs, les demandes, le taux d’acceptation, les binômes terminés, les signalements et les avis.",
    "L’administration examine les réponses et justificatifs confidentiels avant de valider les domaines d’un parrain ou de demander des compléments. Aucun membre ne peut valider son propre dossier.",
  ],
];
export function Help() {
  return (
    <section className="wrap help-page">
      <div className="page-heading">
        <span className="eyebrow">LE GUIDE MENTORA</span>
        <h1>Tout comprendre, simplement.</h1>
        <p>
          De tes premiers pas en achat-revente à ton premier binôme : les
          étapes, les boutons et les réponses à tes questions.
        </p>
      </div>
      <div className="help-journey" aria-label="Les étapes du parrainage">
        {[
          [UserPlus, "1. Je crée mon profil"],
          [Search, "2. Je trouve mon binôme"],
          [MessageCircle, "3. On échange"],
          [Star, "4. Je donne mon avis"],
        ].map(([Icon, title]) => {
          const I = Icon as typeof Star;
          return (
            <div key={String(title)}>
              <I size={30} />
              <strong>{String(title)}</strong>
            </div>
          );
        })}
      </div>
      <nav className="help-index" aria-label="Sommaire de l’aide">
        {chapters.map(([id, title], i) => (
          <a
            href={`#aide-${id}`}
            key={id}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(`aide-${id}`)
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {i + 1}. {title}
          </a>
        ))}
      </nav>
      <div className="help-chapters">
        {chapters.map(([id, title, ...paragraphs], i) => (
          <article key={id} id={`aide-${id}`}>
            <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
            <h2>{title}</h2>
            {paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {id === "verification" && (
              <div className="help-example">
                <ShieldCheck />
                <div>
                  <strong>Parrain vérifié</strong>
                  <p>Dossier examiné par l’administration.</p>
                </div>
                <div>
                  <strong>Parrain non vérifié</strong>
                  <p>Expérience déclarée par le membre.</p>
                </div>
              </div>
            )}
            {id === "visibilite" && (
              <div className="help-example">
                <EyeOff />
                <span>
                  Profil masqué → absent de l’annuaire → réactivation possible.
                </span>
              </div>
            )}
          </article>
        ))}
      </div>
      <a
        className="btn"
        href="https://discord.gg/SRVs9Y5ze"
        target="_blank"
        rel="noopener noreferrer"
      >
        Rejoindre le groupe Discord
      </a>
    </section>
  );
}
