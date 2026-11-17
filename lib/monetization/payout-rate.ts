import {billingLive} from "./mode";
export function payoutRate() {
  const n = Number(billingLive()?process.env.MENTORA_LIVE_PAYOUT_CENTS:(process.env.MENTORA_TEST_PAYOUT_CENTS || 1.6));
  if (!Number.isFinite(n) || !Number.isInteger(n*100) || n <= 0 || n > 1000)
    throw Error("Taux de rémunération non configuré");
  return n;
}

