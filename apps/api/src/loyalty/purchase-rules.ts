/** Published, pure purchase rules. No provider or wallet orchestration. */
export const purchaseRulesVersion = "purchase-v1";
const rates = [3, 5, 7, 10] as const;
export const purchaseTiers = [
  { thresholdKopecks: 0, ratePercent: 3 },
  { thresholdKopecks: 300_000, ratePercent: 5 },
  { thresholdKopecks: 700_000, ratePercent: 7 },
  { thresholdKopecks: 1_200_000, ratePercent: 10 },
] as const;
export type PurchaseRate = (typeof rates)[number];

export function purchaseRateForSpend(kopecks: bigint): PurchaseRate {
  if (typeof kopecks !== "bigint" || kopecks < 0n)
    throw new Error("Invalid cumulative purchase amount");
  let rate: PurchaseRate = 3;
  for (const tier of purchaseTiers) {
    if (kopecks >= BigInt(tier.thresholdKopecks)) rate = tier.ratePercent;
  }
  return rate;
}

export function purchasePointsForAmount(kopecks: bigint, rate: number): bigint {
  if (
    typeof kopecks !== "bigint" ||
    kopecks < 0n ||
    !rates.includes(rate as PurchaseRate)
  )
    throw new Error("Invalid purchase reward basis");
  const points = (kopecks * BigInt(rate) * 5n + 9_999n) / 10_000n;
  if (points > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Purchase reward exceeds safe point range");
  return points;
}
