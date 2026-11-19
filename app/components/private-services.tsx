"use client";
import {ServiceDetailPage} from "./service-detail-page";
import {openServiceChat} from "./service-conversations";
import {servicePriceCents} from "@/lib/monetization/catalog";
import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import {ArrowLeft,ChevronRight,MessageCircle,Search,Send} from "lucide-react";
export type Service={id:string;data:{title:string;description:string;credits:number;published:boolean;image?:string;category?:string;duration?:number;calls?:number;followup?:string};profile?:{id:string;name:string;role:string}};
type Booking={id:string;owner_id:string;profile_id:string;name:string;snapshot:Service["data"];credits:number;status:string;notes:string;reason:string;created_at:string;side:"mentor"|"buyer";selfTest:boolean};
type Data={stats:{reviews:number;satisfaction:number|null;completed:number};profile?:{id:string;name:string;role:string};services:Service[];requests:Booking[]};
async function api(body?:unknown,profileId?:string){const r=await fetch(`/api/admin/prestations${profileId?`?profile=${profileId}`:""}`,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||"Prestations indisponibles.");return d;}
const labels:Record<string,string>={reserved:"En attente",accepted:"Acceptée",completion_pending:"Confirmation attendue",declined:"Refusée",completed:"Terminée",cancelled:"Annulée",refunded:"Remboursée"};
function Picture({service}:{service:Service["data"]}){return service.image?<img src={`/api/admin/prestations?image=${service.image}`} alt=""/>:null;}
const euro=(c:number)=>(c/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
function Author({profile}:{profile:Data["profile"]}){return profile?<a className="service-author" href={`/?mobile=discover&member=${profile.id}#directory`}><span className="service-author-avatar" aria-hidden="true">{profile.name.slice(0,1)}<img src={`/api/profile-photo?id=${profile.id}`} alt="" onError={e=>{e.currentTarget.hidden=true;}}/></span><span>Par {profile.name}</span></a>:null;}
export function PrivateServiceCatalog({profileId}:{profileId?:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[search,setSearch]=useState(""),[sort,setSort]=useState("recent"),[selected,setSelected]=useState<Service|null>(null),[compose,setCompose]=useState(false),[notes,setNotes]=useState(""),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const key=useRef(""),dialog=useRef<HTMLDialogElement>(null);
 const reset=useCallback(()=>{dialog.current?.close();setSelected(null);setCompose(false);setSent(false);setNotes("");setError("");},[]);
 const open=useCallback((s:Service)=>{setSelected(s);setCompose(false);setSent(false);setNotes("");setError("");key.current=crypto.randomUUID();},[]);
 useEffect(()=>{let live=true;void api(undefined,profileId).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[profileId]);
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();},[selected]);
 useEffect(()=> {
   if(!data) return;
   const restore=()=> {
     const id=new URLSearchParams(window.location.search).get("service");
     const service=data.services.find(s=>s.id===id&&s.data.published);
     if(service)open(service);else reset();
   };
   restore();window.addEventListener("popstate",restore);
   return ()=>window.removeEventListener("popstate",restore);
 },[data,open,reset]);
 function select(s:Service){const url=new URL(window.location.href);url.searchParams.set("service",s.id);window.history.pushState({...window.history.state,mentoraService:s.id},"",url);open(s);}
 function close(useHistory=true){
   if(useHistory&&window.history.state?.mentoraService===selected?.id)window.history.back();
   else {const url=new URL(window.location.href);url.searchParams.delete("service");window.history.replaceState(window.history.state,"",url);}
   reset();
 }
 async function request(){if(!selected||busy)return;setBusy(true);setError("");try{await api({action:"request",id:selected.id,key:key.current,notes});setSent(true);window.dispatchEvent(new Event("mentora-billing-updated"));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(profileId&&data&&data.profile?.id!==profileId)return null;
 let services=(data?.services||[]).filter(s=>s.data.published&&`${s.data.title} ${s.data.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 if(sort!=="recent")services=[...services].sort((a,b)=>sort==="asc"?a.data.credits-b.data.credits:b.data.credits-a.data.credits);
 return <section className="private-services" aria-label={profileId?"Ses prestations":"Découvrir les prestations"}>
 {profileId?<><div className="service-profile-stats"><div><strong>{data?.stats.reviews||0}</strong><small>Avis</small></div><div><strong>{data?.stats.completed||0}</strong><small>Prestations réalisées</small></div><div><strong>{data?.stats.satisfaction===null?"—":`${data?.stats.satisfaction||0} %`}</strong><small>Satisfaction · avis ≥ 4/5</small></div></div><h3>Ses prestations</h3></>:<div className="service-search"><label><Search size={18}/><input aria-label="Rechercher une prestation" placeholder="Rechercher une prestation…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Trier les prestations" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Récentes</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option></select></div>}
 {error&&!selected&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Chargement…</p>}{data&&!services.length&&<p>Aucune prestation visible pour le moment.</p>}
 <div className="service-catalog-list">{services.map(s=><article className="service-catalog-card service-listing" key={s.id}><button className="service-main" onClick={()=>select(s)}><Picture service={s.data}/><span><strong>{s.data.title}</strong><small>{s.data.description}</small><b>{s.data.credits.toLocaleString("fr-FR")} crédits</b></span><ChevronRight size={18}/></button><Author profile={s.profile}/></article>)}</div>
 <dialog ref={dialog} className="service-detail-dialog service-page-dialog" aria-label="Détail de la prestation" onCancel={e=>{e.preventDefault();if(!busy)close();}} onClose={()=>setSelected(null)}>
 {selected&&<ServiceDetailPage service={selected} stage={sent?"sent":compose?"request":"detail"} busy={busy} onBack={()=>compose&&!sent?setCompose(false):close()} onRequest={()=>setCompose(true)}>
 {sent?<><p role="status">Ta demande se trouve dans Demandes → Prestations.</p><button className="commerce-primary" onClick={()=>{close(false);window.dispatchEvent(new CustomEvent("mentora-mobile",{detail:{screen:"requests"}}));}}>Voir mes demandes</button></>:<form onSubmit={e=>{e.preventDefault();void request();}}><label>Précisions sur mon besoin (facultatif)<textarea rows={4} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ta situation, tes objectifs ou les points à préciser…"/></label><small>{notes.length}/1 000</small><div className="commerce-card"><h2>Rappel de la prestation</h2><p className="service-description">{selected.data.description}</p></div><button className="commerce-primary" disabled={busy}><Send size={18}/>{busy?"Envoi en cours…":"Envoyer la demande"}</button></form>}
 {error&&<p role="alert">{error}</p>}
 </ServiceDetailPage>}

 </dialog></section>;
}
export function PrivateServiceRequests({children}:{children:ReactNode}){
 const [tab,setTab]=useState("services");
 return <section><nav className="service-request-tabs" aria-label="Types de demandes"><button className={tab==="services"?"selected":""} onClick={()=>setTab("services")}>Prestations</button><button className={tab==="free"?"selected":""} onClick={()=>setTab("free")}>Demandes libres</button></nav>{tab==="services"?<ServiceRequests/>:children}</section>;
}
function ServiceRequests(){
 const [data,setData]=useState<Data|null>(null),[selected,setSelected]=useState<Booking|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[declining,setDeclining]=useState(false),[reason,setReason]=useState("");const dialog=useRef<HTMLDialogElement>(null);
 const requests=data?.requests.filter(r=>!["completed","refunded"].includes(r.status))||[];
 const load=useCallback(async()=>setData(await api()),[]);useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();},[selected]);
 function close(){dialog.current?.close();setSelected(null);setDeclining(false);setReason("");}
 async function decide(transition:string){if(!selected||busy)return;setBusy(true);setError("");try{const id=selected.id;await api({action:"decision",id,transition,reason});await load();close();if(["accept","complete"].includes(transition))openServiceChat(id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function discuss(){if(selected){const id=selected.id;close();openServiceChat(id);}}

 return <>{!data&&!error&&<p role="status">Chargement des demandes…</p>}<div className="service-catalog-list">{requests.map(b=><button key={b.id} className="service-catalog-card" onClick={()=>{setSelected(b);setError("");}}><Picture service={b.snapshot}/><span><strong>{b.snapshot.title}</strong><small>{b.name||data?.profile?.name}</small><b className={`service-state ${b.status}`}>{labels[b.status]||b.status}</b><small>{new Date(b.created_at).toLocaleString("fr-FR")}</small></span><ChevronRight size={18}/></button>)}</div>{data&&!requests.length&&<p>Aucune demande de prestation.</p>}{error&&!selected&&<p role="alert">{error}</p>}
 <dialog ref={dialog} className="service-detail-dialog" aria-label="Détail de la demande" onCancel={e=>{e.preventDefault();if(!busy)close();}} onClose={()=>setSelected(null)}>{selected&&<><header><button className="commerce-icon" aria-label="Fermer la demande" disabled={busy} onClick={close}><ArrowLeft/></button><strong>Demande de prestation</strong></header><div className="service-person"><span>{selected.name?.slice(0,1)||"M"}</span><strong>{selected.name}</strong></div><h2>{selected.snapshot.title}</h2><b className="service-price">{selected.credits} crédits</b><p>{labels[selected.status]}</p>{selected.notes&&<div className="commerce-card"><h3>Précisions sur le besoin</h3><p className="service-description">{selected.notes}</p></div>}{selected.reason&&<div className="commerce-card"><h3>Motif du refus</h3><p>{selected.reason}</p></div>}
 {selected.status==="reserved"&&selected.side==="mentor"&&!declining&&<><button className="commerce-primary" disabled={busy} onClick={()=>void decide("accept")}>Accepter</button><button className="commerce-row danger" disabled={busy} onClick={()=>setDeclining(true)}>Refuser</button></>}
 {declining&&<form onSubmit={e=>{e.preventDefault();void decide("decline");}}><label>Pourquoi refuses-tu ?<textarea minLength={10} maxLength={1000} required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explique le motif à la personne…"/></label><button className="commerce-primary" disabled={busy}>Envoyer le refus</button></form>}
 {selected.status==="accepted"&&selected.side==="mentor"&&<button className="commerce-primary" disabled={busy} onClick={()=>void decide("complete")}>Marquer comme terminée</button>}
 <button className="commerce-row" disabled={busy} onClick={()=>void discuss()}><MessageCircle/>Discuter en message privé</button>{error&&<p role="alert">{error}</p>}</>}</dialog></>;
}
