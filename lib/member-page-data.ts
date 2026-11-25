import 'server-only';
import {notFound,redirect} from 'next/navigation';
import {ownerPreviewUserId} from './owner-preview';
import {query} from './db';
import {GET as profiles} from '@/app/api/profiles/route';
import type {PublicProfile} from './profile';
export async function memberPageData(id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const owner=await ownerPreviewUserId();if(!owner)redirect('/?mobile=home&member='+encodeURIComponent(id)+'#directory');
 const [response,own]=await Promise.all([profiles(new Request('http://internal/api/profiles?profile='+encodeURIComponent(id))),query('SELECT id FROM profiles WHERE user_id=$1',[owner])]);
 if(response.status===404)notFound();if(!response.ok)throw Error('Profil temporairement indisponible.');
 return {initialProfile:(await response.json()).profile as PublicProfile,ownId:String(own[0]?.id||'')};
}
