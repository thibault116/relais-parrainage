"use client";
import {useEffect,useState} from "react";
export function TestWalletUpdate({onChange}:{onChange:()=>Promise<void>}){
 const [preview,setPreview]=useState<{applied:boolean;current:number;after:number;adjustments:{delta:number}[]}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>{let live=true;void fetch("/api/admin/monetization/test-wallet",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Calcul indisponible.");return r.json();}).then(d=>{if(live)setPreview(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 async function update(){setBusy(true);setError("");try{const r=await fetch("/api/admin/monetization/test-wallet",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reprice"})});const d=await r.json();if(!r.ok)throw Error(d.error);setDone(true);await onChange();window.dispatchEvent(new Event("mentora-billing-updated"));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(preview?.applied&&!preview.adjustments.length)return null;
 if(done)return <p role="status">Ton solde de test est actualisé.</p>;
 return <section className="commerce-card test-wallet-update"><strong>Nouveau barème de test</strong>{preview&&<p>{preview.current.toLocaleString("fr-FR")} → {preview.after.toLocaleString("fr-FR")} crédits</p>}<button className="commerce-row" disabled={busy||!preview} onClick={()=>void update()}>Actualiser mes crédits de test</button>{error&&<p role="alert">{error}</p>}</section>;
}
