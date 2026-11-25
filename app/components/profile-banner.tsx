"use client";
import {useEffect,useState} from 'react';
import {ImagePlus} from 'lucide-react';
import type {PublicProfile} from '@/lib/profile';
export function ProfileBanner({profile,editable}:{profile:PublicProfile;editable:boolean}){
 const [url,setUrl]=useState(profile.banner||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[play,setPlay]=useState(false);
 useEffect(()=>{setUrl(profile.banner||'')},[profile.id,profile.banner]);
 async function change(file?:File){setBusy(true);setError('');try{let body:FormData|undefined;if(file){if(file.size>4*1024*1024)throw Error('Choisis une bannière de 4 Mo maximum.');body=new FormData();body.append('file',file)}const r=await fetch('/api/profile-banner',{method:file?'POST':'DELETE',body}),d=await r.json();if(!r.ok)throw Error(d.error);setUrl(d.banner||'')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><div className="mentor-profile-cover custom-profile-cover" data-play={play}>{url&&<img className="profile-banner-image" src={url} alt="Bannière du profil"/>}{url&&<button className="banner-motion-play" onClick={()=>setPlay(v=>!v)}>{play?'Masquer la bannière':'Afficher la bannière'}</button>}{editable&&<div className="profile-banner-controls"><label className="banner-upload"><ImagePlus size={17}/>{busy?'Enregistrement…':url?'Changer ma bannière':'Ajouter une bannière'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Choisir ma bannière (image ou GIF)" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void change(f);e.target.value=''}}/></label>{url&&<button disabled={busy} onClick={()=>void change()}>Retirer</button>}</div>}</div>{error&&<p role="alert" className="banner-error">{error}</p>}</>;
}
