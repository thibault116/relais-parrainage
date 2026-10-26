export const MAIL_FROM = "mentora.officiel@gmail.com";
export const MAIL_SITE = "https://mentora-resell.vercel.app";
export const mailKinds = [
  "request_received",
  "request_sent",
  "accepted",
  "declined",
  "cancelled",
  "completed_beginner",
  "completed_mentor",
  "place_available",
  "verification_approved",
  "verification_changes",
] as const;
export type MailKind = (typeof mailKinds)[number];
export type MailData = {
  name: string;
  partner?: string;
  discord?: string;
  objective?: string;
  feedback?: string;
  profileId?: string;
};
export const mailLabels: Record<MailKind, string> = {
  request_received: "Nouvelle demande de parrainage",
  request_sent: "Ta demande a bien été envoyée",
  accepted: "Ta demande de parrainage est acceptée",
  declined: "Une réponse à ta demande de parrainage",
  cancelled: "Une demande de parrainage a été annulée",
  completed_beginner: "Ton accompagnement est terminé : donne ton avis",
  completed_mentor: "Un accompagnement est terminé",
  place_available: "Une place se libère chez un parrain que tu suis",
  verification_approved: "Ton compte parrain est vérifié",
  verification_changes: "Du nouveau concernant ton dossier parrain",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderMail(kind: MailKind, d: MailData, test = false) {
  const partner = d.partner || "ton binôme";
  const descriptions: Record<MailKind, string> = {
    request_received: `${partner} souhaite être accompagné par toi. Lis son objectif, puis accepte ou refuse sa demande dans Mentora. Aucune place n’est occupée avant ton acceptation.`,
    request_sent: `Ta demande a été envoyée à ${partner}. Tu seras averti de sa réponse. En attendant, aucune place n’est réservée.`,
    accepted: `Bonne nouvelle : ${partner} a accepté ta demande ! Contacte ton parrain sur Discord pour définir votre rythme et commencer à avancer ensemble.`,
    declined: `${partner} n’a pas accepté ta demande. Tu peux retrouver d’autres parrains sur Mentora et choisir un accompagnement adapté à tes objectifs.`,
    cancelled: `${partner} a annulé sa demande de parrainage. Cette demande n’occupait aucune place.`,
    completed_beginner: `Ton accompagnement avec ${partner} est terminé. Prends un instant pour laisser une note à ton parrain depuis l’historique de tes accompagnements.`,
    completed_mentor: `Ton accompagnement avec ${partner} est terminé. Merci d’avoir partagé ton expérience en achat-revente ! La place occupée par ce binôme est maintenant libérée.`,
    place_available: `${partner}, que tu suis sur Mentora, a de nouveau une place disponible. Consulte son profil et envoie une demande si tu souhaites être accompagné. La place n’est pas réservée et peut être prise entre-temps.`,
    verification_approved:
      "Ton dossier a été validé par l’administration. Le badge « Parrain vérifié » est maintenant actif sur ton profil.",
    verification_changes:
      "L’administration a examiné ton dossier. Consulte son retour et complète les éléments demandés dans la rubrique Vérification du compte.",
  };
  const tab = kind.startsWith("verification")
    ? "verification"
    : kind.startsWith("completed")
      ? "accompaniments"
      : "requests";
  const url =
    kind === "place_available"
      ? `${MAIL_SITE}/?member=${encodeURIComponent(d.profileId || "")}#directory`
      : `${MAIL_SITE}/?profileTab=${tab}#profile`;
  const cta =
    kind === "request_received"
      ? "Voir la demande et accepter ou refuser"
      : kind === "place_available"
        ? "Découvrir le parrain"
        : kind.startsWith("verification")
          ? "Voir mon dossier"
          : kind === "completed_beginner"
            ? "Retrouver le binôme et donner mon avis"
            : "Ouvrir Mentora";
  const pieces = [
    `Bonjour ${d.name},`,
    descriptions[kind],
    d.discord ? `Pseudo Discord de ${partner} : ${d.discord}` : "",
    d.feedback ? `Retour de l’administration : ${d.feedback}` : "",
  ].filter(Boolean);
  const subject = `${test ? "[TEST Mentora]" : "Mentora —"} ${mailLabels[kind]}`;
  const settings = `${MAIL_SITE}/?profileTab=emails#profile`;
  const text = [
    ...(test
      ? [
          "EXEMPLE DE TEST — personnages fictifs, aucune action réelle à effectuer.",
        ]
      : []),
    ...pieces,
    `${cta} : ${url}`,
    `Gérer mes notifications : ${settings}`,
    "Mentora · L’entraide entre revendeurs",
  ].join("\n\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f0fc;font-family:Arial,sans-serif;color:#292333"><div style="max-width:600px;margin:24px auto;padding:28px;background:#fff;border-radius:20px"><p style="color:#7751d9;font-weight:bold;font-size:24px">mentora.</p>${test ? '<p style="padding:12px;background:#f1ebfb">EXEMPLE DE TEST — personnages fictifs, aucune action réelle à effectuer.</p>' : ""}<h1 style="font-size:24px;line-height:1.3">${escape(mailLabels[kind])}</h1>${pieces.map((s) => `<p style="font-size:16px;line-height:1.7;white-space:pre-line;overflow-wrap:anywhere">${escape(s)}</p>`).join("")}<p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;padding:15px 20px;background:#7751d9;color:white;border-radius:12px;text-decoration:none">${escape(cta)}</a></p><p style="font-size:13px;color:#777180">Ce bouton ouvre Mentora. Connecte-toi pour consulter les informations et confirmer toute action.</p><hr style="border:0;border-top:1px solid #e9e5ef"><p style="font-size:13px"><a href="${escape(settings)}">Gérer mes notifications</a> · Mentora, l’entraide entre revendeurs.</p></div></body></html>`;
  return { subject, text, html };
}
