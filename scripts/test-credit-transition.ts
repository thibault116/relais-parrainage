import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type Stripe from "stripe";
import {database,query} from "../lib/db";
import {migrateMonetization,entry,balance} from "../lib/monetization/store";
import {switchToCredits} from "../lib/monetization/credit-transition";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error("Isolated local test only");
const cwd=process.cwd(),dir=await mkdtemp(join(tmpdir(),"mentora-credits-only-"));process.chdir(dir);
try{
 await migrateMonetization();await query("INSERT INTO money_accounts(owner_id) VALUES('owner')");await entry(query,"owner",22280,"fixture","fixture");await query("UPDATE money_accounts SET customer_id='cus_fixture',subscription_id='sub_fixture',plan='plus',status='active' WHERE owner_id='owner'");
 const calls:unknown[]=[];
 const fake={subscriptions:{list:()=>({async *[Symbol.asyncIterator](){yield {id:"sub_fixture",livemode:false,customer:"cus_fixture",status:"active",schedule:"sched_fixture"};}}),cancel:async(...args:unknown[])=>{calls.push(args);}},subscriptionSchedules:{release:async(id:string)=>calls.push(["release",id])},checkout:{sessions:{list:()=>({async *[Symbol.asyncIterator](){yield {id:"cs_fixture_sub",mode:"subscription"};yield {id:"cs_fixture_credits",mode:"payment"};}}),expire:async(id:string)=>calls.push(["expire",id])}}} as unknown as Stripe;
 await switchToCredits("owner",()=>fake);assert.equal(await balance(query,"owner"),22280);assert.equal((await query("SELECT subscription_id FROM money_accounts WHERE owner_id='owner'"))[0].subscription_id,null);
 assert.deepEqual(calls[0],["release","sched_fixture"]);assert.deepEqual((calls[1] as unknown[])[1],{prorate:false,invoice_now:false});assert.deepEqual(calls[2],["expire","cs_fixture_sub"]);assert.equal(calls.length,3);
 console.log("PASS arrêt du contrat récurrent et de sa planification, aucune facture finale, expiration des anciens paiements récurrents, crédits et recharges conservés");
}finally{(database() as {close:()=>void}).close();process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
