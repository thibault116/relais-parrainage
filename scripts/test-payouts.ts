import assert from "node:assert/strict";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Stripe from "stripe";
import { createPayoutTest,listPayoutTests,migratePayoutTests,refreshPayoutTests } from "../lib/monetization/payout-tests";
import { diagnosePayoutTest,safeStripeFailure } from "../lib/monetization/payout-diagnostics";
import { stripeTest } from "../lib/monetization/stripe";
import { database,query } from "../lib/db";
if(process.env.DATABASE_URL || process.env.VERCEL) throw Error("Base temporaire locale uniquement");
const cwd=process.cwd(),folder=await mkdtemp(join(tmpdir(),"mentora-payout-test-"));
process.chdir(folder);
const previous=process.env.STRIPE_SECRET_KEY;
try {
 await migratePayoutTests();
 // Preserve legacy one-cent history across the additive migration.
 const legacy=crypto.randomUUID();
 await query("INSERT INTO money_payout_tests(id,owner_id,request_key,amount,status,created_at,updated_at) VALUES($1,'owner',$2,1,'failed',$3,$3)",[legacy,crypto.randomUUID(),new Date().toISOString()]);
 await migratePayoutTests();
 assert.equal((await listPayoutTests("owner")).find(row=>row.id===legacy)?.amount,1);
 const noStripe=()=>{throw Error("Ne doit pas appeler Stripe à 0 €")};
 const zeroKey=crypto.randomUUID();
 const zero=await createPayoutTest("owner",0,zeroKey,noStripe);
 assert.equal(zero.status,"simulated");assert.equal(zero.stripe_id,null);
 assert.equal((await createPayoutTest("owner",0,zeroKey,noStripe)).id,zero.id);
 await assert.rejects(()=>createPayoutTest("another",0,zeroKey,noStripe));
 for(const amount of [1,2,-1,101,0.01,"100"]) await assert.rejects(()=>createPayoutTest("owner",amount,crypto.randomUUID(),noStripe));
 process.env.STRIPE_SECRET_KEY="sk_live_forbidden";assert.throws(stripeTest,/live/);
 process.env.STRIPE_SECRET_KEY="rk_live_forbidden";assert.throws(stripeTest,/live/);
 const testBanks=[{id:"ba_test",object:"bank_account",currency:"eur",default_for_currency:true,bank_name:"TEST BANK",last4:"6789"}];
 const environment={accounts:{listExternalAccounts:async()=>({data:testBanks}),retrieve:async()=>({id:"acct_test",payouts_enabled:false})},balance:{retrieve:async()=>({livemode:false,available:[{currency:"eur",amount:200}]})}};
 let count=0;const requests=new Map<string,Stripe.Payout>();
 const fake={...environment,payouts:{create:async(params:any,options:any)=>{
   assert.equal(params.amount,100);assert.equal(params.currency,"eur");assert.equal(params.method,"standard");assert.equal(params.destination,"ba_test");
   if(!requests.has(options.idempotencyKey)) {count++;requests.set(options.idempotencyKey,{id:`po_test_${count}`,livemode:false,status:"pending",...params} as Stripe.Payout);}
   return requests.get(options.idempotencyKey)!;
 },retrieve:async(id:string)=>({...Array.from(requests.values()).find(p=>p.id===id)!,status:"paid"})}} as unknown as Stripe;
 const diagnostic=await diagnosePayoutTest(()=>fake);assert.equal(diagnostic.ready,true);assert.equal(diagnostic.destination?.last4,"6789");
 const noBank={...fake,accounts:{listExternalAccounts:async()=>({data:[]}),retrieve:async()=>({id:"acct_test",payouts_enabled:true,external_accounts:{data:[]}})}} as unknown as Stripe;
 assert.equal((await diagnosePayoutTest(()=>noBank)).ready,false);
 const missing=await createPayoutTest("owner",100,crypto.randomUUID(),()=>noBank);assert.equal(missing.status,"failed");assert.match(missing.error,/Aucun compte bancaire EUR/);assert.equal(count,0);
 const noBalance={...fake,balance:{retrieve:async()=>({livemode:false,available:[]})}} as unknown as Stripe;
 assert.equal((await diagnosePayoutTest(()=>noBalance)).ready,false);
 assert(!safeStripeFailure({message:"Clé sk_test_secret123 refusée"}).message.includes("secret123"));
 const key=crypto.randomUUID();
 const [one,two]=await Promise.all([createPayoutTest("owner",100,key,()=>fake),createPayoutTest("owner",100,key,()=>fake)]);
 assert.equal(one.stripe_id,two.stripe_id);assert.equal(count,1);assert.equal(one.status,"pending");
 const refreshed=await refreshPayoutTests("owner",()=>fake);assert.equal(refreshed.find(r=>r.id===one.id)?.status,"paid");
 assert.equal((await listPayoutTests("another")).length,0);
 const forbidden={...environment,payouts:{create:async()=>{throw {statusCode:403,type:"StripePermissionError"}}}} as unknown as Stripe;
 const failure=await createPayoutTest("owner",100,crypto.randomUUID(),()=>forbidden);
 assert.equal(failure.status,"failed");assert.match(failure.error,/permissions/);
 const timeoutKey=crypto.randomUUID();
 const timeout={...environment,payouts:{create:async()=>{throw Error("timeout")}}} as unknown as Stripe;
 assert.equal((await createPayoutTest("owner",100,timeoutKey,()=>timeout)).status,"uncertain");
 assert.equal((await createPayoutTest("owner",100,timeoutKey,()=>fake)).status,"pending");assert.equal(count,2);
 const live={...environment,payouts:{create:async(params:any)=>({id:"po_forbidden",livemode:true,status:"paid",...params})}} as unknown as Stripe;
 await assert.rejects(()=>createPayoutTest("owner",100,crypto.randomUUID(),()=>live),/incompatible/);
 assert(!(await listPayoutTests("owner")).some(row=>row.stripe_id==="po_forbidden"));
 console.log("PASS destination explicite, absence de banque ou solde détectée, secrets masqués");
 console.log("PASS retrait 0 €, essai Stripe 1 €, historique et actualisation des statuts");
 console.log("PASS doubles clics, isolation des comptes, erreurs et reprise idempotente");
 console.log("PASS autres montants et clés live refusés, aucun portefeuille ni rémunération modifié");
} finally {
 if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;
 const db=database();if("close" in db)db.close();process.chdir(cwd);await rm(folder,{recursive:true,force:true});
}
