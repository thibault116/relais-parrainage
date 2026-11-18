'use client';
import {useCallback,useEffect,useState,useRef} from 'react';
import {BookOpen,ArrowUpRight,Copy,Check,ChevronLeft,Maximize2,Minimize2} from 'lucide-react';
import {guideLink} from '@/lib/guides-catalog';
type Guide={slug:string;title:string;number:string;description:string};
type Document={slug:string;title:string;html:string;pdf:boolean;missing:string[]};
async function read(url:string,signal:AbortSignal){const r=await fetch(url,{cache:'no-store',signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Lecture impossible.');return d;}
export function MemberGuides({onNavigate,onBack}:{onNavigate:(slug:string)=>void;onBack:()=>void}){
 const reader=useRef<HTMLIFrameElement>(null),readerObserver=useRef<ResizeObserver|null>(null);
 const [readerHeight,setReaderHeight]=useState(600);
 useEffect(()=>()=>readerObserver.current?.disconnect(),[]);
 function fitReader(){readerObserver.current?.disconnect();const body=reader.current?.contentDocument?.body;if(!body)return;const measure=()=>setReaderHeight(Math.ceil(body.getBoundingClientRect().height)+2);measure();readerObserver.current=new ResizeObserver(measure);readerObserver.current.observe(body);}
 const [guides,setGuides]=useState<Guide[]>([]),[slug,setSlug]=useState(()=>typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('guide')||''),[doc,setDoc]=useState<Document|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[copied,setCopied]=useState(''),[fallback,setFallback]=useState(''),[full,setFull]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const restore=()=>{setSlug(new URLSearchParams(window.location.search).get('guide')||'');setFull(false);};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
 useEffect(()=>{const c=new AbortController();setBusy(true);setError('');setDoc(null);void (async()=>{try{if(slug)setDoc(await read(`/api/guides/${encodeURIComponent(slug)}`,c.signal));else setGuides((await read('/api/guides',c.signal)).guides);}catch(e){if(!c.signal.aborted)setError((e as Error).message);}finally{if(!c.signal.aborted)setBusy(false);}})();return()=>c.abort();},[slug,retry]);
 useEffect(()=>{if(!full)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setFull(false);};document.addEventListener('keydown',escape);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=old;};},[full]);
 const select=useCallback((id:string)=>{setSlug(id);setCopied('');setFallback('');setFull(false);onNavigate(id);},[onNavigate]);
 async function copy(id:string){const link=guideLink(window.location.origin,id);try{await navigator.clipboard.writeText(link);setCopied(id);setFallback('');}catch{setFallback(link);setCopied('');}}
 return <section className={`member-guides${full?' guide-fullscreen':''}`} aria-label="Guides Mentora">
 <div className="guides-toolbar"><button className="mobile-back" onClick={()=>slug?select(''):onBack()}><ChevronLeft size={18}/>{slug?'Tous les guides':'Retour'}</button>{doc&&<div className="guides-tools"><button className="btn secondary" onClick={()=>void copy(doc.slug)}>{copied===doc.slug?<Check size={17}/>:<Copy size={17}/>}<span>{copied===doc.slug?'Lien copié':'Copier le lien'}</span></button><button className="btn secondary" onClick={()=>setFull(!full)} aria-label={full?'Quitter le plein écran':'Lire en plein écran'}>{full?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button></div>}</div>
 {fallback&&<label className="guides-copy-fallback">Copie ce lien<input readOnly value={fallback} onFocus={e=>e.currentTarget.select()}/></label>}
 <header className="guides-heading"><span className="guides-eyebrow">LES GUIDES MENTORA</span><h1>{doc?.title||'Guides'}</h1>{!slug&&<p>Des repères concrets pour progresser dans l’achat-revente.</p>}</header>
 {copied&&<span role="status" className="guides-copy-status">Lien du guide copié.</span>}{error&&<div role="alert" className="commerce-card"><p>{error}</p><button className="btn secondary" onClick={()=>setRetry(n=>n+1)}>Réessayer</button></div>}
 {busy&&<p role="status">Chargement du guide…</p>}
 {!slug&&!busy&&!error&&<div className="guides-grid">{guides.map(g=><article className="guide-card" key={g.slug}><div className="guide-card-top"><span className="guide-number">GUIDE {g.number}</span><BookOpen size={28}/></div><h2>{g.title}</h2><p>{g.description}</p><div className="guide-card-actions"><button className="btn" onClick={()=>select(g.slug)}>Lire le guide<ArrowUpRight size={17}/></button><button className="btn secondary" aria-label={`Copier le lien : ${g.title}`} onClick={()=>void copy(g.slug)}>{copied===g.slug?<Check size={18}/>:<Copy size={18}/>}</button></div></article>)}</div>}
 {doc&&!busy&&!error&&<iframe ref={reader} onLoad={fitReader} style={full?undefined:{height:readerHeight,minHeight:0}} className="guide-reader" title={doc.title} srcDoc={doc.html} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"/>}
 </section>;
}
