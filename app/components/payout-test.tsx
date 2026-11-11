"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PayoutDiagnostic } from "@/lib/monetization/payout-diagnostics";
import type { PayoutTest } from "@/lib/monetization/payout-tests";
const labels: Record<string,string> = {
  simulated:"Parcours simulé · aucun virement Stripe",creating:"Création en cours",uncertain:"À vérifier",
  pending:"En attente Stripe",in_transit:"En cours Stripe",paid:"Versé dans le bac à sable",failed:"Échec du test",canceled:"Test annulé",
};
export function PayoutTestPanel() {
  const [diagnostic,setDiagnostic] = useState<PayoutDiagnostic | null>(null);
  const [tests,setTests] = useState<PayoutTest[]>([]);
  const [amount,setAmount] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const pendingKey = useRef<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/monetization/payouts",{cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Historique indisponible.");
    setTests(data.tests);
    const unresolved = (data.tests as PayoutTest[]).find(test => !test.stripe_id && ["creating","uncertain"].includes(test.status));
    if (unresolved) { pendingKey.current=unresolved.request_key;setAmount(unresolved.amount); }
  },[]);
  useEffect(() => { void load().catch(error => setError(error.message)); },[load]);
  async function send(refresh = false, diagnose = false) {
    if (busy) return;
    setBusy(true);setError("");setMessage("");
    if (!refresh && !diagnose) pendingKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/admin/monetization/payouts",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(diagnose ? {action:"diagnose"} : refresh ? {action:"refresh"} : {action:"create",amount,key:pendingKey.current}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.tests) setTests(data.tests);
      if (data.diagnostic) setDiagnostic(data.diagnostic);
      if (data.result) {
        const result = data.result as PayoutTest;
        setMessage(labels[result.status] || result.status);
        if (result.error) setError(result.error);
        if (!["creating","uncertain"].includes(result.status)) pendingKey.current = null;
      }
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  const unresolved = tests.some(test => !test.stripe_id && ["creating","uncertain"].includes(test.status));
  return <section className="commerce-card payout-test-panel">
    <h2>Tester un retrait</h2>
    <p>Réservé à ton compte administrateur. Aucun argent réel ne sort et tes crédits restent inchangés.</p>
    <section aria-label="Destination du retrait de test">
      <h3>Où va le test ?</h3>
      <p>Ce parcours teste un retrait du compte Stripe de Mentora. Il ne verse rien sur ton compte personnel. Aucun argent réel ne bouge.</p>
      <button className="commerce-row" disabled={busy} onClick={() => void send(false,true)}>Vérifier Stripe et la destination</button>
      {diagnostic && <div role="status">
        {diagnostic.destination ? <p>Destination de test : {diagnostic.destination.bankName} · •••• {diagnostic.destination.last4} · EUR.</p> : <p>Aucune destination EUR confirmée.</p>}
        {diagnostic.availableCents !== undefined && <p>Solde EUR disponible dans Stripe test : {(diagnostic.availableCents / 100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}.</p>}
        {diagnostic.checks.map((check,index) => <p key={index}>{check}</p>)}
        {diagnostic.code && <small>Code Stripe : {diagnostic.code}{diagnostic.requestId ? ` · ${diagnostic.requestId}` : ""}</small>}
        {diagnostic.ready && <p>Stripe confirme une destination et un solde suffisants pour tenter 1 €.</p>}
      </div>}
      <a href="https://dashboard.stripe.com/test/settings/payouts" target="_blank" rel="noreferrer">Configurer la banque dans Stripe test</a>
    </section>
    <p>Stripe impose un minimum de 1 € pour les virements de test en euros. L’ancien essai à 0,01 € est conservé dans l’historique.</p>
    <label>Montant du test
      <select value={amount} disabled={busy || unresolved} onChange={event => {setAmount(Number(event.target.value));pendingKey.current=null;}}>
        <option value={0}>0 € · vérifier le parcours sans Stripe</option>
        <option value={100}>1 € · virement Stripe test</option>
      </select>
    </label>
    <p>{amount === 0 ? "À 0 €, Mentora enregistre un essai sans créer de virement." : "Le compte bancaire EUR de test doit être confirmé ci-dessus. Aucun IBAN réel n’est demandé dans Mentora."}</p>
    <button className="commerce-primary" disabled={busy || (amount !== 0 && amount !== 100)} onClick={() => void send()}>{busy ? "Traitement…" : unresolved ? "Reprendre le même test de 1 €" : amount === 0 ? "Simuler le retrait de 0 €" : "Tester le retrait de 1 €"}</button>
    <button className="commerce-row" disabled={busy} onClick={() => void send(true)}>Actualiser les statuts Stripe</button>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <h3>Historique des retraits de test</h3>
    {!tests.length && <p>Aucun test effectué.</p>}
    <div className="commerce-history">{tests.map(test => <article key={test.id}>
      <span><strong>{(test.amount / 100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})} · Test</strong><small>{labels[test.status] || test.status} · {new Date(test.created_at).toLocaleString("fr-FR")}</small>
        {test.error && <small>{test.error}</small>}
        {test.stripe_id && <a href={`https://dashboard.stripe.com/test/payouts/${test.stripe_id}`} target="_blank" rel="noreferrer">Voir le test dans Stripe</a>}
      </span>
    </article>)}</div>
  </section>;
}
