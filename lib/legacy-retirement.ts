import {inTransaction,query} from './db';
import {CRM_OWNER_EMAIL} from './crm';
export async function retireOwnerLegacyAccompaniments(){
 await query('CREATE TABLE IF NOT EXISTS legacy_retirements (accompaniment_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,snapshot TEXT NOT NULL,retired_at TEXT NOT NULL)');
 return inTransaction(async q=>{
  const owners=await q('SELECT u.id FROM "user" u JOIN moderators m ON m.user_id=u.id WHERE LOWER(u.email)=$1',[CRM_OWNER_EMAIL]);
  let count=0;
  for(const owner of owners){
   // Serialize against acceptance and retain a snapshot before cancelling. Service bookings are separate.
   await q('UPDATE profiles SET updated_at=updated_at WHERE user_id=$1',[String(owner.id)]);
   const rows=await q("SELECT * FROM accompaniments WHERE (mentor_id=$1 OR beginner_id=$1) AND status IN ('pending','active')",[String(owner.id)]);
   for(const row of rows){
    await q('INSERT INTO legacy_retirements(accompaniment_id,actor_id,snapshot,retired_at) VALUES($1,$2,$3,$4) ON CONFLICT(accompaniment_id) DO NOTHING',[String(row.id),String(owner.id),JSON.stringify(row),new Date().toISOString()]);
    const changed=await q("UPDATE accompaniments SET status='cancelled' WHERE id=$1 AND status IN ('pending','active') RETURNING id",[String(row.id)]);count+=changed.length;
   }
  }
  return count;
 });
}
