import {moneyMode,salesVersion} from "@/lib/monetization/mode";
import { user, json } from "@/lib/http";
import {commerceActor} from "@/lib/monetization/access";
import { query } from "@/lib/monetization/db";
import {rechargeOffers,creditSeasons} from "@/lib/monetization/catalog";
export async function GET(r: Request) {
  const u = await user(r);
  if (!u)
    return json({ error: "Connecte-toi pour consulter les offres." }, 401);
  const actor=await commerceActor(u);
  if(!actor)return json({error:"Offres indisponibles."},403);
  return json({offers:rechargeOffers.filter(p=>actor.owner||p.season==="launch"),seasons:creditSeasons.filter(s=>actor.owner||s.id==="launch"),mode:moneyMode(),salesVersion:salesVersion()});
}
