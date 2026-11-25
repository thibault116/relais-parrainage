import {memberPageData} from '@/lib/member-page-data';
import {MemberProfilePage} from '@/app/components/member-profile-page';
export default async function Page({params}:{params:Promise<{id:string}>}){return <MemberProfilePage {...await memberPageData((await params).id)}/>;}
