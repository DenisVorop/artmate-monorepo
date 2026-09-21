import { ConflictException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import {
  purchaseRateForSpend,
  purchaseRulesVersion,
} from "../../loyalty/purchase-rules";
import { readPublishedPurchaseSpend } from "../published-purchase-spend";

/** Checkout reads published cash facts without granting rewards. */
export async function readPurchaseRateSnapshot(
  tx: Prisma.TransactionClient,
  input: { orderId: string; userId: string | null },
) {
  if (!input.orderId || (input.userId !== null && !input.userId))
    throw new ConflictException("Invalid checkout buyer for purchase rate");
  const spend =
    input.userId === null
      ? 0n
      : await readPublishedPurchaseSpend(tx, {
          userId: input.userId,
          excludeOrderId: input.orderId,
        });
  return {
    loyaltyRatePercent: purchaseRateForSpend(spend),
    loyaltyRateVersion: purchaseRulesVersion,
  };
}
