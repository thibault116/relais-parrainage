"use client";
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import type {PublicProfile} from '@/lib/profile';
import {useRouter,usePathname} from 'next/navigation';
import Link from 'next/link';
import {MentorProfileCard} from './mentor-profile';
import {FollowButton,FollowCounts} from './follows';
import {RatingSummary} from './accompaniments';
import {MobileProfileActions} from './mobile-experience';
import {ReportProfile} from './admin';
export function MemberProfilePage({initialProfile,ownId,intercepted=false}:{initialProfile:PublicProfile;ownId:string;intercepted?:boolean}){
 const pathname=usePathname(),active=pathname.startsWith("/membres/");
 const router=useRouter(),[profile,setProfile]=useState<PublicProfile>(initialProfile);
 useEffect(()=>{setProfile(initialProfile)},[initialProfile]);
 useEffect(()=>{if(!intercepted||!active)return;const root=document.getElementById('workspace-route'),overflow=document.body.style.overflow;if(root)root.inert=true;document.body.style.overflow='hidden';return()=>{if(root)root.inert=false;document.body.style.overflow=overflow}},[intercepted,active]);
 useEffect(()=>{const open=(event:Event)=>{const d=(event as CustomEvent).detail;if(!['messages','requests'].includes(d?.screen))return;const params=new URLSearchParams({mobile:d.screen});if(d.chat)params.set('chat',d.chat);window.location.assign('/?'+params.toString()+'#workspace')};window.addEventListener('mentora-mobile',open);return()=>window.removeEventListener('mentora-mobile',open)},[]);
 if(intercepted&&!active)return null;
 return <div className={intercepted?"member-route-surface":"member-direct-surface"}><main className="member-profile-page"><nav aria-label="Navigation du profil">{intercepted?<button onClick={()=>router.back()}><ArrowLeft size={18}/>Retour aux profils</button>:<Link href="/?mobile=home#directory"><ArrowLeft size={18}/>Retour aux profils</Link>}<Link replace scroll={false} href={ownId?`/membres/${ownId}`:"/?mobile=profile#profile"}>Mon profil</Link></nav><MentorProfileCard pageHeading profile={profile} own={profile.id===ownId} onEdit={profile.id===ownId?()=>window.location.assign('/?mobile=edit#profile'):undefined} headerActions={<><FollowCounts profile={profile}/>{profile.id!==ownId&&<FollowButton profile={profile} onChange={count=>setProfile(p=>p?{...p,followerCount:count}:p)}/>}{profile.role==='mentor'&&<RatingSummary average={profile.ratingAverage} count={profile.ratingCount}/>}</>} actions={profile.id!==ownId?<><MobileProfileActions profileId={profile.id}/><ReportProfile profileId={profile.id}/></>:undefined}/></main></div>;
}
