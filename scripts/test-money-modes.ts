import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {database,query as raw} from "../lib/db";
import {query,moneySQL} from "../lib/monetization/db";
import {moneyMode,withMoneyMode,liveReadiness,salesVersion} from "../lib/monetization/mode";
import {migrateMonetization,entry,balance,saveService,book,bookingAction} from "../lib/monetization/store";
import {stripeBilling} from "../lib/monetization/stripe";
import {POST as webhook} from "../app/api/stripe/webhook/route";
import {manualPayoutPolicy} from "../lib/monetization/manual-payout-policy";
import {saveBankDetails,manualBankOverview,requestBankTransfer} from "../lib/monetization/manual-bank";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error("Isolated tests only");
const dir=await mkdtemp(join(tmpdir(),"mentora-money-modes-")),cwd=process.cwd();process.chdir(dir);
const env={...process.env};
try{
 for(const k of Object.keys(process.env))if(k.startsWith("MENTORA_")||k.startsWith("STRIPE_"))delete process.env[k];
 process.env.STRIPE_SECRET_KEY="sk_test_local_fixture";process.env.STRIPE_WEBHOOK_SECRET="whsec_test_fixture";process.env.BANK_DETAILS_ENCRYPTION_KEY=randomBytes(32).toString("hex");
 await withMoneyMode("test",()=>migrateMonetization());await withMoneyMode("live",()=>migrateMonetization());
 assert.equal(moneyMode(),"test");await entry(query,"owner",30,"fixture","initial");assert.equal(await balance(query,"owner"),30);
 await withMoneyMode("live",async()=>{assert.equal(await balance(query,"owner"),0);assert(!liveReadiness().ready);assert.throws(()=>stripeBilling(),/non configurés/);assert.throws(()=>salesVersion(),/non configurées/);await assert.rejects(()=>requestBankTransfer("owner",crypto.randomUUID()),/désactivés/);});
 process.env.STRIPE_LIVE_SECRET_KEY="sk_live_local_fixture_not_a_real_key";process.env.STRIPE_LIVE_WEBHOOK_SECRET="whsec_live_fixture";
 process.env.MENTORA_COMMERCIAL_VALIDATED="true";process.env.MENTORA_COMMERCIAL_VALIDATION_REFERENCE="fixture-only";process.env.MENTORA_LIVE_TERMS_VERSION="live-fixture-v1";process.env.MENTORA_LIVE_PAYOUT_CENTS="100";
 const service=await saveService("owner",{title:"Audit fixture",description:"Prestation de contrôle des écritures séparées.",category:"Autre",duration:0,calls:0,followup:"",availability:"À convenir",credits:5,capacity:5,published:true});
 await withMoneyMode("live",async()=>{
 assert(liveReadiness().ready);assert.equal(salesVersion(),"live-fixture-v1");await entry(query,"owner",10,"fixture","initial");assert.equal(await balance(query,"owner"),10);
 assert.equal((await query("SELECT * FROM money_services")).length,1);
 const b=await book("owner",service,crypto.randomUUID(),"","À convenir");await bookingAction("owner",String(b),"accept");await bookingAction("owner",String(b),"complete");assert.equal(await balance(query,"owner"),5);
 process.env.MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED="true";process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED="true";process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE="fixture-only";assert(manualPayoutPolicy().liveEnabled);
 await saveBankDetails("owner",{holder:"Fixture",country:"FR",iban:"FR1420041010050500013M02606"});const req=await requestBankTransfer("owner",crypto.randomUUID());assert.equal(req.amount_cents,500);assert.equal((await manualBankOverview("owner")).history[0].mode,"live");
 });
 assert.equal(await balance(query,"owner"),30);assert.equal((await manualBankOverview("owner")).bank,null);assert.equal((await manualBankOverview("owner")).history.length,0);
 assert.equal((await raw("SELECT COUNT(*) AS n FROM money_live_bookings"))[0].n,1);assert.equal((await raw("SELECT COUNT(*) AS n FROM money_bookings"))[0].n,0);
 assert.equal(moneySQL("SELECT * FROM money_ledger"),"SELECT * FROM money_ledger");
 // Unknown event: signature and namespace checks only, NO network/real Stripe call.
 const event=(live:boolean)=>({id:"evt_fixture_"+(live?"live":"test"),type:"fixture.no_effect",livemode:live,data:{object:{}}});
 async function deliver(live:boolean,secretMode:"test"|"live"){
 const payload=JSON.stringify(event(live)),secret=secretMode==="live"?process.env.STRIPE_LIVE_WEBHOOK_SECRET!:process.env.STRIPE_WEBHOOK_SECRET!;
 const signature=withMoneyMode(secretMode,()=>stripeBilling().webhooks.generateTestHeaderString({payload,secret}));
 return webhook(new Request("http://localhost/api/stripe/webhook",{method:"POST",headers:{"stripe-signature":signature},body:payload}));
 }
 assert.equal((await deliver(true,"test")).status,400);assert.equal((await deliver(false,"live")).status,400);assert.equal((await deliver(true,"live")).status,200);assert.equal((await deliver(false,"test")).status,200);
 assert.equal((await raw("SELECT id FROM money_live_events"))[0].id,"evt_fixture_live");assert.equal((await raw("SELECT id FROM money_events"))[0].id,"evt_fixture_test");
 assert.deepEqual(await Promise.all([withMoneyMode("live",async()=>{await new Promise(r=>setTimeout(r,5));return moneyMode();}),withMoneyMode("test",async()=>moneyMode())]),["live","test"]);
 console.log("PASS comptabilités, réservations, gains, IBAN et retraits test/réel isolés ; catalogue conservé");
 console.log("PASS activation réelle explicite, configuration incomplète refusée, aucun solde fictif transféré");
 console.log("PASS signatures distinctes, événement du mauvais mode rejeté, requêtes concurrentes isolées ; aucun appel bancaire ou Stripe réel");
}finally{(database() as {close:()=>void}).close();process.chdir(cwd);for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true});}
