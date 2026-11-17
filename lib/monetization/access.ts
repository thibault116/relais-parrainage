import {query} from "./db";
import {isCrmOwner} from "../crm";
import {canUseFeature} from "../beta";
import {billingLive,memberCommerceAuthorized} from "./mode";
import {adminCreditOffer,rechargeOffers} from "./catalog";
export async function commerceActor(u:{id:string;email:string}|null|undefined){
 if(!u)return null;
 const owner=await isCrmOwner(u);
 if(!owner&&(!billingLive()||!memberCommerceAuthorized()))return null;
 if(!owner&&!await canUseFeature(u.id,"commerce"))return null;
 if((await query("SELECT user_id FROM profile_blocks WHERE user_id=$1",[u.id])).length)return null;
 const [profile]=await query("SELECT id,name,role FROM profiles WHERE user_id=$1",[u.id]);
 if(!profile&&!owner)return null;
 return {id:u.id,email:u.email,owner,profile};
}
export function allowedPurchase(code:string,owner:boolean){
 return owner ? code===adminCreditOffer.id||rechargeOffers.some(p=>p.id===code) : rechargeOffers.some(p=>p.id===code&&p.season==="launch");
}
export async function principalAccount(id:string){const [u]=await query('SELECT id,email FROM "user" WHERE id=$1',[id]);return !!u&&await isCrmOwner({id:String(u.id),email:String(u.email)});}
