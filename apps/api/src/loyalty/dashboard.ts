import { Prisma } from "../generated/prisma/client";
import { readPublishedPurchaseSpend } from "../orders/published-purchase-spend";
import type { LoyaltyDashboardDTO } from "./dto";
import { purchaseRateForSpend, purchaseTiers } from "./purchase-rules";

/** Read within the caller's coherent snapshot; no reward processing or writes. */
export async function readLoyaltyDashboard(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<LoyaltyDashboardDTO> {
  const spend = await readPublishedPurchaseSpend(tx, { userId });
  if (spend > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError("Loyalty spending exceeds safe integer range");
  const next = purchaseTiers.find(
    (tier) => BigInt(tier.thresholdKopecks) > spend,
  );
  return {
    tier: {
      ratePercent: purchaseRateForSpend(spend),
      spendKopecks: Number(spend),
      nextThresholdKopecks: next?.thresholdKopecks ?? null,
      nextRatePercent: next?.ratePercent ?? null,
    },
  };
}
