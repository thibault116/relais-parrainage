import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {query} from '../lib/db';
import {canUseFeature} from '../lib/beta';
const base='http://127.0.0.1:3000';
if(process.env.DATABASE_URL)throw Error('Local database only');
const suffix=randomUUID(),password='Mentora-test-local-2026!';
async function call(path:string,method='GET',body?:unknown,cookie='',origin=base){const r=await fetch(base+path,{method,headers:{Origin:origin,...cookie?{cookie}:{},...body instanceof FormData?{}:{'Content-Type':'application/json'}},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
const accounts:{id:string,cookie:string}[]=[];
async function member(n:number){const a=await call('/api/auth/sign-up/email','POST',{name:'Test bêta',email:`beta-${suffix}-${n}@example.invalid`,password});assert.equal(a.status,200);const u={id:a.data.user.id,cookie:a.cookie};accounts.push(u);return u;}
function form(kind='bug',attachment=false){const f=new FormData();f.set('id',randomUUID());f.set('kind',kind);f.set('page','community');f.set('message','Un retour fictif pour tester le programme bêta.');if(attachment)f.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],'capture.png',{type:'image/png'}));return f;}
try{
 const a=await member(1),b=await member(2);
 assert.equal((await call('/api/beta')).status,401);
 assert.equal((await call('/api/beta','GET',undefined,a.cookie)).data.enabled,false);
 assert.equal(await canUseFeature(a.id,'futureFeature'),false);
 assert.equal(await canUseFeature(a.id,'community'),true);
 assert.equal((await call('/api/suggestions','POST',form(),a.cookie)).status,403);
 assert.equal((await call('/api/beta','PUT',{enabled:true},a.cookie,'https://wrong.invalid')).status,403);
 assert.equal((await call('/api/beta','PUT',{enabled:true,userId:b.id},a.cookie)).status,400);
 assert.equal((await call('/api/beta','PUT',{enabled:true},a.cookie)).status,200);
 assert.equal((await call('/api/beta','GET',undefined,a.cookie)).data.enabled,true);
 assert.equal((await call('/api/beta','GET',undefined,b.cookie)).data.enabled,false);
 assert.equal(await canUseFeature(a.id,'futureFeature'),true);
 const f=form('bug',true);const id=String(f.get('id'));
 const sent=await call('/api/suggestions','POST',f,a.cookie);assert.equal(sent.status,201,JSON.stringify(sent.data));
 assert.equal((await call('/api/suggestions','POST',f,a.cookie)).status,201);
 assert.equal((await query('SELECT id FROM suggestions WHERE id=$1',[id])).length,1);
 assert.equal((await query('SELECT kind FROM suggestions WHERE id=$1',[id]))[0].kind,'bug');
 assert.equal((await call('/api/suggestions','POST',form('idea'),a.cookie)).status,201);
 assert.equal((await call('/api/suggestions','GET',undefined,a.cookie)).status,403);
 assert.equal((await call('/api/suggestions?file='+id,'GET',undefined,b.cookie)).status,403);
 await query('INSERT INTO moderators(user_id) VALUES($1)',[b.id]);
 const list=await call('/api/suggestions','GET',undefined,b.cookie);assert.equal(list.status,200);assert.ok(list.data.items.some((s:{id:string;kind:string;attachment:unknown})=>s.id===id&&s.kind==='bug'&&s.attachment));
 const download=await fetch(base+'/api/suggestions?file='+id,{headers:{cookie:b.cookie}});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'image/png');
 assert.equal((await call('/api/beta','PUT',{enabled:false},a.cookie)).status,200);
 assert.equal(await canUseFeature(a.id,'futureFeature'),false);
 assert.equal((await call('/api/suggestions','POST',form(),a.cookie)).status,403);
 assert.equal((await query('SELECT id FROM suggestions WHERE id=$1',[id])).length,1);
 console.log('Beta checks passed: default off, account ownership, opt-in/out persistence, CSRF, future-feature gates, private bug/idea uploads, admin download, idempotence and retained feedback.');
}finally{
 for(const a of accounts){await query('DELETE FROM moderators WHERE user_id=$1',[a.id]);await call('/api/auth/delete-user','POST',{password},a.cookie);assert.equal((await query('SELECT user_id FROM beta_preferences WHERE user_id=$1',[a.id])).length,0);}
}
