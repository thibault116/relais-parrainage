import {user,json} from '@/lib/http';
import {canUseFeature} from '@/lib/beta';
import {memberGuides} from '@/lib/guides-catalog';
export const runtime='nodejs';
export async function GET(r:Request){const account=await user(r);if(!account)return json({error:'Connecte-toi à Mentora pour lire les guides gratuits.'},401);if(!await canUseFeature(account.id,'guides'))return json({error:'Ces guides ne sont pas disponibles pour ce compte.'},403);return json({guides:memberGuides.map(({slug,title,number,description})=>({slug,title,number,description}))});}
