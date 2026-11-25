"use client";
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import type {PublicProfile} from '@/lib/profile';
import {useOwnerPreview} from './owner-preview';
import {MentorProfileCard} from './mentor-profile';
import {FollowButton,FollowCounts} from './follows';
import {RatingSummary} from './accompaniments';
import {MobileProfileActions} from './mobile-experience';
import {ReportProfile} from './admin';
export function MemberProfilePage({profileId}:{profileId:string}){
 const owner=useOwnerPreview(),[profile,setProfile]=useState<PublicProfile|null>(null),[ownId,setOwnId]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(!owner)return;const controller=new AbortController();
  async function load(){try{const [p,m]=await Promise.all([fetch('/api/profiles?profile='+encodeURIComponent(profileId),{cache:'no-store',signal:controller.signal}),fetch('/api/me',{cache:'no-store',signal:controller.signal})]);const [pd,md]=await Promise.all([p.json(),m.json()]);if(!p.ok)throw Error(pd.error||'Profil indisponible.');if(!m.ok)throw Error(md.error||'Connexion requise.');setOwnId(md.profile?.id||'');setProfile(pd.profile)}catch(e){if(!controller.signal.aborted)setError((e as Error).message)}}void load();return()=>controller.abort();
 },[profileId,owner]);
 useEffect(()=>{const open=(event:Event)=>{const d=(event as CustomEvent).detail;if(!['messages','requests'].includes(d?.screen))return;const params=new URLSearchParams({mobile:d.screen});if(d.chat)params.set('chat',d.chat);window.location.assign('/?'+params.toString()+'#workspace')};window.addEventListener('mentora-mobile',open);return()=>window.removeEventListener('mentora-mobile',open)},[]);
 return <main className="member-profile-page"><nav aria-label="Navigation du profil"><a href="/?mobile=home#directory"><ArrowLeft size={18}/>Retour aux profils</a><a href="/?mobile=profile#profile">Mon profil</a></nav>{error?<p role="alert">{error}</p>:!owner||!profile?<p role="status">Chargement du profil…</p>:<MentorProfileCard pageHeading profile={profile} own={profile.id===ownId} onEdit={profile.id===ownId?()=>window.location.assign('/?mobile=edit#profile'):undefined} headerActions={<><FollowCounts profile={profile}/>{profile.id!==ownId&&<FollowButton profile={profile} onChange={count=>setProfile(p=>p?{...p,followerCount:count}:p)}/>}{profile.role==='mentor'&&<RatingSummary average={profile.ratingAverage} count={profile.ratingCount}/>}</>} actions={<><MobileProfileActions profileId={profile.id}/>{profile.id!==ownId&&<ReportProfile profileId={profile.id}/>}</>}/>}</main>;
}
