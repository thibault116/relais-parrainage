import {z} from 'zod';
import {user,guard,json} from '@/lib/http';
import {canUseFeature} from '@/lib/beta';
import {readMentorActivity,saveMentorActivity} from '@/lib/mentor-activity-store';
export const runtime='nodejs';
async function actor(r:Request){const u=await user(r);return u&&await canUseFeature(u.id,'mentorActivity')?u:null;}
export async function GET(r:Request){const u=await actor(r);if(!u)return json({error:'Connexion requise.'},403);try{return json(await readMentorActivity(u.id));}catch{return json({error:'Compte parrain requis.'},403);}}
export async function PUT(r:Request){const denied=await guard(r);if(denied)return denied;const u=await actor(r);if(!u)return json({error:'Connexion requise.'},403);try{return json({...await saveMentorActivity(u.id,await r.json()),completed:true});}catch(e){return json({error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error&&e.message==='Compte parrain requis.'?e.message:'Enregistrement impossible.'},e instanceof Error&&e.message==='Compte parrain requis.'?403:400);}}
