"use client";

import { useRef, useState, type FormEvent } from "react";
import { legalContact } from "@/lib/legal-versions";
import type { LegalRequestKind } from "@/lib/legal-requests-shared";

type Result = { id: string; receipt: string; emailQueued: boolean };
const initial = { name: "", email: "", reference: "", details: "", requestedDate: "", anonymousProtection: false };

export function LegalRequestForm({ kind }: { kind: LegalRequestKind }) {
  const [fields, setFields] = useState(initial);
  const [stage, setStage] = useState<"edit" | "review">("edit");
  const [goodFaith, setGoodFaith] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submissionId = useRef("");
  const report = kind === "report";
  const cancel = kind === "cancellation";
  const identityOptional = report && fields.anonymousProtection;

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStage("review");
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      submissionId.current ||= crypto.randomUUID();
      const response = await fetch("/api/legal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, id: submissionId.current, kind, confirmed: !report || goodFaith }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transmission impossible.");
      setResult(data);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadReceipt() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.receipt], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mentora-declaration-${result.id}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (result) {
    return (
      <section className="legal-card" aria-live="polite">
        <h2>Déclaration enregistrée</h2>
        <p>Référence Mentora : <strong>{result.id}</strong></p>
        {result.emailQueued && <p>Ton accusé de réception a été placé dans la file d’envoi par e-mail.</p>}
        <button className="btn" type="button" onClick={downloadReceipt}>Télécharger l’accusé de réception</button>
        <pre className="legal-receipt">{result.receipt}</pre>
      </section>
    );
  }

  return (
    <section className="legal-card">
      <p>{report
        ? "Décris où se trouve le contenu et pourquoi tu le considères illicite. Évite de joindre ou de reproduire le contenu."
        : "Tu peux transmettre ta déclaration gratuitement, sans créer de compte. Tu pourras vérifier les informations avant l’envoi."}</p>
      {stage === "edit" ? (
        <form className="legal-form" onSubmit={review}>
          {report && <label className="legal-check">
            <input type="checkbox" checked={fields.anonymousProtection}
              onChange={(event) => setFields({ ...fields, anonymousProtection: event.target.checked })} />
            Signalement relatif à des infractions d’abus ou d’exploitation sexuels de mineurs. Dans ce cas, l’identité et l’e-mail sont facultatifs.
          </label>}
          <label>Nom et prénom{identityOptional ? " (facultatif)" : ""}
            <input autoComplete="name" value={fields.name} maxLength={120} minLength={2} required={!identityOptional}
              onChange={(event) => setFields({ ...fields, name: event.target.value })} />
          </label>
          <label>Adresse e-mail pour l’accusé de réception{identityOptional ? " (facultative)" : ""}
            <input type="email" autoComplete="email" value={fields.email} maxLength={254} required={!identityOptional}
              onChange={(event) => setFields({ ...fields, email: event.target.value })} />
          </label>
          <label>{report ? "Lien exact ou emplacement du contenu" : "Référence du contrat ou éléments d’identification"}
            <input value={fields.reference} maxLength={500} minLength={3} required
              placeholder={report ? "URL, salon, auteur, date ou identifiant du message" : "Numéro de facture, offre, date ou e-mail du compte"}
              onChange={(event) => setFields({ ...fields, reference: event.target.value })} />
          </label>
          {cancel && <label>Date de résiliation souhaitée (facultative)
            <input type="date" value={fields.requestedDate}
              onChange={(event) => setFields({ ...fields, requestedDate: event.target.value })} />
          </label>}
          <label>{report ? "Pourquoi ce contenu te paraît-il illicite ?" : "Précisions d’identification (facultatives)"}
            <textarea rows={4} value={fields.details} maxLength={3000} required={report} minLength={report ? 12 : undefined}
              onChange={(event) => setFields({ ...fields, details: event.target.value })} />
          </label>
          {report && <label className="legal-check">
            <input type="checkbox" required checked={goodFaith} onChange={(event) => setGoodFaith(event.target.checked)} />
            Je pense de bonne foi que les informations et allégations transmises sont exactes et complètes.
          </label>}
          <p>Les informations servent à recevoir et traiter ta déclaration. <a href="/juridique/confidentialite">Politique de confidentialité</a>.</p>
          <button type="submit" className="btn">Vérifier ma déclaration</button>
        </form>
      ) : (
        <div className="legal-form">
          <h2>Vérifie ta déclaration</h2>
          <dl>
            <dt>Nom</dt><dd>{fields.name || "Non communiqué"}</dd>
            <dt>E-mail</dt><dd>{fields.email || "Non communiqué"}</dd>
            <dt>{report ? "Emplacement" : "Contrat"}</dt><dd>{fields.reference}</dd>
            {fields.requestedDate && <><dt>Date souhaitée</dt><dd>{fields.requestedDate}</dd></>}
            {fields.details && <><dt>Précisions</dt><dd>{fields.details}</dd></>}
          </dl>
          <p>{report ? "Je confirme mon signalement de bonne foi." : cancel
            ? "Je confirme demander la résiliation de ce contrat."
            : "Je confirme me rétracter de ce contrat."}</p>
          {error && <p role="alert" className="error">{error}</p>}
          <div className="legal-actions">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => {
              submissionId.current = "";
              setStage("edit");
            }}>Modifier</button>
            <button type="button" className="btn" disabled={busy} onClick={confirm}>
              {busy ? "Envoi…" : report ? "Confirmer le signalement" : cancel ? "Notifier la résiliation" : "Confirmer la rétractation"}
            </button>
          </div>
        </div>
      )}
      <p>Tu peux aussi contacter Mentora à <a href={`mailto:${legalContact}`}>{legalContact}</a>.</p>
    </section>
  );
}
