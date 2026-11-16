import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {database,query} from "../lib/db";
import {plans,packs,currentCheckoutCode,checkoutOffer,customCreditsPrice} from "../lib/monetization/catalog";
import {payoutRate} from "../lib/monetization/payout-rate";
import {migrateMonetization,saveService,book,entry,balance} from "../lib/monetization/store";
import {recordPaid,recordRefund,checkout} from "../lib/monetization/payments";
import {joinOffers} from "../lib/join-offers";
if(process.env.DATABASE_URL||process.env.VERCEL)throw Error("Local isolated tests only");
const cwd=process.cwd(),dir=await mkdtemp(join(tmpdir(),"mentora-credits-v2-")),old=process.env.MENTORA_TEST_PAYOUT_CENTS;process.chdir(dir);
try{
 await migrateMonetization();
 assert.deepEqual(plans.map(p=>[p.cents,p.credits]),[[0,0],[1490,700],[2990,1600],[4990,2800]]);
 assert.deepEqual(joinOffers().comparison.find(r=>r.label==="Crédits par mois")?.values,["0","700","1600","2800"]);
 assert.deepEqual(packs.map(p=>[p.cents,p.credits,p.purchasedCredits,p.bonusCredits]),[[1000,500,500,0],[1800,1000,900,100],[3600,2000,1800,200],[6400,4000,3200,800]]);
 for(const p of packs){assert.equal(p.credits,p.purchasedCredits+p.bonusCredits);assert.equal(p.cents,p.purchasedCredits*2);assert.equal(checkoutOffer(p.id)?.credits,p.credits);}
 assert.equal(customCreditsPrice(100),200);assert.equal(customCreditsPrice(325),650);assert.equal(customCreditsPrice(10000),20000);assert.equal(customCreditsPrice(10001),null);
 assert.equal(checkoutOffer("custom-v2-100")?.cents,200);assert.equal(checkoutOffer("custom-v2-10000")?.cents,20000);
 assert.equal(checkoutOffer(currentCheckoutCode("starter"))?.credits,700);assert.equal(checkoutOffer(currentCheckoutCode("plus-annual"))?.credits,19200);assert.equal(checkoutOffer(currentCheckoutCode("plus-annual"))?.cents,28704);
 assert.equal(checkoutOffer("starter")?.credits,10);assert.equal(checkoutOffer("pro-annual")?.credits,456);assert.equal(checkoutOffer("pack20")?.cents,3290);assert.equal(checkoutOffer("pack20")?.credits,20);assert.equal(checkoutOffer("custom-v1-10")?.cents,1690);assert.throws(()=>currentCheckoutCode("pack20"));
 await assert.rejects(()=>checkout("owner","custom-v2-1",crypto.randomUUID()),/0,50/);
 const service=await saveService("owner",{title:"Audit fixture",description:"Une prestation de test de cent crédits.",category:"Autre",duration:0,calls:0,followup:"",availability:"À convenir",credits:100,capacity:10,published:true});
 await entry(query,"owner",500,"fixture","fixture-balance");process.env.MENTORA_TEST_PAYOUT_CENTS="150";const before=String(await book("owner",service,crypto.randomUUID(),"","À convenir"));
 process.env.MENTORA_TEST_PAYOUT_CENTS="1";assert.equal(payoutRate()*100,100);const after=String(await book("owner",service,crypto.randomUUID(),"","À convenir"));
 assert.equal((await query("SELECT payout_cents FROM money_bookings WHERE id=$1",[before]))[0].payout_cents,15000);assert.equal((await query("SELECT payout_cents FROM money_bookings WHERE id=$1",[after]))[0].payout_cents,100);
 await recordPaid("buyer","fixture-bonus","fixture-pi",1800,1000,null);await recordPaid("buyer","fixture-bonus","fixture-pi",1800,1000,null);assert.equal(await balance(query,"buyer"),1000);
 await recordRefund("fixture-pi",900);assert.equal(await balance(query,"buyer"),500);await recordRefund("fixture-pi",900);assert.equal(await balance(query,"buyer"),500);await recordRefund("fixture-pi",1800);assert.equal(await balance(query,"buyer"),0);
 console.log("PASS tarifs et bonus exacts des captures ; abonnements 700/1600/2800 ; quantités personnalisées à 2 centimes/crédit");
 console.log("PASS anciens paiements et droits conservés, rémunération des nouvelles réservations à 1 centime/crédit, anciens montants inchangés");
 console.log("PASS bonus crédités une seule fois, restitution proportionnelle aux remboursements et minimum Stripe contrôlé sans appel réseau");
}finally{if(old===undefined)delete process.env.MENTORA_TEST_PAYOUT_CENTS;else process.env.MENTORA_TEST_PAYOUT_CENTS=old;(database() as {close:()=>void}).close();process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
