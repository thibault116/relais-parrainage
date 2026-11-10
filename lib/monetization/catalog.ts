export const plans = [
  { id: "free", name: "Free", cents: 0, credits: 0 },
  { id: "starter", name: "Starter", cents: 1490, credits: 10 },
  { id: "plus", name: "Plus", cents: 2990, credits: 22 },
  { id: "pro", name: "Pro", cents: 4990, credits: 38 },
];
export const packs = [
  { id: "pack5", name: "5 crédits", cents: 890, credits: 5 },
  { id: "pack10", name: "10 crédits", cents: 1690, credits: 10 },
  { id: "pack20", name: "20 crédits", cents: 3290, credits: 20 },
  { id: "pack40", name: "40 crédits", cents: 6290, credits: 40 },
];
export function offer(id: string) {
  return [...plans, ...packs].find((p) => p.id === id);
}
export function payoutRate() {
  const n = Number(process.env.MENTORA_TEST_PAYOUT_CENTS || 150);
  if (!Number.isInteger(n) || n < 0 || n > 1000)
    throw Error("Taux de rémunération test invalide");
  return n;
}

export const annualDiscount = 20;
export const maxCustomCredits = 1000;
export type BillingPeriod = "month" | "year";

export function annualPrice(monthlyCents: number) {
  return Math.round((monthlyCents * 12 * (100 - annualDiscount)) / 100);
}

export function customCreditsPrice(credits: number) {
  if (!Number.isInteger(credits) || credits < 1 || credits > maxCustomCredits)
    return null;

  let previous = { credits: 0, cents: 0 };
  for (const pack of packs) {
    if (credits <= pack.credits) {
      const rate = (pack.cents - previous.cents) / (pack.credits - previous.credits);
      return previous.cents + Math.round((credits - previous.credits) * rate);
    }
    previous = pack;
  }
  return previous.cents + (credits - previous.credits) * 150;
}

export function checkoutOffer(code: string) {
  const custom = /^custom-v1-(\d{1,4})$/.exec(code);
  if (custom) {
    const credits = Number(custom[1]);
    const cents = customCreditsPrice(credits);
    return cents === null ? null : { name: `${credits} crédits`, cents, credits };
  }
  const annual = code.endsWith("-annual");
  const id = annual ? code.slice(0, -7) : code;
  const plan = plans.find((p) => p.id === id);
  if (plan) {
    const period: BillingPeriod = annual ? "year" : "month";
    return {
      ...plan,
      planId: plan.id,
      period,
      cents: annual ? annualPrice(plan.cents) : plan.cents,
      credits: annual ? plan.credits * 12 : plan.credits,
    };
  }
  return annual ? null : packs.find((p) => p.id === code);
}
