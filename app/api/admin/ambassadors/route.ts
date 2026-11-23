import { z } from "zod";
import { user, guard, json } from "@/lib/http";
import { isCrmOwner } from "@/lib/crm";
import { canUseFeature } from "@/lib/beta";
import { withMoneyMode, salesVersion } from "@/lib/monetization/mode";
import { query } from "@/lib/monetization/db";
import { balance, lock, moneyTransaction } from "@/lib/monetization/store";
import { checkout } from "@/lib/monetization/payments";
import { stripeTest, appOrigin } from "@/lib/monetization/stripe";
import { createConnectAccount } from "@/lib/monetization/connect";
import { dashboard, saveAmbassador, saveConfig, syncCode, promoQuote, audit, eligiblePack } from "@/lib/ambassadors/service";
import { verificationStatus, requestWithdrawal, refuseWithdrawal, approveWithdrawal, refreshWithdrawal } from "@/lib/ambassadors/withdrawals";
export const runtime = "nodejs";
export const maxDuration = 60;
async function actor(r: Request) {
  const u = await user(r);
  return u && await isCrmOwner(u) && await canUseFeature(u.id,"ambassadors") ? u : null;
}
export async function GET(r: Request) {
  const u = await actor(r);
  if (!u) return json({error:"Accès privé réservé au compte administrateur principal en bêta."},403);
  try { return await withMoneyMode("test",async()=>json({...await dashboard(new URL(r.url).searchParams.get("search") || ""),ownerId:u.id,paymentAccount:await verificationStatus(u.id),testBalance:await balance(query,u.id),termsVersion:salesVersion()})); }
  catch { return json({error:"Programme privé indisponible. Vérifie les migrations."},503); }
}
export async function POST(r: Request) {
  const u = await actor(r);
  if (!u) return json({error:"Accès privé réservé au compte administrateur principal en bêta."},403);
  const denied = await guard(r); if (denied) return denied;
  try {
    const raw=await r.text();if(Buffer.byteLength(raw)>20000)return json({error:"Formulaire trop volumineux."},413);
    const d=JSON.parse(raw),action=z.enum(["save","config","sync","quote","checkout","connect","withdraw","refuse","approve","refresh","hold"]).parse(d.action);
    return await withMoneyMode("test",async()=>{
      if(action==="save"){await saveAmbassador(u.id,d);await syncCode(u.id,z.string().parse(d.ownerId));}
      if(action==="config")await saveConfig(u.id,d);
      if(action==="sync")await syncCode(u.id,z.string().min(1).max(200).parse(d.ownerId));
      if(action==="quote")return json(await promoQuote(u.id,z.string().parse(d.code),z.string().parse(d.offer)));
      if(action==="checkout"){
        if(d.acceptedTermsVersion!==salesVersion())throw Error("Accepte les conditions de paiement et de confidentialité.");
        if(!process.env.STRIPE_WEBHOOK_SECRET)throw Error("Le webhook de test doit être configuré avant cet essai.");
        const offer=z.string().parse(d.offer);if(!eligiblePack(offer))throw Error("Pack non éligible.");
        return json({url:await checkout(u.id,offer,z.string().uuid().parse(d.key),"credits",salesVersion(),stripeTest,d.code?z.string().max(24).parse(d.code):undefined)});
      }
      if(action==="connect"){
        const a=await createConnectAccount(u,z.enum(["FR","BE","DE","ES","IT","NL","LU","PT","IE","AT","FI"]).parse(d.country));
        const url=appOrigin()+"/?mobile=ambassador#profile";
        const link=await stripeTest().accountLinks.create({account:a.id,type:"account_onboarding",return_url:url,refresh_url:url});
        return json({url:link.url});
      }
      if(action==="withdraw")return json({id:await requestWithdrawal(u.id,z.string().min(1).max(200).parse(d.ownerId),z.string().uuid().parse(d.key))});
      if(action==="refuse")await refuseWithdrawal(u.id,z.string().uuid().parse(d.id),z.string().trim().min(5).max(500).parse(d.reason));
      if(action==="approve"){
        if(d.confirm!==true)throw Error("Confirme le transfert fictif Stripe.");
        await approveWithdrawal(u.id,z.string().uuid().parse(d.id));
      }
      if(action==="refresh")await refreshWithdrawal(z.string().uuid().parse(d.id));
      if(action==="hold")await moneyTransaction(async q=>{
        const id=z.string().max(200).parse(d.id),held=z.boolean().parse(d.held),reason=z.string().trim().min(5).max(500).parse(d.reason);
        const [c]=await q("SELECT owner_id FROM money_ambassador_commissions WHERE payment_id=$1",[id]);if(!c)throw Error("Commission introuvable.");
        await lock(q,String(c.owner_id));await q("UPDATE money_ambassador_commissions SET fraud_hold=$1 WHERE payment_id=$2",[held?1:0,id]);
        await audit(q,u.id,String(c.owner_id),held?"gel-commission":"levée-gel",{id,reason});
      });
      return json({ok:true});
    });
  } catch(e) {return json({error:e instanceof z.ZodError||e instanceof SyntaxError?"Vérifie les champs du formulaire.":e instanceof Error?e.message:"Action indisponible."},400);}
}
