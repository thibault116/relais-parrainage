import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type Stripe from "stripe";
import {getAuth} from "../lib/auth";
import {getMigrations} from "better-auth/db/migration";
import {database,migrateProfiles,migrateAccompaniments,query as raw} from "../lib/db";
import {withMoneyMode} from "../lib/monetization/mode";
import {query} from "../lib/monetization/db";
import {migrateMonetization,saveService,entry,balance,book,bookingAction,confirmService} from "../lib/monetization/store";
import {checkout,handleEvent,recordRefund} from "../lib/monetization/payments";
import {commerceActor,allowedPurchase} from "../lib/monetization/access";
import {adminCreditOffer} from "../lib/monetization/catalog";
import {eligibleSql} from "../lib/monetization/earnings";
import {manualBankOverview,saveBankDetails,requestBankTransfer} from "../lib/monetization/manual-bank";
import {GET as catalog,POST as servicePOST} from "../app/api/admin/prestations/route";
import {GET as chatGET,POST as chatPOST} from "../app/api/admin/prestations/chat/route";
import {POST as moneyPOST} from "../app/api/admin/monetization/route";
import {GET as offersGET} from "../app/api/offers/route";
import {workspaceGroups} from "../app/components/workspace-destinations";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error("Isolated local tests only");
const cwd=process.cwd(),env={...process.env},dir=await mkdtemp(join(tmpdir(),"mentora-member-commerce-"));process.chdir(dir);
try{
 const auth=getAuth();await(await getMigrations(auth.options)).runMigrations();
 await migrateProfiles();await migrateAccompaniments();
 await raw("CREATE TABLE legal_checkout_acceptances(order_id TEXT PRIMARY KEY,owner_id TEXT,version TEXT,offer TEXT,amount_cents INTEGER,credits INTEGER,period TEXT,accepted_at TEXT)");
 await raw("CREATE TABLE IF NOT EXISTS moderators(user_id TEXT PRIMARY KEY,email TEXT)");
 await raw("CREATE TABLE IF NOT EXISTS member_activity(user_id TEXT PRIMARY KEY,last_active_at TEXT)");
 await raw("CREATE TABLE IF NOT EXISTS profile_blocks(user_id TEXT PRIMARY KEY)");
 await raw("CREATE TABLE IF NOT EXISTS hidden_ratings(accompaniment_id TEXT PRIMARY KEY)");
 await raw("CREATE TABLE IF NOT EXISTS push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT)");
 await raw("CREATE TABLE IF NOT EXISTS push_outbox(id TEXT PRIMARY KEY,subscription_id TEXT,user_id TEXT,event_id TEXT,kind TEXT,url TEXT,created_at TEXT)");
 await withMoneyMode("test",migrateMonetization);await withMoneyMode("live",migrateMonetization);
 async function account(email:string,role:string){const r=await auth.api.signUpEmail({body:{email,name:"Fixture",password:"fixture-password-123456"},asResponse:true});const id=String((await r.json()).user.id);await raw("INSERT INTO profiles(id,user_id,discord,role,name,details,updated_at) VALUES($1,$2,$2,$3,'Fixture','{}',$4)",[crypto.randomUUID(),id,role,new Date().toISOString()]);return {id,email,cookie:r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};}
 const admin=await account("thibault.cordiez@hotmail.com","mentor"),mentor=await account("mentor@example.test","mentor"),buyer=await account("buyer@example.test","beginner"),outsider=await account("outsider@example.test","beginner");
 await raw("INSERT INTO moderators VALUES($1,$2)",[admin.id,admin.email]);
 process.env.MENTORA_BILLING_MODE="live";process.env.MENTORA_MEMBER_COMMERCE_ENABLED="true";process.env.MENTORA_MEMBER_COMMERCE_AUTHORIZATION_REFERENCE="fixture-owner-approval";
 process.env.STRIPE_LIVE_SECRET_KEY="sk_live_fixture_not_real";process.env.STRIPE_LIVE_WEBHOOK_SECRET="whsec_fixture";process.env.MENTORA_LIVE_TERMS_VERSION="2026-11-10.1";process.env.MENTORA_LIVE_PAYOUT_CENTS="1.6";process.env.BANK_DETAILS_ENCRYPTION_KEY="ab".repeat(32);
 const url="http://localhost:3000/api/admin/prestations";
 const req=(u:typeof buyer,body:unknown,path=url,origin="http://localhost:3000")=>new Request(path,{method:"POST",headers:{cookie:u.cookie,origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
 const read=(u:typeof buyer,path=url)=>new Request(path,{headers:{cookie:u.cookie}});
 assert(await commerceActor(buyer));assert.equal(await withMoneyMode("test",()=>commerceActor(buyer)),null);
 const offers=await(await offersGET(read(buyer,"http://localhost:3000/api/offers"))).json();assert.equal(offers.offers.length,4);assert(offers.offers.every((o:any)=>o.season==="launch"));assert.deepEqual(offers.seasons.map((s:any)=>s.id),["launch"]);
 for(const code of [adminCreditOffer.id,"credits-v3-black-friday-510","credits-v3-standard-500"]){assert(!allowedPurchase(code,false));await assert.rejects(()=>checkout(buyer.id,code,crypto.randomUUID()),/indisponible/);}
 assert(allowedPurchase(adminCreditOffer.id,true));
 const data={title:"Audit dressing",description:"Analyse des annonces et conseils personnalisés.",category:"Autre",duration:0,calls:0,followup:"",availability:"À convenir",credits:100,capacity:1,published:true};

 // Public free services: no balance, no debit, no remuneration, normal two-party completion.
 const freeData={...data,credits:0,capacity:3};
 const freeResponse=await moneyPOST(req(mentor,{action:"save",service:freeData},"http://localhost:3000/api/admin/monetization"));assert.equal(freeResponse.status,200);const freeId=(await freeResponse.json()).id;
 assert.equal((await moneyPOST(req(mentor,{action:"save",service:{...freeData,credits:-1}},"http://localhost:3000/api/admin/monetization"))).status,400);
 assert.equal(await balance(query,buyer.id),0);
 const freeKey=crypto.randomUUID(),freeBooking=await book(buyer.id,freeId,freeKey,"","À convenir");assert.equal(await book(buyer.id,freeId,freeKey,"","À convenir"),freeBooking);
 await bookingAction(mentor.id,freeBooking,"accept");assert.equal((await manualBankOverview(mentor.id)).pendingCents,0);await bookingAction(mentor.id,freeBooking,"complete");await confirmService(buyer.id,freeBooking,1,true);
 assert.equal((await query("SELECT payout_cents FROM money_bookings WHERE id=$1",[freeBooking]))[0].payout_cents,0);assert.equal((await manualBankOverview(mentor.id)).availableCents,0);assert.equal((await query(eligibleSql,[mentor.id])).length,0);
 const freeCancelled=await book(buyer.id,freeId,crypto.randomUUID(),"","À convenir");await bookingAction(buyer.id,freeCancelled,"cancel");
 const freeDeclined=await book(buyer.id,freeId,crypto.randomUUID(),"","À convenir");await bookingAction(mentor.id,freeDeclined,"decline","Indisponible cette semaine.");
 assert.equal(await balance(query,buyer.id),0);assert.equal((await query("SELECT id FROM money_ledger WHERE owner_id=$1",[buyer.id])).length,0);
 assert(String((await query("SELECT body FROM money_service_messages WHERE booking_id=$1 AND kind='accepted'",[freeBooking]))[0].body).includes('gratuite'));
 await query("UPDATE money_services SET archived=1 WHERE id=$1",[freeId]);
 console.log("PASS public free service creation, zero-balance booking and replay, accept/two-party completion, cancel/decline, no credit ledger or withdrawable remuneration; negative prices refused");
 const service=await saveService(mentor.id,data),hidden=await saveService(mentor.id,{...data,published:false});
 const cat=await(await catalog(read(buyer))).json();assert.equal(cat.services.length,1);assert.equal(cat.services[0].id,service);assert(!cat.services.some((s:any)=>s.id===hidden));
 assert.equal((await moneyPOST(req(buyer,{action:"save",service:data},"http://localhost:3000/api/admin/monetization"))).status,403);
 assert.equal((await servicePOST(req(buyer,{},url,"https://foreign.test"))).status,403);
 await entry(query,buyer.id,500,"Fixture","fixture-buyer");await entry(query,outsider.id,500,"Fixture","fixture-outsider");
 const key=crypto.randomUUID(),id=await book(buyer.id,service,key,"","À convenir");assert.equal(await book(buyer.id,service,key,"","À convenir"),id);assert.equal(await balance(query,buyer.id),400);
 await assert.rejects(()=>book(outsider.id,service,crypto.randomUUID(),"","À convenir"),/disponibilité/);
 await assert.rejects(()=>bookingAction(buyer.id,id,"accept"),/parrain/);await assert.rejects(()=>bookingAction(outsider.id,id,"accept"),/introuvable/);
 const chatURL="http://localhost:3000/api/admin/prestations/chat";
 assert.equal((await chatGET(read(outsider,chatURL+"?id="+id))).status,404);
 assert.equal((await chatGET(read(mentor,chatURL+"?id="+id))).status,200);
 await bookingAction(mentor.id,id,"accept");assert.equal((await manualBankOverview(mentor.id)).pendingCents,160);assert.equal((await query(eligibleSql,[mentor.id])).length,0);
 await bookingAction(mentor.id,id,"complete");await assert.rejects(()=>confirmService(mentor.id,id,1,true),/acheteur/);await confirmService(buyer.id,id,1,false);
 await bookingAction(mentor.id,id,"complete");await assert.rejects(()=>confirmService(buyer.id,id,1,true),/active/);await confirmService(buyer.id,id,2,true);await assert.rejects(()=>confirmService(buyer.id,id,2,true),/active/);
 assert.equal((await query(eligibleSql,[mentor.id])).length,1);assert.equal((await manualBankOverview(mentor.id)).availableCents,160);
 const msg=await chatPOST(req(buyer,{action:"send",id,role:"mentor",body:"Un message du débutant",key:crypto.randomUUID()},chatURL));assert.equal(msg.status,200);assert.equal((await query("SELECT role FROM money_service_messages WHERE body='Un message du débutant'"))[0].role,"buyer");
 await saveBankDetails(mentor.id,{holder:"Fixture Test",country:"FR",iban:"FR1420041010050500013M02606"});const transfer=await requestBankTransfer(mentor.id,crypto.randomUUID());assert.equal(transfer.amount_cents,160);await assert.rejects(()=>requestBankTransfer(mentor.id,crypto.randomUUID()),/Aucun gain/);
 // Refusal restores once, mandatory reason enforced at API boundary.
 const second=await book(buyer.id,service,crypto.randomUUID(),"","À convenir");assert.equal((await servicePOST(req(mentor,{action:"decision",id:second,transition:"decline",reason:""}))).status,400);await bookingAction(mentor.id,second,"decline","Indisponible cette semaine.");assert.equal(await balance(query,buyer.id),400);await assert.rejects(()=>bookingAction(mentor.id,second,"decline"));
 // Principal live self-tests can complete; no withdrawable gain, including historic self bookings.
 const ownService=await saveService(admin.id,data);await entry(query,admin.id,10000,"Fixture","fixture-admin");const self=await book(admin.id,ownService,crypto.randomUUID(),"","À convenir");await bookingAction(admin.id,self,"accept");await bookingAction(admin.id,self,"complete");await confirmService(admin.id,self,1,true);assert.equal((await query(eligibleSql,[admin.id])).length,0);assert.equal((await manualBankOverview(admin.id)).availableCents,0);
 await assert.rejects(()=>book(mentor.id,service,crypto.randomUUID(),"","À convenir"),/propre/);
 // Stripe driver is an in-memory test double: no network, no real charge.
 let session:any;let calls=0;
 const stripe={customers:{create:async()=>({id:"cus_fixture",livemode:true})},checkout:{sessions:{create:async(d:any)=>{calls++;session={id:"cs_fixture",livemode:true,customer:"cus_fixture",currency:"eur",mode:"payment",payment_status:"unpaid",amount_total:d.line_items[0].price_data.unit_amount,url:"https://checkout.stripe.com/fixture",invoice:null,payment_intent:"pi_fixture"};return session;},retrieve:async()=>session}},paymentIntents:{retrieve:async()=>({latest_charge:null})}} as unknown as Stripe;
 const provider=()=>stripe;const orderKey=crypto.randomUUID();await checkout(buyer.id,"credits-v3-launch-500",orderKey,"credits","2026-11-10.1",provider);await checkout(buyer.id,"credits-v3-launch-500",orderKey,"credits","2026-11-10.1",provider);assert.equal(calls,1);
 const start=await balance(query,buyer.id);const event=(n:string)=>({id:n,type:"checkout.session.completed",livemode:true,data:{object:{id:"cs_fixture"}}}) as Stripe.Event;
 await handleEvent(event("evt_unpaid"),provider);assert.equal(await balance(query,buyer.id),start);
 session.payment_status="paid";await handleEvent(event("evt_paid"),provider);await handleEvent(event("evt_paid_duplicate"),provider);assert.equal(await balance(query,buyer.id),start+500);
 await recordRefund("pi_fixture",999);await recordRefund("pi_fixture",999);assert.equal(await balance(query,buyer.id),start);
 for(const role of [true,false]){const menu=workspaceGroups(role,false,false,false);assert.equal(menu[0].title,"Général");assert(menu[0].items.some(i=>i.screen==="credits"));assert(menu[0].items.some(i=>i.screen==="edit"));assert(!menu[0].items.some(i=>["pairs","tasks","notes"].includes(i.screen)));assert.equal(menu[0].items.some(i=>i.screen==="payouts"),role);assert(!menu.some(g=>g.title==="Administration"));}
 console.log("PASS public launch-only offers, server guards, member roles and participant isolation");
 console.log("PASS reservation idempotency, capacity, decline/restoration, two-party completion and stale confirmations");
 console.log("PASS admin live self-tests allowed, earnings excluded, withdrawal allocations prevent duplicates");
 console.log("PASS mocked Stripe checkout, unpaid event ignored, paid credits once, full refund once; no external payment");
}finally{(database() as {close:()=>void}).close();process.chdir(cwd);for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true});}
