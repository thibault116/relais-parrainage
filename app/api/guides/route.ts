import {user,json} from '@/lib/http';
import {isCrmOwner} from '@/lib/crm';
import {memberGuides} from '@/lib/guides-catalog';
export const runtime='nodejs';
export async function GET(r:Request){if(!await isCrmOwner(await user(r)))return json({error:'Ces guides sont réservés au compte administrateur principal pour le moment.'},403);return json({guides:memberGuides.map(({slug,title,number,description})=>({slug,title,number,description}))});}
