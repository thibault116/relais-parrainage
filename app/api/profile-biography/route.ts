import {z} from 'zod';
import {guard,json,user} from '@/lib/http';
import {canUseFeature} from '@/lib/beta';
import {inTransaction} from '@/lib/db';
export const runtime='nodejs';
export async function PUT(request:Request){
 try{
  const blocked=await guard(request);if(blocked)return blocked;
  const u=await user(request);if(!u||!await canUseFeature(u.id,'memberProfiles'))return json({error:'Connecte-toi pour modifier ta biographie.'},403);
  const input=z.object({bio:z.string().trim().max(1000)}).strict().safeParse(await request.json());if(!input.success)return json({error:'La biographie doit contenir au maximum 1 000 caractères.'},400);
  await inTransaction(async q=>{
   const [p]=await q('UPDATE profiles SET updated_at=updated_at WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1) RETURNING details,role',[u.id]);if(!p)throw Error('Profil indisponible.');
   const details=JSON.parse(String(p.details));details.bio=input.data.bio;
   await q('UPDATE profiles SET details=$1,updated_at=$2 WHERE user_id=$3',[JSON.stringify(details),new Date().toISOString(),u.id]);
   if(p.role==='mentor')await q('INSERT INTO mentor_portfolios(user_id,bio) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio',[u.id,input.data.bio]);
  });
  return json({bio:input.data.bio});
 }catch{return json({error:'Impossible d’enregistrer la biographie.'},503)}
}
