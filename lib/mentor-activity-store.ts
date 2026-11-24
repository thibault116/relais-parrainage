import {query,inTransaction} from './db';
import {mentorActivityInput,emptyMentorActivity} from './mentor-activity';
export async function saveMentorActivity(owner:string,input:unknown){
 const d=mentorActivityInput.parse(input);
 return inTransaction(async q=>{
  // Row lock shared with profile edits; never accept a client-supplied owner id.
  const rows=await q("UPDATE profiles SET updated_at=updated_at WHERE user_id=$1 AND role='mentor' AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1) RETURNING details",[owner]);
  if(!rows.length)throw Error('Compte parrain requis.');
  const details=JSON.parse(String(rows[0].details));details.bio=d.bio;
  await q('UPDATE profiles SET details=$1,updated_at=$2 WHERE user_id=$3',[JSON.stringify(details),new Date().toISOString(),owner]);
  await q('INSERT INTO mentor_activities(user_id,answers,updated_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers,updated_at=excluded.updated_at',[owner,JSON.stringify(d.activity),new Date().toISOString()]);
  await q("INSERT INTO mentor_portfolios(user_id,bio) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio",[owner,d.bio]);
  return d;
 });
}
export async function readMentorActivity(owner:string){
 const [p]=await query("SELECT p.details,(SELECT bio FROM mentor_portfolios WHERE user_id=p.user_id) AS biography,(SELECT answers FROM mentor_activities WHERE user_id=p.user_id) AS activity FROM profiles p WHERE p.user_id=$1 AND p.role='mentor' AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1)",[owner]);
 if(!p)throw Error('Compte parrain requis.');
 const details=JSON.parse(String(p.details)),seed=emptyMentorActivity();
 const legacy=details.resell;
 if(!p.activity&&legacy?.version===2){const map:Record<string,string>={manual:'manual',bot:'bot',mainstream:'wholesale',flea:'flea'};seed.methods=[...new Set((legacy.selections?.methods||[]).map((id:string)=>map[id]).filter(Boolean))] as typeof seed.methods;if(legacy.selections?.methods?.includes('other')&&legacy.other?.methods){seed.methods.push('other');seed.methodOther=legacy.other.methods;}}
 return {activity:p.activity?JSON.parse(String(p.activity)):seed,completed:!!p.activity,bio:p.biography===null?details.bio||'':String(p.biography)};
}
