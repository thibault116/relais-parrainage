"use client";
import {Copy, RefreshCw, Info} from "lucide-react";
import {useCallback,useEffect,useRef,useState} from "react";
import {withdrawalLabels} from "@/lib/monetization/bank-status";
type Item={id:string;name:string;owner_id:string;amount_cents:number;state:string;mode:"test"|"live";revision:number;reference:string;reason:string;created_at:string};
type Data={items:Item[];total:number;policy:{liveEnabled:boolean};page:number};
type Detail={bank:{holder:string;iban:string;country:string};audit:{id:string;action:string;from_state:string;to_state:string;actor_name:string;created_at:string;reference:string;reason:string}[]};
const euro=(v:number)=>(v/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
async function call(body?:unknown,page=0,state="",mode="live"){const r=await fetch(`/api/admin/withdrawals?page=${page}&state=${state}&mode=${mode}`,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||"Demandes indisponibles.");return d;}
export function AdminWithdrawals(){
  const [mode,setMode]=useState("live");
  const [data,setData]=useState<Data|null>(null),[page,setPage]=useState(0),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<Item|null>(null),[detail,setDetail]=useState<Detail|null>(null),[action,setAction]=useState<"processing"|"paid"|"refused"|null>(null),[reference,setReference]=useState(""),[reason,setReason]=useState(""),[confirmed,setConfirmed]=useState(false);
  const [filter,setFilter]=useState(""),[banks,setBanks]=useState<Record<string,Detail>>({}),[copied,setCopied]=useState("");
  const dialog=useRef<HTMLDialogElement>(null),key=useRef<string|null>(null);
  const load=useCallback(async()=>{setData(await call(undefined,page,filter,mode));setBanks({});},[page,filter,mode]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
  useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();},[selected]);
  function close(){dialog.current?.close();setSelected(null);setDetail(null);setAction(null);setReference("");setReason("");setConfirmed(false);key.current=null;}
  function open(item:Item,decision:typeof action){setDetail(null);setAction(decision);setSelected(item);setReference(item.reference||"");setReason("");setConfirmed(false);key.current=crypto.randomUUID();setError("");}
  async function showBank(id:string){setBusy(true);setError("");try{const d=await call({action:"reveal",id},0,"",mode);setBanks(v=>({...v,[id]:d}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function copy(id:string){try{await navigator.clipboard.writeText(banks[id].bank.iban);setCopied(id);}catch{setError("Copie manuellement l’IBAN affiché.");}}
  async function reveal(){if(!selected)return;setBusy(true);setError("");try{setDetail(await call({action:"reveal",id:selected.id},0,"",mode));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function decide(){if(!selected||!action)return;setBusy(true);setError("");key.current ||= crypto.randomUUID();try{await call({id:selected.id,action,revision:Number(selected.revision),key:key.current,reference,reason,confirmed},0,"",mode);close();await load();}catch(e){setError((e as Error).message);await load().catch(()=>{});}finally{setBusy(false);}}
  return <section className="admin-withdrawals" aria-label="Gestion des retraits manuels">
    <header className="withdrawal-page-heading"><span className="eyebrow">Administration</span><h2>Retraits</h2><select aria-label="Mode des retraits" disabled={busy||!!selected} value={mode} onChange={e=>{setMode(e.target.value);setBanks({});setData(null);setPage(0)}}><option value="live">Réel</option><option value="test">Simulation</option></select><p>Gère les demandes de retrait des parrains.</p><button className="commerce-icon" aria-label="Actualiser les retraits" disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}><RefreshCw size={19}/></button></header>
    <aside className="withdrawal-info"><Info/><div><strong>Virement bancaire manuel</strong><p>Effectue le virement depuis ta banque, puis confirme son paiement ici. Aucun virement automatique.</p><small>{data?.policy.liveEnabled?"Mode réel":"Mode test · versements réels désactivés"}</small></div></aside>
    <nav className="withdrawal-filters" aria-label="Statut des retraits">{[["","Toutes"],["pending","En attente"],["processing","En traitement"],["paid","Payés"],["refused","Refusés"]].map(([id,label])=><button key={id} className={filter===id?"selected":""} onClick={()=>{setFilter(id);setPage(0);}}>{label}</button>)}</nav>
    {error&&!selected&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Chargement…</p>}
    {data&&!data.items.length&&<p>Aucune demande de retrait.</p>}
    <div className="withdrawal-list">{data?.items.map(item=><article className="commerce-card" key={item.id}>
      <div className="connect-heading"><span className="withdrawal-avatar" aria-hidden="true">{item.name.slice(0,1).toUpperCase()}</span><h2>{item.name}</h2><strong>{euro(Number(item.amount_cents))}</strong></div>
      <p>{withdrawalLabels[item.state]||item.state}{item.mode==="test"?" · test":""} · {new Date(item.created_at).toLocaleString("fr-FR")}</p>
      {item.reference&&<p>Référence : {item.reference}</p>}{item.reason&&<p>Motif : {item.reason}</p>}
      <div className="withdrawal-inline-bank">{banks[item.id]?<><strong>{banks[item.id].bank.holder}</strong><div><code>{banks[item.id].bank.iban.replace(/(.{4})/g,"$1 ").trim()}</code><button className="commerce-icon" aria-label={`Copier l’IBAN de ${item.name}`} onClick={()=>void copy(item.id)}><Copy size={19}/></button></div>{copied===item.id&&<small role="status">IBAN copié</small>}</>:<button className="commerce-row" disabled={busy} onClick={()=>void showBank(item.id)}>Afficher le titulaire et l’IBAN</button>}</div>
      <div className="withdrawal-actions"><button className="commerce-row" onClick={()=>open(item,null)}>Coordonnées et journal</button>{item.state==="pending"&&<button className="commerce-primary" onClick={()=>open(item,"processing")}>Mettre en traitement</button>}{item.state==="processing"&&<button className="commerce-primary" onClick={()=>open(item,"paid")}>Marquer comme payé{item.mode==="test"?" · test":""}</button>}{["pending","processing"].includes(item.state)&&<button className="commerce-row" onClick={()=>open(item,"refused")}>Refuser</button>}</div>
    </article>)}</div>
    {data&&data.total>50&&<div className="withdrawal-actions"><button className="btn secondary" disabled={!page||busy} onClick={()=>setPage(n=>n-1)}>Précédent</button><span>Page {page+1}</span><button className="btn secondary" disabled={(page+1)*50>=data.total||busy} onClick={()=>setPage(n=>n+1)}>Suivant</button></div>}
    <dialog ref={dialog} aria-label="Détails du retrait" className="withdrawal-dialog commerce-card" onCancel={e=>{e.preventDefault();if(!busy)close();}} onClose={()=>{setSelected(null);setDetail(null);}}>
      <div className="connect-heading"><h2>{selected?.name}</h2><button className="text-btn" disabled={busy} onClick={close}>Fermer</button></div>
      {selected&&<><p>{euro(Number(selected.amount_cents))} · {withdrawalLabels[selected.state]}{selected.mode==="test"?" · test":""}</p>
        {!detail&&<button className="commerce-row" disabled={busy} onClick={()=>void reveal()}>Afficher le titulaire, l’IBAN et le journal</button>}
        {detail&&<><div className="withdrawal-bank"><strong>{detail.bank.holder}</strong><code>{detail.bank.iban.replace(/(.{4})/g,"$1 ").trim()}</code><span>{detail.bank.country==="OTHER"?detail.bank.iban.slice(0,2):detail.bank.country}</span></div><details><summary>Journal des actions</summary>{detail.audit.map(e=><article key={e.id}><strong>{e.action==="view_bank"?"Consultation bancaire":e.action==="created"?"Demande créée":withdrawalLabels[e.to_state]||e.action}</strong><p>{e.actor_name||"Administrateur"} · {new Date(e.created_at).toLocaleString("fr-FR")}</p>{e.reference&&<p>{e.reference}</p>}{e.reason&&<p>{e.reason}</p>}</article>)}</details></>}
        {action&&<form onSubmit={e=>{e.preventDefault();void decide();}}>
          {action!=="refused"&&<label>Référence de virement{action==="processing"?" (facultatif)":""}<input value={reference} maxLength={120} required={action==="paid"} onChange={e=>setReference(e.target.value)}/></label>}
          {action==="refused"&&<label>Motif du refus<textarea value={reason} minLength={3} maxLength={500} required onChange={e=>setReason(e.target.value)}/></label>}
          {action==="paid"&&<label className="connect-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>{selected.mode==="test"?"Je confirme une simulation de paiement, sans argent réel.":"Je confirme avoir effectué et vérifié le virement dans ma banque."}</label>}
          <button className="commerce-primary" disabled={busy||action==="paid"&&(!confirmed||!reference.trim())}>{action==="processing"?"Confirmer le traitement":action==="paid"?(selected.mode==="test"?"Marquer payé · test":"Marquer comme payé"):"Confirmer le refus"}</button>
        </form>}
      </>}{error&&<p role="alert">{error}</p>}
    </dialog>
  </section>;
}
