import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialProfile} from '../lib/profile';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3001';
const password='Mentora-'+randomUUID()+'!';let cookie='';
async function call(path:string,method='GET',body?:unknown){return fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});}
try{
 const signup=await call('/api/auth/sign-up/email','POST',{name:'Photo test',email:`photo-${randomUUID()}@example.invalid`,password});assert.equal(signup.status,200);cookie=signup.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 const input={...initialProfile,role:'mentor',experience:12,name:'Photo test',discord:'photo_'+randomUUID().slice(0,8),visible:false,bio:'Profil temporaire pour vérifier la confidentialité des photos.',goals:'Tester les photos de profil.'};
 const p=await call('/api/me','PUT',input);assert.equal(p.status,200);const id=(await p.json()).profile.id;
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fWQAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'photo.png');
 const upload=await fetch(base+'/api/profile-photo',{method:'POST',headers:{Origin:base,cookie},body:form});assert.equal(upload.status,200,await upload.text());
 const me=await (await call('/api/me')).json();assert.ok(me.profile.photo.startsWith('/api/profile-photo?'));assert.ok(!JSON.stringify(me).includes('verification/'));
 assert.equal((await fetch(base+me.profile.photo)).status,404);const owner=await call(me.profile.photo);assert.equal(owner.status,200);assert.deepEqual(Buffer.from(await owner.arrayBuffer()),bytes);
 assert.equal((await call('/api/me','PUT',{...input,name:'Photo modifiée',photo:{path:'fake'}})).status,200);
 assert.equal((await call(me.profile.photo)).status,200);
 if(!process.env.TEST_BASE_URL){await call('/api/me','PATCH',{visible:true});assert.equal((await fetch(base+me.profile.photo)).status,200);await call('/api/me','PATCH',{visible:false});assert.equal((await fetch(base+me.profile.photo)).status,404);}
 const bad=new FormData();bad.append('file',new Blob(['<svg></svg>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await fetch(base+'/api/profile-photo',{method:'POST',headers:{Origin:base,cookie},body:bad})).status,400);
 assert.equal((await call('/api/profile-photo','DELETE')).status,200);assert.equal((await call('/api/profile-photo?id='+id)).status,404);
 console.log('PASS : import, lecture propriétaire, photo masquée, visibilité, conservation lors des modifications, refus SVG, suppression.');
}finally{if(cookie){const r=await call('/api/auth/delete-user','POST',{password});assert.equal(r.status,200);console.log('Compte temporaire supprimé.');}}
