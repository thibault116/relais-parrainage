import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isCrmOwner } from "@/lib/crm";
import { listLegalRequests } from "@/lib/legal-requests";
import { legalRequestLabels } from "@/lib/legal-requests-shared";
import { DecisionForm } from "./decision-form";

export const dynamic = "force-dynamic";

export default async function LegalRequestsAdmin() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!(await isCrmOwner(session?.user))) notFound();
  const requests = await listLegalRequests();
  return (
    <main className="wrap legal-page">
      <a href="/?mobile=legalGuide#workspace">← Guide juridique Mentora</a>
      <h1>Demandes juridiques</h1>
      <p>Vérifie l’identité et le contrat avant toute action sur un abonnement ou un remboursement. Pour une résiliation, indique la date d’effet et les conséquences. Pour un signalement, explique la décision et les voies de recours applicables.</p>
      {!requests.length && <p>Aucune déclaration enregistrée.</p>}
      {requests.map((request) => (
        <article className="legal-card" key={request.id}>
          <h2>{legalRequestLabels[request.kind]}</h2>
          <p>{new Date(request.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · {request.id}</p>
          <dl>
            <dt>Personne</dt><dd>{request.name || "Non communiqué"}</dd>
            <dt>E-mail</dt><dd>{request.email || "Non communiqué"}</dd>
            <dt>Référence</dt><dd>{request.reference}</dd>
            {request.details && <><dt>Précisions</dt><dd className="legal-receipt">{request.details}</dd></>}
          </dl>
          {request.email && <p>Accusé par e-mail : {request.receipt_sent_at ? "envoyé" : "en attente d’envoi"}</p>}
          {request.decision ? (
            <>
              <p><strong>Décision enregistrée</strong></p>
              <p className="legal-receipt">{request.decision}</p>
              {request.email && <p>Décision par e-mail : {request.decision_sent_at ? "envoyée" : "en attente d’envoi"}</p>}
            </>
          ) : <DecisionForm id={request.id} hasEmail={!!request.email} />}
        </article>
      ))}
    </main>
  );
}
