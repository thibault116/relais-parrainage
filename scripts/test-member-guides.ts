import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCipheriv,randomBytes} from 'node:crypto';
import {brotliCompressSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {query,database} from '../lib/db';
import {getAuth} from '../lib/auth';
import {getMigrations} from 'better-auth/db/migration';
import {GET as list} from '../app/api/guides/route';
import {GET as content} from '../app/api/guides/[slug]/route';
import {memberGuides,guideLink} from '../lib/guides-catalog';
import {workspaceGroups} from '../app/components/workspace-destinations';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Isolated local tests only');
const cwd=process.cwd(),directory=await mkdtemp(join(tmpdir(),'mentora-guides-test-'));process.chdir(directory);
try{
 const files:Record<string,string>={};for(const g of memberGuides){files[g.file]=Buffer.from('<html><head></head><body><img src="haut_mauvais.png"><p>'+g.title+'</p><a href="https://example.com/produit">Produit</a></body></html>').toString('base64');}files['haut_mauvais.png']=Buffer.from('image fixture').toString('base64');files['02_materiel_indispensable_corrige.pdf']=Buffer.from('%PDF-fixture').toString('base64');
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(brotliCompressSync(Buffer.from(JSON.stringify(files)))),cipher.final()]);process.env.GUIDES_CONTENT_ENCRYPTION_KEY=key.toString('base64');await mkdir('content');await writeFile('content/guides.bundle.enc',Buffer.concat([Buffer.from('MG01'),iv,cipher.getAuthTag(),encrypted]));
 const auth=getAuth();await(await getMigrations(auth.options)).runMigrations();await query('CREATE TABLE moderators(user_id TEXT PRIMARY KEY)');await query('CREATE TABLE member_activity(user_id TEXT PRIMARY KEY,last_active_at TEXT NOT NULL)');
 let session:any=null;const sessionMock=mock.method(auth.api,'getSession',async()=>session);
 const request=(download=false)=>new Request(`http://localhost/api/guides/se-lancer-achat-revente${download?'?download=1':''}`),params=(slug:string)=>({params:Promise.resolve({slug})});
 for(const u of [null,{id:'member',email:'member@example.com'},{id:'moderator',email:'moderator@example.com'},{id:'owner',email:'thibault.cordiez@hotmail.com'}]){
  session=u?{user:u}:null;if(u?.id==='moderator')await query('INSERT INTO moderators(user_id) VALUES($1)',[u.id]);
  const expected=u?200:401;assert.equal((await list(request())).status,expected);assert.equal((await content(request(),params('se-lancer-achat-revente'))).status,expected);assert.equal((await content(request(true),params('se-lancer-achat-revente'))).status,u?403:401);
 }
 await query('INSERT INTO moderators(user_id) VALUES($1)',['owner']);session={user:{id:'owner',email:'thibault.cordiez@hotmail.com'}};
 const index=await list(request());assert.equal(index.status,200);assert.equal((await index.json()).guides.length,4);
 for(const g of memberGuides){const response=await content(request(),params(g.slug));assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/no-store/);const d=await response.json();assert.deepEqual(d.missing,[]);assert(d.html.includes('width=device-width'));assert(!/<img\b[^>]*src="(?!data:image\/)/i.test(d.html));assert(!d.html.includes('<script'));const link=new URL(guideLink('https://mentora-resell.vercel.app',g.slug));assert.equal(link.searchParams.get('guide'),g.slug);assert.equal(link.searchParams.get('mobile'),'guides');assert.equal(link.hash,'#workspace');}
 assert.equal((await content(request(),params('../../.env.local'))).status,404);
 for(const g of memberGuides){const blocked=await content(request(true),params(g.slug));assert.equal(blocked.status,403);assert.equal(blocked.headers.get('content-disposition'),null);assert.match((await blocked.json()).error,/uniquement dans Mentora/);}
 assert(workspaceGroups(false,false,false,true).some(g=>g.items.some(i=>i.screen==='guides')));assert(workspaceGroups(true,true,true,true).find(g=>g.title==='Général')!.items.some(i=>i.screen==='guides'));
 sessionMock.mock.restore();console.log('PASS: four guides and images, authenticated reading and blocked downloads, all member roles, unknown slugs, share links and navigation.');
}finally{mock.restoreAll();const db=database();if(db instanceof DatabaseSync)db.close();process.chdir(cwd);await rm(directory,{recursive:true,force:true});}
