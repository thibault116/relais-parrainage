"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const ConnectBankSetup=dynamic(()=>import("./connect-bank-setup"),{ssr:false,loading:()=><p role="status">Ouverture du formulaire sécurisé…</p>});
import { Building2, CircleCheck, RefreshCw, CircleHelp, Wallet } from "lucide-react";
import { defaultPayoutCountry, payoutCountries, payoutCountryLabel } from "@/lib/monetization/bank-countries";
const euro=(cents:number)=>(cents/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
type Withdrawal={id:string;amount_cents:number;status:string;error:string;created_at:string;transfer_id:string|null;payout_id:string|null};
type Overview={availableCents:number;paidCents:number;reservedCents:number;country?:string;earnings:{id:string;title:string;cents:number}[];withdrawals:Withdrawal[];account:null|{id:string;detailsSubmitted:boolean;payoutsEnabled:boolean;transfersActive:boolean;requirementsCount:number;pendingVerificationCount:number;banks:{bankName:string|null;last4:string|null;currency:string;country?:string;holderName?:string|null;defaultForCurrency?:boolean}[];availableCents:number;pendingCents:number}};
const statuses:Record<string,string>={creating:"Préparation du transfert",funded:"Sur ton compte Stripe · retrait à reprendre",pending:"Virement bancaire en cours",paid:"Versé · mode test",failed:"Transfert refusé · gains à nouveau disponibles",payout_failed:"Virement bancaire refusé · gains conservés sur Stripe",uncertain:"Résultat à vérifier · reprendre le même retrait"};
export function ConnectPayoutPanel() {
  const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[country,setCountry]=useState<string>(defaultPayoutCountry),[acknowledged,setAcknowledged]=useState(false),[message,setMessage]=useState("");
  const withdrawalKey=useRef<string|null>(null);
  const [bankForm,setBankForm]=useState<"onboarding"|"bank"|null>(null);
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
      if(name==="setup")setBankForm("bank");
      if(d.url){window.location.assign(d.url);return;}
      if(d.result){setMessage(statuses[d.result.status] || d.result.status);if(d.result.error)setError(d.result.error);withdrawalKey.current=null;}
      await load();
    } catch(e) {setError((e as Error).message);await load().catch(()=>{});}
    finally {setBusy(false);}
  }
  const ready=!!data?.account?.payoutsEnabled && !!data?.account?.transfersActive;
  return <section className="commerce-card connect-payout-panel connect-payout-compact" aria-label="Compte bancaire et gains du parrain">
    <div className="connect-heading"><h2><Wallet size={22}/> Mes gains</h2><div className="connect-tools"><a className="commerce-row connect-refresh" href="/?mobile=help&help=retraits#help" aria-label="Tutoriel des retraits"><CircleHelp size={18}/></a><button type="button" className="commerce-row connect-refresh" aria-label="Actualiser mes gains et mes retraits" disabled={busy} onClick={()=>void action("refresh")}><RefreshCw size={18}/></button></div></div>
    <small className="commerce-pill">Test privé</small>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Chargement…</p>}
    {data && <>
      <div className="connect-balances">
        <article><span>Disponibles</span><strong>{euro(data.availableCents)}</strong></article>
        <article><span>En cours</span><strong>{euro(data.reservedCents)}</strong></article>
        <article><span>Versés</span><strong>{euro(data.paidCents)}</strong></article>
      </div>
      <section aria-label="Configuration bancaire Stripe">
        <h3><Building2 size={20}/> Compte bancaire</h3>
        {!data.account ? <>
          <label>Pays de résidence<select value={country} onChange={e=>setCountry(e.target.value)} disabled={busy || !!data.country}>
            {Object.entries(payoutCountries).map(([value,label])=><option value={value} key={value}>{label}</option>)}
          </select></label>
          <label className="connect-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> Données de test uniquement</label>
          <button type="button" className="commerce-primary" disabled={busy || !acknowledged} onClick={()=>void action("setup")}>Ajouter un compte bancaire</button>
        </> : <>
          {data.account.banks.filter(bank=>bank.currency==="eur").map((bank,index)=><article key={index} className="connect-bank-summary"><strong>{bank.bankName || "Compte bancaire"}</strong><p>{bank.holderName && <>{bank.holderName} · </>}{payoutCountryLabel(bank.country)} · EUR · •••• {bank.last4}</p></article>)}
          {!bankForm && <button type="button" className="commerce-primary" disabled={busy} onClick={()=>setBankForm("bank")}>{data.account.banks.some(b=>b.currency==="eur")?"Gérer mon IBAN":"Ajouter un compte bancaire"}</button>}
          {!ready && bankForm!=="onboarding" && <button type="button" className="commerce-row" onClick={()=>setBankForm("onboarding")}>Vérification requise</button>}
        </>}
        {bankForm && <ConnectBankSetup mode={bankForm} onDone={()=>{setBankForm(null);void load().catch(e=>setError(e.message));}}/>}
      </section>
      <section aria-label="Demander un retrait de gains">
        <button type="button" className="commerce-primary" disabled={busy || !ready || data.availableCents<=0} onClick={()=>void action("withdraw")}>Retirer {euro(data.availableCents)}</button>
      </section>
      <details className="connect-withdrawal-history"><summary>Historique des retraits</summary>
        {!data.withdrawals.length && <p>Aucun retrait.</p>}
        <div className="commerce-history">{data.withdrawals.map(w=><article key={w.id}><div><strong>{euro(Number(w.amount_cents))}</strong><p>{w.status==="paid" && <CircleCheck size={16}/>} {statuses[w.status] || w.status}</p><small>{new Date(w.created_at).toLocaleString("fr-FR")}</small>{w.error && <p>{w.error}</p>}{["creating","funded","uncertain","payout_failed"].includes(w.status) && <button type="button" className="commerce-row" disabled={busy} onClick={()=>void action("resume",w.id)}>Reprendre</button>}</div></article>)}</div>
      </details>
    </>}
  </section>;
}
