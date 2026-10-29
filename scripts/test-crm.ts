import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database,query} from '../lib/db';
import {migrateCrm,isCrmOwner,CRM_OWNER_EMAIL,createCrmConnection,ingestCrm,crmOverview,crmPeriodBounds,syncSchema} from '../lib/crm';
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error('Tests require an isolated local database.');
const cwd=process.cwd(),temp=mkdtempSync(join(tmpdir(),'mentora-crm-test-'));process.chdir(temp);
try{
 await query('CREATE TABLE "user"(id TEXT PRIMARY KEY,email TEXT)');await query('CREATE TABLE moderators(user_id TEXT PRIMARY KEY,email TEXT)');await migrateCrm();
 await query('INSERT INTO "user" VALUES($1,$2)',['owner',CRM_OWNER_EMAIL]);await query('INSERT INTO moderators VALUES($1,$2)',['owner',CRM_OWNER_EMAIL]);
 assert.equal(await isCrmOwner({id:'owner',email:CRM_OWNER_EMAIL}),true);assert.equal(await isCrmOwner({id:'other',email:CRM_OWNER_EMAIL}),false);assert.equal(await isCrmOwner({id:'owner',email:'other@example.invalid'}),false);assert.equal(await isCrmOwner(null),false);
 const {token}=await createCrmConnection('owner');assert.notEqual((await query('SELECT token_hash FROM crm_connections'))[0].token_hash,token);
 const sale={orderId:'101',title:'Veste',photoUrl:'',orderUrl:'https://www.vinted.fr/orders/101',amountCents:2599,currency:'EUR' as const,status:'completed' as const,soldOn:crmPeriodBounds().today};
 const batch={accountKey:'123',sales:[sale],status:'complete' as const,message:'Test',page:'https://www.vinted.fr/orders'};
 assert(syncSchema.safeParse(batch).success);assert(!syncSchema.safeParse({...batch,sales:[{...sale,photoUrl:'https://evil.example/a'}]}).success);
 await ingestCrm(token,batch);await ingestCrm(token,batch);let overview=await crmOverview('owner',0);assert.equal(overview.stats.total,1);assert.equal(overview.stats.day_cents,2599);
 await ingestCrm(token,{...batch,sales:[{...sale,amountCents:3000}]});overview=await crmOverview('owner',0);assert.equal(overview.stats.total,1);assert.equal(overview.stats.year_cents,3000);
 for(const [i,status] of ['pending','cancelled','refunded'].entries())await ingestCrm(token,{...batch,sales:[{...sale,orderId:String(200+i),status:status as 'pending'}]});
 await ingestCrm(token,{...batch,sales:[{...sale,orderId:'300',soldOn:null}]});overview=await crmOverview('owner',0);assert.equal(overview.stats.day_cents,3000);assert.equal(overview.stats.undated,1);assert.equal(overview.stats.pending_cents,2599);
 await assert.rejects(ingestCrm(token,{...batch,accountKey:'456'}),/account_mismatch/);
 const next=await createCrmConnection('owner');await assert.rejects(ingestCrm(token,batch),/unauthorized/);await ingestCrm(next.token,batch);
 await query('UPDATE crm_connections SET expires_at=$1',['2000-01-01']);await assert.rejects(ingestCrm(next.token,batch),/unauthorized/);
 await query('DELETE FROM crm_connections');const rotated=await createCrmConnection('owner');await assert.rejects(ingestCrm(rotated.token,{...batch,accountKey:'456'}),/account_mismatch/);
 assert.deepEqual(crmPeriodBounds(new Date('2026-03-31T22:30:00Z')),{today:'2026-04-01',month:'2026-04-01',quarter:'2026-04-01',year:'2026-01-01'});
 assert.equal((await crmOverview('other',0)).sales.length,0);
 console.log('CRM: owner access, token hashing/rotation/expiry, account binding, deduplication, exclusions and Paris period boundaries passed.');
}finally{const db=database();if('close'in db)db.close();process.chdir(cwd);rmSync(temp,{recursive:true,force:true});}
