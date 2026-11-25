import {notFound,redirect} from 'next/navigation';
import {ownerPreviewUserId} from '@/lib/owner-preview';
import {MemberProfilePage} from '@/app/components/member-profile-page';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 if(!await ownerPreviewUserId())redirect('/?mobile=home&member='+encodeURIComponent(id)+'#directory');
 return <MemberProfilePage profileId={id}/>;
}
