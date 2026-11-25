"use client";
import {useEffect,useState} from 'react';
export function ProfileBiography({value,onSaved}:{value:string;onSaved:(value:string)=>void}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setDraft(value)},[value]);
 return <>{!open?<button className="text-btn" onClick={()=>{setDraft(value);setOpen(true);setError('')}}>{value.trim()?'Modifier ma biographie':'Ajouter ma biographie'}</button>:<form className="profile-biography-editor" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/admin/profile-biography',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({bio:draft})}),d=await r.json();if(!r.ok)throw Error(d.error);onSaved(d.bio);setOpen(false);window.dispatchEvent(new Event('mentor-portfolio-updated'))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><label>Ma biographie<textarea rows={5} maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}/></label><small>{draft.length}/1 000</small>{error&&<p role="alert">{error}</p>}<div><button className="btn" disabled={busy}>Enregistrer</button><button className="btn secondary" type="button" disabled={busy} onClick={()=>setOpen(false)}>Annuler</button></div></form>}</>;
}
