import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Stripe from "stripe";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error("Tests locaux uniquement.");
const cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),"mentora-ambassadors-"));process.chdir(dir);process.env.MENTORA_BILLING_MODE="test";
const {query,database}=await import("../lib/db");
const money=await import("../lib/monetization/store");
const moneyDb=await import("../lib/monetization/db");
const {returnUrl}=await import("../lib/monetization/stripe");
assert.match(returnUrl("ambassador"),/mobile=ambassador&ambassadorTab=checkout/);
const {withMoneyMode}=await import("../lib/monetization/mode");
const {migrateAmbassadors}=await import("../lib/ambassadors/schema");
const service=await import("../lib/ambassadors/service");
const withdrawals=await import("../lib/ambassadors/withdrawals");
const payments=await import("../lib/monetization/payments");
const now=()=>new Date().toISOString();
try{
 const {getAuth}=await import("../lib/auth");const {getMigrations}=await import("better-auth/db/migration");await (await getMigrations(getAuth().options)).runMigrations();
 await query('CREATE TABLE profiles(id TEXT PRIMARY KEY,user_id TEXT UNIQUE,name TEXT,role TEXT)');
 await query('CREATE TABLE moderators(user_id TEXT PRIMARY KEY,email TEXT)');
 await query('CREATE TABLE profile_blocks(user_id TEXT PRIMARY KEY)');
 await query('CREATE TABLE push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT)');
 await query('CREATE TABLE beta_preferences(user_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL)');
 await query('CREATE TABLE legal_checkout_acceptances(order_id TEXT PRIMARY KEY,owner_id TEXT,version TEXT,offer TEXT,amount_cents INTEGER,credits INTEGER,period TEXT,accepted_at TEXT)');
 for(const [id,email,role] of [["admin","thibault.cordiez@hotmail.com","mentor"],["amb","amb@example.invalid","beginner"],["ordinary","ordinary@example.invalid","mentor"],["moderator","mod@example.invalid","mentor"]]){await query('INSERT INTO "user"(id,email,name,emailVerified,createdAt,updatedAt) VALUES($1,$2,$1,1,$3,$3)',[id,email,now()]);await query('INSERT INTO profiles(id,user_id,name,role) VALUES($1,$1,$1,$2)',[id,role]);await query('INSERT INTO beta_preferences VALUES($1,1)',[id]);}
 await query("INSERT INTO moderators VALUES('admin','thibault.cordiez@hotmail.com')");await query("INSERT INTO moderators VALUES('moderator','mod@example.invalid')");
 await money.migrateMonetization();await migrateAmbassadors();
 assert.equal(await service.privateActor("ordinary"),false);assert.equal(await service.privateActor("moderator"),false);assert.equal(await service.privateActor("admin"),true);
 await query("UPDATE beta_preferences SET enabled=0 WHERE user_id='admin'");assert.equal(await service.privateActor("admin"),false);await query("UPDATE beta_preferences SET enabled=1 WHERE user_id='admin'");
 assert.equal(service.percentage(2000,500),100);assert.equal(service.percentage(999,500),50);assert.equal(service.percentage(1390,500),70);assert.throws(()=>service.percentage(1.5,500));
 const promos=new Map<string,{id:string;code:string;active:boolean;livemode:boolean}>();let promoCount=0,transferCalls=0,payoutCalls=0;
 let payoutStatus="pending";const payouts=new Map<string,Record<string,unknown>>(),sessions=new Map<string,Record<string,unknown>>();
 const payoutKeys=new Map<string,Record<string,unknown>>();
 const fake={
  coupons:{create:async()=>({id:"coupon_test",livemode:false})},
  promotionCodes:{create:async(d:{code:string})=>{const p={id:`promo_${++promoCount}`,code:d.code,active:true,livemode:false};promos.set(p.id,p);return p},retrieve:async(id:string)=>{const p=promos.get(id);if(!p)throw Error("absent");return p},update:async(id:string,d:{active:boolean})=>{const p=promos.get(id)!;p.active=d.active;return p}},
  balance:{retrieve:async()=>({livemode:false,available:[{currency:"eur",amount:100000}]})},
  accounts:{retrieve:async(id:string)=>({id,metadata:{mentora_owner:"amb",mentora_connect_test:"1"},controller:{is_controller:true},details_submitted:true,payouts_enabled:true,capabilities:{transfers:"active"},requirements:{currently_due:[],past_due:[]}})},
  transfers:{create:async(d:Record<string,unknown>)=>{transferCalls++;return {id:`tr_${transferCalls}`,livemode:false,...d}}},
  payouts:{create:async(d:Record<string,unknown>,options:{idempotencyKey:string})=>{if(payoutKeys.has(options.idempotencyKey))return payoutKeys.get(options.idempotencyKey);payoutCalls++;const p={id:`po_${payoutCalls}`,livemode:false,status:payoutStatus,...d};payouts.set(String(p.id),p);payoutKeys.set(options.idempotencyKey,p);return p},retrieve:async(id:string)=>({...payouts.get(id),status:payoutStatus})},
  customers:{create:async()=>({id:"cus_admin",livemode:false})},
  checkout:{sessions:{create:async(d:Record<string,unknown>)=>{const id=`cs_${sessions.size+1}`,discount=d.discounts as {promotion_code:string}[]|undefined;const p={id,livemode:false,url:"https://checkout.stripe.com/c/pay/cs_test",...d,discounts:discount};sessions.set(id,p);return p},retrieve:async(id:string)=>sessions.get(id)}},
  paymentIntents:{retrieve:async()=>({latest_charge:{amount_refunded:0}})},
  disputes:{list:async()=>({data:[{status:"needs_response"}]}),retrieve:async()=>({livemode:false,payment_intent:"pi_1",status:"needs_response"})}
 } as unknown as Stripe;
 const provider=()=>fake;
 await service.saveAmbassador("admin",{ownerId:"amb",code:"AMBTEST",status:"active",eligibilityReviewed:true});
 assert.equal((await query("SELECT role FROM profiles WHERE user_id='amb'"))[0].role,"beginner");
 await assert.rejects(()=>service.saveAmbassador("admin",{ownerId:"ordinary",code:"AMBTEST",status:"active"}));
 await service.syncCode("admin","amb",provider);
 const offer="credits-v3-launch-1020",quote=await service.promoQuote("admin","ambtest",offer);
 assert.deepEqual([quote.grossCents,quote.discountCents,quote.paidCents,quote.credits,quote.commissionCents],[1999,100,1899,1020,100]);
 await assert.rejects(()=>service.promoQuote("ordinary","AMBTEST",offer));await assert.rejects(()=>service.promoQuote("admin","AMBTEST","credits-admin-v1-10000-eur1"));
 await service.saveAmbassador("admin",{ownerId:"admin",code:"ADMINTEST",status:"active"});await service.syncCode("admin","admin",provider);await assert.rejects(()=>service.promoQuote("admin","ADMINTEST",offer),/propre code/);
 const key=crypto.randomUUID();await payments.checkout("admin",offer,key,"credits",undefined,provider,"AMBTEST");
 const session=[...sessions.values()][0];assert.equal((session.discounts as {promotion_code:string}[])[0].promotion_code,quote.promotionId);
 await payments.checkout("admin",offer,key,"credits",undefined,provider,"AMBTEST");assert.equal(sessions.size,1);await assert.rejects(()=>payments.checkout("admin",offer,key,"credits",undefined,provider),/autre code/);
 const paidSession={...session,mode:"payment",payment_status:"paid",currency:"eur",customer:"cus_admin",payment_intent:"pi_1",amount_subtotal:1999,amount_total:1899,total_details:{amount_discount:100,amount_tax:0,amount_shipping:0},invoice:null};sessions.set(String(session.id),paidSession);
 const event={id:"evt_paid",type:"checkout.session.completed",livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:session.id}}} as Stripe.Event;
 await payments.handleEvent(event,provider);await payments.handleEvent(event,provider);await payments.handleEvent({...event,id:"evt_duplicate_different_id"},provider);
 assert.equal(await money.balance(query,"admin"),1020);assert.equal((await query("SELECT * FROM money_ambassador_commissions")).length,1);
 assert.equal((await service.totals("amb")).pending,100);assert.equal((await service.totals("amb")).available,0);
 await payments.recordRefund("pi_1",950);assert.equal((await query("SELECT net_cents FROM money_ambassador_commissions"))[0].net_cents,49);await payments.recordRefund("pi_1",950);assert.equal((await query("SELECT net_cents FROM money_ambassador_commissions"))[0].net_cents,49);
 await service.adjustCommission("pi_1",undefined,"needs_response");assert.equal((await service.totals("amb")).total,0);await service.adjustCommission("pi_1",undefined,"won");assert.equal((await service.totals("amb")).total,49);
 await payments.recordRefund("pi_1",1899);assert.equal(await money.balance(query,"admin"),0);assert.equal((await service.totals("amb")).total,0);
 // A disputed charge that predates the checkout webhook stays blocked.
 await payments.checkout("admin",offer,crypto.randomUUID(),"credits",undefined,provider,"AMBTEST");
 const disputed=[...sessions.values()].at(-1)!;sessions.set(String(disputed.id),{...disputed,mode:"payment",payment_status:"paid",currency:"eur",customer:"cus_admin",payment_intent:"pi_disputed",amount_subtotal:1999,amount_total:1899,total_details:{amount_discount:100,amount_tax:0,amount_shipping:0},invoice:null});
 const disputedProvider=()=>({...fake,paymentIntents:{retrieve:async()=>({latest_charge:{id:"ch_disputed",amount_refunded:0,disputed:true}})}}) as unknown as Stripe;
 await payments.handleEvent({...event,id:"evt_disputed_checkout",data:{object:{id:disputed.id}}} as Stripe.Event,disputedProvider);
 assert.equal((await query("SELECT net_cents FROM money_ambassador_commissions WHERE payment_intent='pi_disputed'"))[0].net_cents,0);
 await payments.recordRefund("pi_disputed",1899);
 // No code: credit purchase works unchanged and creates no affiliate commission.
 await payments.checkout("admin",offer,crypto.randomUUID(),"credits",undefined,provider);
 const plain=[...sessions.values()].at(-1)!;assert.equal(plain.discounts,undefined);
 sessions.set(String(plain.id),{...plain,mode:"payment",payment_status:"paid",currency:"eur",customer:"cus_admin",payment_intent:"pi_plain",amount_total:1999,invoice:null});
 await payments.handleEvent({...event,id:"evt_plain",data:{object:{id:plain.id}}} as Stripe.Event,provider);assert.equal(await money.balance(query,"admin"),1020);assert.equal((await query("SELECT * FROM money_ambassador_commissions")).length,2);
 // Existing service credit debit and double completion keep the same remuneration.
 const serviceId=await money.saveService("ordinary",{title:"Prestation existante",description:"Un accompagnement local de test suffisamment détaillé.",category:"Conseils",duration:30,calls:1,followup:"",availability:"Sur rendez-vous",credits:100,capacity:1,published:true});
 const beforeCredits=await money.balance(query,"admin"),beforeCommission=(await service.totals("amb")).total;
 const booking=await money.book("admin",serviceId,crypto.randomUUID(),"Test sans changement de prix","Demain");
 assert.equal(await money.balance(query,"admin"),beforeCredits-100);assert.equal((await query("SELECT payout_cents FROM money_bookings WHERE id=$1",[booking]))[0].payout_cents,160);
 await money.bookingAction("ordinary",booking,"accept");await money.bookingAction("ordinary",booking,"complete");await money.confirmService("admin",booking,1,true);assert.equal((await service.totals("amb")).total,beforeCommission);
 // An unconfirmed session produces neither credits nor commissions.
 await payments.checkout("admin",offer,crypto.randomUUID(),"credits",undefined,provider,"AMBTEST");const unpaid=[...sessions.values()].at(-1)!;sessions.set(String(unpaid.id),{...unpaid,mode:"payment",payment_status:"unpaid",customer:"cus_admin"});await payments.handleEvent({...event,id:"evt_failed",data:{object:{id:unpaid.id}}} as Stripe.Event,provider);assert.equal((await query("SELECT * FROM money_ambassador_commissions")).length,2);
 await service.saveAmbassador("admin",{ownerId:"amb",status:"suspended",eligibilityReviewed:true});await service.syncCode("admin","amb",provider);assert.equal(promos.get(quote.promotionId)?.active,false);await assert.rejects(()=>service.promoQuote("admin","AMBTEST",offer));
 const [unpaidOrder]=await query("SELECT id FROM money_orders WHERE session_id=$1",[String(unpaid.id)]);await service.recordCommission(String(unpaidOrder.id),"cs_suspended","pi_suspended",event.created);assert.equal((await query("SELECT * FROM money_ambassador_commissions")).length,2);
 await service.saveAmbassador("admin",{ownerId:"amb",status:"active",eligibilityReviewed:true});await service.syncCode("admin","amb",provider);await service.promoQuote("admin","AMBTEST",offer);
 const cfg=await service.config();await service.saveConfig("admin",{discountBps:600,commissionBps:700,revision:Number(cfg.revision)});await assert.rejects(()=>service.promoQuote("admin","AMBTEST",offer));await service.syncCode("admin","amb",provider);const changed=await service.promoQuote("admin","AMBTEST",offer);assert.equal(changed.commissionCents,140);assert.equal(quote.commissionCents,100);
 // Synchronization failure remains closed locally.
 const badProvider=()=>({...fake,promotionCodes:{retrieve:async()=>{throw Error("offline")}}}) as unknown as Stripe;
 await service.saveAmbassador("admin",{ownerId:"amb",status:"suspended",eligibilityReviewed:true});await assert.rejects(()=>service.syncCode("admin","amb",badProvider));await assert.rejects(()=>service.promoQuote("admin","AMBTEST",offer));
 await service.saveAmbassador("admin",{ownerId:"amb",status:"active",eligibilityReviewed:true});await service.syncCode("admin","amb",provider);
 // Mature commissions and account association are test-only fixtures.
 await query("INSERT INTO money_ambassador_commissions(payment_id,payment_intent,owner_id,order_id,gross_cents,paid_cents,original_cents,net_cents,available_at,created_at) VALUES('mature','pi_mature','amb','mature_order',60000,57000,3000,3000,$1,$1)",[new Date(Date.now()-31*86400000).toISOString()]);
 await query("INSERT INTO money_connect_accounts(owner_id,account_id,country,creation_key,created_at) VALUES('amb','acct_amb','FR',$1,$2)",[crypto.randomUUID(),now()]);
 const results=await Promise.allSettled([withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider),withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal((await service.totals("amb")).available,0);
 const first=(results.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<string>).value;await withdrawals.refuseWithdrawal("admin",first,"Essai de refus");assert.equal((await service.totals("amb")).available,3000);
 await service.saveAmbassador("admin",{ownerId:"amb",status:"removed",eligibilityReviewed:true});await service.syncCode("admin","amb",provider);await assert.rejects(()=>service.saveAmbassador("admin",{ownerId:"amb",status:"active"}));
 const withdrawal=await withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider);assert.equal((await service.totals("amb")).reserved,3000);
 await withdrawals.approveWithdrawal("admin",withdrawal,provider);assert.equal(transferCalls,1);assert.equal(payoutCalls,1);assert.equal((await query("SELECT status FROM money_ambassador_withdrawals WHERE id=$1",[withdrawal]))[0].status,"pending_payout");await assert.rejects(()=>withdrawals.approveWithdrawal("admin",withdrawal,provider));
 payoutStatus="paid";await withdrawals.refreshWithdrawal(withdrawal,provider);assert.equal((await service.totals("amb")).withdrawn,3000);
 payoutStatus="failed";await withdrawals.refreshWithdrawal(withdrawal,provider);assert.equal((await service.totals("amb")).withdrawn,0);assert.equal((await service.totals("amb")).reserved,3000);
 payoutStatus="paid";await withdrawals.refreshWithdrawal(withdrawal,provider);assert.equal((await query("SELECT status FROM money_ambassador_withdrawals WHERE id=$1",[withdrawal]))[0].status,"payout_failed");
 payoutStatus="pending";await withdrawals.approveWithdrawal("admin",withdrawal,provider);assert.equal(transferCalls,1);assert.equal(payoutCalls,2);
 payoutStatus="paid";await withdrawals.refreshWithdrawal(withdrawal,provider);await service.adjustCommission("pi_mature",57000);assert.equal((await service.totals("amb")).available,-3000);await assert.rejects(()=>withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider));
 // An ambiguous payout response keeps the reserve and recovers with the same Stripe key.
 await query("INSERT INTO money_ambassador_commissions(payment_id,payment_intent,owner_id,order_id,gross_cents,paid_cents,original_cents,net_cents,available_at,created_at) VALUES('recovery','pi_recovery','amb','recovery_order',120000,114000,6000,6000,$1,$1)",[new Date(Date.now()-31*86400000).toISOString()]);
 const uncertain=await withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider);payoutStatus="pending";
 const ambiguous=()=>({...fake,payouts:{...fake.payouts,create:async(...args:unknown[])=>{await (fake.payouts.create as Function)(...args);throw Error("lost response")}}}) as unknown as Stripe;
 await assert.rejects(()=>withdrawals.approveWithdrawal("admin",uncertain,ambiguous));assert.equal((await query("SELECT status FROM money_ambassador_withdrawals WHERE id=$1",[uncertain]))[0].status,"uncertain");assert.equal((await service.totals("amb")).available,0);
 const transfersBefore=transferCalls,payoutsBefore=payoutCalls;await withdrawals.approveWithdrawal("admin",uncertain,provider);assert.equal(transferCalls,transfersBefore);assert.equal(payoutCalls,payoutsBefore);
 const [uncertainRow]=await query("SELECT * FROM money_ambassador_withdrawals WHERE id=$1",[uncertain]);
 const reverseProvider=()=>({...fake,transfers:{...fake.transfers,retrieve:async()=>({id:uncertainRow.transfer_id,livemode:false,amount_reversed:3000,metadata:{mentora_ambassador_withdrawal:uncertain}})}}) as unknown as Stripe;
 await withdrawals.ambassadorTransferEvent({id:"evt_transfer_reverse",livemode:false,type:"transfer.reversed",data:{object:{id:uncertainRow.transfer_id}}} as Stripe.Event,reverseProvider);assert.equal((await query("SELECT status FROM money_ambassador_withdrawals WHERE id=$1",[uncertain]))[0].status,"reversed_review");assert.equal((await service.totals("amb")).reserved,3000);
 await withMoneyMode("live",async()=>{await migrateAmbassadors();assert.equal((await moneyDb.query("SELECT * FROM money_ambassadors")).length,0);await assert.rejects(()=>service.saveAmbassador("admin",{ownerId:"amb",status:"active"}),/réel.*désactivé/);await assert.rejects(()=>withdrawals.requestWithdrawal("admin","amb",crypto.randomUUID(),provider),/réel.*désactivé/);});
 const api=await import("../app/api/admin/ambassadors/route");
 assert.equal((await api.GET(new Request("http://localhost/api/admin/ambassadors"))).status,403);
 assert.equal((await api.POST(new Request("http://localhost/api/admin/ambassadors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",ownerId:"admin",status:"active"})}))).status,403);
 assert((await query("SELECT * FROM money_ambassador_audit")).length>10);
 console.log("PASS accès admin/bêta, activation, unicité, synchronisation et panne Stripe, suspension/réactivation/retrait du statut");
 console.log("PASS Checkout avec/sans code, auto-achat, crédits inchangés, arrondis, webhooks doublés/échoués, remboursements partiels/intégraux, litiges");
 console.log("PASS délai 30 jours, réserve concurrente, refus, conservation des droits, transfert/payout test, échec bancaire, dette après remboursement, séparation test/live");
}finally{(database() as {close:()=>void}).close();process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
