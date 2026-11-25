import 'server-only';
import {notFound} from 'next/navigation';
import {headers} from 'next/headers';
import {getAuth} from './auth';
import {query} from './db';
import {GET as profiles} from '@/app/api/profiles/route';
import type {PublicProfile} from './profile';
export async function memberPageData(id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const session=await getAuth().api.getSession({headers:await headers()});
 const [response,own]=await Promise.all([profiles(new Request('http://internal/api/profiles?profile='+encodeURIComponent(id))),session?query('SELECT id FROM profiles WHERE user_id=$1',[session.user.id]):Promise.resolve([])]);
 if(response.status===404)notFound();if(!response.ok)throw Error('Profil temporairement indisponible.');
 return {initialProfile:(await response.json()).profile as PublicProfile,ownId:String(own[0]?.id||''),signedIn:!!session};
}
