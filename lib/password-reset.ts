import { MAIL_FROM } from "./email-templates";
import { createMailTransport } from "./mail-transport";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function passwordResetMail(url: string) {
  const subject = "Mentora — Réinitialise ton mot de passe";
  const text = `Tu as demandé un nouveau mot de passe pour ton compte Mentora.\n\nChoisir un nouveau mot de passe : ${url}\n\nCe lien est valable 30 minutes et ne peut être utilisé qu’une fois. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail : ton mot de passe reste inchangé.\n\nL’équipe Mentora`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#0b0612;color:#f7f3ff;font-family:Arial,sans-serif;padding:24px"><main style="max-width:560px;margin:auto;background:#181020;border:1px solid #513069;border-radius:24px;padding:28px"><p style="font-size:24px;font-weight:bold;color:#b75cf8">Mentora</p><h1 style="font-size:25px">Un nouveau mot de passe</h1><p style="line-height:1.7">Tu as demandé à réinitialiser ton mot de passe.</p><p style="margin:30px 0"><a href="${escape(url)}" style="display:inline-block;background:#883af5;color:#fff;padding:16px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Choisir mon mot de passe</a></p><p style="line-height:1.7">Ce lien est valable <strong>30 minutes</strong> et ne peut être utilisé qu’une fois.</p><p style="line-height:1.7;color:#c3b6cf">Tu n’as pas fait cette demande ? Ignore cet e-mail : ton mot de passe reste inchangé.</p><p style="font-size:12px;color:#c3b6cf;overflow-wrap:anywhere">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>${escape(url)}</p><p>L’équipe Mentora 💜</p></main></body></html>`;
  return { subject, text, html };
}
export async function sendPasswordReset({ user, url }: { user: { email: string }; url: string }) {
  const transport = createMailTransport();
  try {
    const result = await transport.sendMail({
      from: { name: "Mentora", address: MAIL_FROM },
      replyTo: MAIL_FROM,
      to: user.email,
      ...passwordResetMail(url),
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted.length) throw Error("Envoi du lien indisponible.");
  } finally { transport.close(); }
}
