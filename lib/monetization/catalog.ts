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
