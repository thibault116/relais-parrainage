"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CircleCheck, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
const euro=(cents:number)=>(cents/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
type Withdrawal={id:string;amount_cents:number;status:string;error:string;created_at:string;transfer_id:string|null;payout_id:string|null};
type Overview={availableCents:number;paidCents:number;reservedCents:number;country?:string;earnings:{id:string;title:string;cents:number}[];withdrawals:Withdrawal[];account:null|{id:string;detailsSubmitted:boolean;payoutsEnabled:boolean;transfersActive:boolean;requirementsCount:number;pendingVerificationCount:number;banks:{bankName:string|null;last4:string|null;currency:string}[];availableCents:number;pendingCents:number}};
const statuses:Record<string,string>={creating:"Préparation du transfert",funded:"Sur ton compte Stripe · retrait à reprendre",pending:"Virement bancaire en cours",paid:"Versé · mode test",failed:"Transfert refusé · gains à nouveau disponibles",payout_failed:"Virement bancaire refusé · gains conservés sur Stripe",uncertain:"Résultat à vérifier · reprendre le même retrait"};
export function ConnectPayoutPanel() {
  const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[country,setCountry]=useState("FR"),[acknowledged,setAcknowledged]=useState(false),[message,setMessage]=useState("");
  const withdrawalKey=useRef<string|null>(null);
  const load=useCallback(async()=>{
    const r=await fetch("/api/admin/monetization/connect",{cache:"no-store"}),d=await r.json();
    if(!r.ok) throw Error(d.error || "Rémunérations indisponibles.");
    setData(d);if(d.country)setCountry(d.country);
  },[]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
  async function action(name:string,id?:string) {
    if(busy)return;setBusy(true);setError("");setMessage("");
    if(name==="withdraw") withdrawalKey.current ||= crypto.randomUUID();
    try {
      const r=await fetch("/api/admin/monetization/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:name,id,country,acknowledgeTest:acknowledged,key:name==="withdraw"?withdrawalKey.current:crypto.randomUUID()})}),d=await r.json();
      if(!r.ok)throw Error(d.error || "Opération non confirmée.");
      if(d.url){window.location.assign(d.url);return;}
      if(d.result){setMessage(statuses[d.result.status] || d.result.status);if(d.result.error)setError(d.result.error);withdrawalKey.current=null;}
      await load();
    } catch(e) {setError((e as Error).message);await load().catch(()=>{});}
    finally {setBusy(false);}
  }
  const ready=!!data?.account?.payoutsEnabled && !!data?.account?.transfersActive;
  return <section className="commerce-card connect-payout-panel" aria-label="Compte bancaire et gains du parrain">
    <div className="connect-heading"><h2><Wallet size={22}/> Mes gains et mon compte bancaire</h2><button type="button" className="commerce-row connect-refresh" aria-label="Actualiser mes gains et mes retraits" disabled={busy} onClick={()=>void action("refresh")}><RefreshCw size={18}/></button></div>
    <p><strong>Test privé · compte administrateur uniquement.</strong> Aucun argent réel. Ce compte Connect personnel est distinct du compte Stripe de Mentora.</p>
    <details><summary>Configuration Stripe de ce test</summary><p>Active Connect dans le bac à sable Stripe existant, puis complète ton dossier via le bouton ci-dessous. Aucun mode réel n’est nécessaire.</p><p>Pour les mises à jour automatiques, ajoute les événements des comptes connectés à l’URL /api/stripe/webhook et leur secret dans STRIPE_CONNECT_WEBHOOK_SECRET sur Vercel. Le bouton d’actualisation reste disponible.</p></details>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Chargement de tes gains…</p>}
    {data && <>
      <div className="connect-balances">
        <article><span>Gains disponibles</span><strong>{euro(data.availableCents)}</strong><small>Prestations terminées, hors gains déjà réservés ou transférés.</small></article>
        <article><span>Retraits en cours</span><strong>{euro(data.reservedCents)}</strong></article>
        <article><span>Déjà versé en test</span><strong>{euro(data.paidCents)}</strong></article>
      </div>
      <section aria-label="Configuration bancaire Stripe">
        <h3><Building2 size={20}/> Mon compte bancaire</h3>
        {!data.account ? <>
          <p>Stripe collecte ton identité et tes coordonnées bancaires sur sa page sécurisée. Mentora ne conserve ni ton IBAN ni tes justificatifs.</p>
          <label>Pays du titulaire du compte<select value={country} onChange={e=>setCountry(e.target.value)} disabled={busy || !!data.country}>
            {Object.entries({FR:"France",BE:"Belgique",CH:"Suisse",LU:"Luxembourg",DE:"Allemagne",ES:"Espagne",IT:"Italie",GB:"Royaume-Uni",US:"États-Unis",CA:"Canada"}).map(([value,label])=><option value={value} key={value}>{label}</option>)}
          </select></label>
          <label className="connect-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> Je configure mon compte Connect dans le bac à sable Stripe. J’utiliserai uniquement les données de test proposées par Stripe.</label>
          <button type="button" className="commerce-primary" disabled={busy || !acknowledged} onClick={()=>void action("setup")}>Configurer mon compte bancaire · test</button>
        </> : <>
          <p><ShieldCheck size={18}/> {ready?"Compte prêt pour les virements de test":"Dossier Stripe à compléter ou en cours de vérification"}</p>
          {data.account.banks.map((bank,index)=><p key={index}>{bank.bankName || "Banque"} · •••• {bank.last4} · {bank.currency.toUpperCase()}</p>)}
          {!data.account.banks.length && <p>Gère tes coordonnées bancaires directement chez Stripe.</p>}
          {data.account.requirementsCount>0 && <p>Stripe attend encore des informations pour activer les versements.</p>}
          {data.account.pendingVerificationCount>0 && <p>Des informations sont en cours de vérification par Stripe.</p>}
          <button type="button" className="commerce-row" disabled={busy} onClick={()=>void action("onboarding")}>{ready?"Mettre à jour mes informations Stripe":"Compléter mon dossier Stripe"}</button>
          <button type="button" className="commerce-row" disabled={busy} onClick={()=>void action("dashboard")}>Gérer mon compte bancaire chez Stripe</button>
          <p>Solde EUR disponible chez Stripe : {euro(data.account.availableCents)}{data.account.pendingCents>0?` · En attente : ${euro(data.account.pendingCents)}`:""}.</p>
        </>}
      </section>
      <section aria-label="Demander un retrait de gains"><h3>Retirer mes gains</h3>
        <p>Seule la rémunération des prestations terminées est retirable. Tes crédits ne sont pas convertibles en argent.</p>
        <button type="button" className="commerce-primary" disabled={busy || !ready || data.availableCents<=0} onClick={()=>void action("withdraw")}>Retirer {euro(data.availableCents)} · test</button>
        {!ready && <small>Finalise d’abord ton dossier Stripe pour activer ce bouton.</small>}
        {data.availableCents<=0 && <p>Aucun nouveau gain disponible. Les prestations terminées apparaîtront ici.</p>}
        {data.earnings.length>0 && <details><summary>Prestations comprises dans ce retrait</summary>{data.earnings.map(e=><p key={e.id}>{e.title} · {euro(e.cents)}</p>)}</details>}
      </section>
      <section aria-label="Historique de mes virements"><h3>Mes retraits bancaires</h3>
        {!data.withdrawals.length && <p>Aucun retrait de prestation effectué.</p>}
        <div className="commerce-history">{data.withdrawals.map(w=><article key={w.id}><div><strong>{euro(Number(w.amount_cents))}</strong><p>{w.status==="paid" && <CircleCheck size={16}/>} {statuses[w.status] || w.status}</p><small>{new Date(w.created_at).toLocaleString("fr-FR")}</small>{w.error && <p>{w.error}</p>}{["creating","funded","uncertain","payout_failed"].includes(w.status) && <button type="button" className="commerce-row" disabled={busy} onClick={()=>void action("resume",w.id)}>Reprendre ce retrait · test</button>}</div></article>)}</div>
      </section>
    </>}
  </section>;
}
