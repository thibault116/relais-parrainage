import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import webpush from 'web-push';
import {query} from '../lib/db';
import {postCommunity,communityMessages,deleteCommunity,editCommunity} from '../lib/community';
import {runPushWorker} from '../lib/push';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Local tests only');
const ids=Array.from({length:4},()=>randomUUID()),saved=webpush.sendNotification;
const prefix=randomUUID().slice(0,8),name='Léa. (test) '+prefix;
const sent:{endpoint:string;payload:string}[]=[];
const old=[process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY,process.env.VAPID_SUBJECT];
try{
 for(let i=0;i<ids.length;i++)await query(`INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$1,$1,$2,$3,'{}',1,$4)`,[ids[i],i===3?'beginner':'mentor',i===1?name:'Push test '+prefix+' '+i,new Date().toISOString()]);
 for(let i=0;i<2;i++)await query(`INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,label,created_at) VALUES($1,$2,$3,'test','test','Test',$4)`,[randomUUID(),ids[1],`https://fcm.googleapis.com/test-${prefix}-${i}`,new Date().toISOString()]);
 const id=await postCommunity(ids[0],`Bonjour @${name}, merci pour ton aide !`,[]);
 assert.equal((await query('SELECT * FROM community_mentions WHERE message_id=$1',[id])).length,1,'Typed @ must resolve the exact unique name, punctuation included');
 assert.equal((await query('SELECT * FROM push_outbox WHERE event_id=$1',[id])).length,2,'Every registered device gets a job');
 process.env.VAPID_PUBLIC_KEY='test';process.env.VAPID_PRIVATE_KEY='test';process.env.VAPID_SUBJECT='mailto:test@example.invalid';
 webpush.sendNotification=(async(sub,payload)=>{sent.push({endpoint:sub.endpoint,payload:String(payload)});return {statusCode:201,body:'',headers:{}};}) as typeof saved;
 assert.equal((await runPushWorker(id)).sent,2);assert.equal(sent.length,2);
 assert.ok(sent.every(s=>JSON.parse(s.payload).url.includes('communityMentions=1')));
 assert.ok(sent.every(s=>!s.payload.includes(name)),'No private member content in notification');
 assert.equal((await runPushWorker(id)).sent,0,'No duplicate sends');
 await editCommunity(ids[0],id,'Conseil corrigé');assert.equal((await runPushWorker(id)).sent,0);
 assert.ok((await communityMessages(ids[0])).messages.find(m=>m.id===id)?.editedAt);
 const reply=await postCommunity(ids[2],'Merci pour le conseil',[],id);
 assert.equal((await communityMessages(ids[2])).messages.find(m=>m.id===reply)?.reply?.body,'Conseil corrigé');
 await assert.rejects(()=>postCommunity(ids[3],'Hors salon',[],id));
 await deleteCommunity(ids[0],id);assert.equal((await communityMessages(ids[2])).messages.find(m=>m.id===reply)?.reply?.body,'Message indisponible');
 console.log('Typed mentions, two-device delivery, notification link, privacy, deduplication, edit, replies, deleted parents and cross-room denial passed with a simulated push provider.');
}finally{
 webpush.sendNotification=saved;
 for(const [i,key] of ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'].entries()){if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
 for(const id of ids){await query('DELETE FROM push_outbox WHERE user_id=$1',[id]);await query('DELETE FROM push_subscriptions WHERE user_id=$1',[id]);await query('DELETE FROM community_mentions WHERE user_id=$1 OR message_id IN(SELECT id FROM community_messages WHERE author_id=$1)',[id]);await query('DELETE FROM community_messages WHERE author_id=$1',[id]);await query('DELETE FROM profiles WHERE user_id=$1',[id]);}
}
