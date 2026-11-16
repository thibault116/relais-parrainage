export const plans = [
  { id: "free", name: "Free", cents: 0, credits: 0 },
  { id: "starter", name: "Starter", cents: 1490, credits: 700 },
  { id: "plus", name: "Plus", cents: 2990, credits: 1600 },
  { id: "pro", name: "Pro", cents: 4990, credits: 2800 },
];
export const creditPricingVersion = "v2";
export const creditPurchaseCents = 2;
export const creditPayoutCents = 1.5;
export const maxServiceCredits=50000;
export const servicePriceCents=(credits:number)=>Math.round(credits*creditPurchaseCents);
export function sliderCredits(position:number){return position<=100?Math.max(1,Math.round(position*10)):Math.round(1000*Math.pow(50,(position-100)/900));}
export function creditsSlider(credits:number){return credits<=1000?credits/10:100+900*Math.log(credits/1000)/Math.log(50);}
export const minCustomCredits = 25;
export const packs = [
  { id:"credits-v2-500",name:"Découverte",cents:1000,credits:500,purchasedCredits:500,bonusCredits:0 },
  { id:"credits-v2-1000",name:"Essentiel",cents:1800,credits:1000,purchasedCredits:900,bonusCredits:100 },
  { id:"credits-v2-2000",name:"Avantage",cents:3600,credits:2000,purchasedCredits:1800,bonusCredits:200 },
  { id:"credits-v2-4000",name:"Maxi",cents:6400,credits:4000,purchasedCredits:3200,bonusCredits:800 },
];
// Immutable legacy offers: used only to reconcile payments opened before v2.
const legacyPlanCredits:Record<string,number>={free:0,starter:10,plus:22,pro:38};
const legacyPacks = [
  { id:"pack5",name:"5 crédits",cents:890,credits:5 },
  { id:"pack10",name:"10 crédits",cents:1690,credits:10 },
  { id:"pack20",name:"20 crédits",cents:3290,credits:20 },
  { id:"pack40",name:"40 crédits",cents:6290,credits:40 },
];
export function offer(id: string) {
  return [...plans, ...packs].find((p) => p.id === id);
}

export const annualDiscount = 20;
export const maxCustomCredits = 10000;
export type BillingPeriod = "month" | "year";

export function annualPrice(monthlyCents: number) {
  return Math.round((monthlyCents * 12 * (100 - annualDiscount)) / 100);
}

export function customCreditsPrice(credits:number) {
  return Number.isInteger(credits)&&credits>=1&&credits<=maxCustomCredits ? credits*creditPurchaseCents : null;
}
function legacyCustomPrice(credits:number){
  if(!Number.isInteger(credits)||credits<1||credits>1000)return null;
  let previous={credits:0,cents:0};
  for(const pack of legacyPacks){if(credits<=pack.credits)return previous.cents+Math.round((credits-previous.credits)*(pack.cents-previous.cents)/(pack.credits-previous.credits));previous=pack;}
  return previous.cents+(credits-previous.credits)*150;
}
export function currentCheckoutCode(code:string){
  const annual=code.endsWith("-annual"),id=annual?code.slice(0,-7):code;
  if(plans.some(p=>p.id===id))return `${id}-credits-v2${annual?"-annual":""}`;
  if(packs.some(p=>p.id===code))return code;
  throw Error("Offre inconnue");
}
type RechargeOffer={name:string;cents:number;credits:number;id?:string};
type SubscriptionOffer=RechargeOffer&{planId:string;period:BillingPeriod};
export function isSubscriptionOffer(value:RechargeOffer|SubscriptionOffer|null|undefined):value is SubscriptionOffer{return !!value&&"planId" in value&&"period" in value;}
export function checkoutOffer(code: string):RechargeOffer|SubscriptionOffer|null|undefined {
  const custom = /^custom-v([12])-(\d{1,5})$/.exec(code);
  if (custom) {
    const credits = Number(custom[2]);
    const cents = custom[1]==="1"?legacyCustomPrice(credits):customCreditsPrice(credits);
    return cents === null ? null : { name: `${credits} crédits`, cents, credits };
  }
  const annual = code.endsWith("-annual");
  const base = annual ? code.slice(0, -7) : code;
  const current=base.endsWith("-credits-v2");
  const id=current?base.slice(0,-11):base;
  const plan = plans.find((p) => p.id === id);
  if (plan) {
    const period: BillingPeriod = annual ? "year" : "month";
    return {
      ...plan,
      planId: plan.id,
      period,
      cents: annual ? annualPrice(plan.cents) : plan.cents,
      credits: (current?plan.credits:legacyPlanCredits[plan.id])*(annual?12:1),
    };
  }
  return annual ? null : [...packs,...legacyPacks].find((p) => p.id === code);
}
