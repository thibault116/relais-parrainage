"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import {withdrawalLabels} from "@/lib/monetization/bank-status";
const endpoint="/api/admin/monetization/bank";
const euro=(c:number)=>(c/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
type Bank={holder:string;country:"FR"|"BE"|"OTHER";ibanCountry:string;last4:string};
type Entry={id:string;amount_cents:number;status:string;created_at:string;kind:"manual"|"stripe";mode?:string;reference?:string;reason?:string};
type Overview={configured:boolean;bank:Bank|null;availableCents:number;history:Entry[]};
async function api(body?:unknown):Promise<Overview&{error?:string}> {
  const r=await fetch(endpoint,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok)throw Error(d.error || "Opération indisponible.");return d;
}
const changed=()=>window.dispatchEvent(new Event("mentora-bank-changed"));
export function ManualBankForm() {
  const [data,setData]=useState<Overview|null>(null),[holder,setHolder]=useState(""),[country,setCountry]=useState<Bank["country"]>("FR"),[iban,setIban]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const requestKey=useRef<string|null>(null),mounted=useRef(true);
  const load=useCallback(async()=>{const d=await api();if(mounted.current)setData(d);return d;},[]);
  useEffect(()=>{mounted.current=true;void load().then(d=>{if(mounted.current&&d.bank){setHolder(d.bank.holder);setCountry(d.bank.country);}}).catch(()=>{if(mounted.current)setError("Chargement impossible.");});const listener=()=>{void load().catch(()=>{});};window.addEventListener("mentora-bank-changed",listener);return()=>{mounted.current=false;window.removeEventListener("mentora-bank-changed",listener);};},[load]);
  async function save() {
    setBusy(true);setError("");setMessage("");
    try{await api({action:"save",bank:{holder,country,iban}});setIban("");await load();setMessage("Enregistré.");changed();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function request() {
    setBusy(true);setError("");setMessage("");requestKey.current ||= crypto.randomUUID();
    try{await api({action:"request",key:requestKey.current});requestKey.current=null;await load();setMessage("Demande enregistrée · en attente.");changed();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const unsaved=!!iban || !!data?.bank&&(holder!==data.bank.holder||country!==data.bank.country);
  return <section className="commerce-card manual-bank-form" aria-label="Informations de versement">
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label>Titulaire du compte<input autoComplete="off" name="account-holder" value={holder} onChange={e=>setHolder(e.target.value)} minLength={2} maxLength={120} required disabled={busy}/></label>
      <label>Pays<select value={country} onChange={e=>setCountry(e.target.value as Bank["country"])} disabled={busy}><option value="FR">France</option><option value="BE">Belgique</option><option value="OTHER">Autre</option></select></label>
      <label>Ton IBAN<input autoComplete="off" name="bank-iban" spellCheck={false} autoCapitalize="characters" value={iban} onChange={e=>setIban(e.target.value)} placeholder={data?.bank?`${data.bank.ibanCountry} •••• ${data.bank.last4}`:"FR76 …"} maxLength={80} required disabled={busy}/></label>
      <button type="submit" className="commerce-row" disabled={busy||!data?.configured||!iban.trim()||holder.trim().length<2}>Enregistrer</button>
    </form>
    <div className="manual-bank-request"><button type="button" className="commerce-primary" disabled={busy||!data?.configured||!data.bank||data.availableCents<=0||unsaved} onClick={()=>void request()}>Demander un retrait</button><strong>{euro(data?.availableCents || 0)} disponibles</strong></div>
    {data&&!data.configured&&<p role="status">Enregistrement bancaire en attente d’activation.</p>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
const stripeStatuses:Record<string,string>={creating:"En préparation",funded:"Transféré vers Stripe",pending:"En cours",paid:"Versé · test",failed:"Refusé",payout_failed:"Refusé par la banque",uncertain:"À vérifier"};
export function ManualBankHistory() {
  const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>setData(await api()),[]);
  useEffect(()=>{void load().catch(()=>setError("Historique indisponible."));const listener=()=>{void load().catch(()=>{});};window.addEventListener("mentora-bank-changed",listener);return()=>window.removeEventListener("mentora-bank-changed",listener);},[load]);
  async function cancel(id:string){setBusy(true);setError("");try{await api({action:"cancel",id});await load();changed();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="commerce-history" aria-label="Historique des retraits">
    {error&&<p role="alert">{error}</p>}{data&&!data.history.length&&<p>Aucun retrait.</p>}
    {data?.history.map(item=><article key={`${item.kind}:${item.id}`}><div><strong>{euro(Number(item.amount_cents))}</strong><p>{item.kind==="manual"?`${withdrawalLabels[item.status]||item.status}${item.mode==="test"?" · test":""}`:stripeStatuses[item.status]||item.status}</p><small>{new Date(item.created_at).toLocaleString("fr-FR")}</small>{item.reference&&<p>Référence : {item.reference}</p>}{item.reason&&<p>Motif : {item.reason}</p>}{item.kind==="manual"&&item.status==="pending"&&<button type="button" className="commerce-row" disabled={busy} onClick={()=>void cancel(item.id)}>Annuler la demande</button>}</div></article>)}
  </div>;
}
