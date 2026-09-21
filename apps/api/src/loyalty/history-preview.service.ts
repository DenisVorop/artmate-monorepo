import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { readOrderPricing } from "../orders/pricing/read-order-pricing";
import { PrismaService } from "../prisma/prisma.service";
import {
  previewPurchaseHistory,
  type HistoricalPurchase,
  type PurchaseHistoryIssue,
} from "./history-preview";

/** Internal read-only source reader shared by preview and historical settlement. */
@Injectable()
export class LoyaltyHistoryPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async previewMember(memberId: string) {
    return this.prisma.$transaction(
      (tx) => this.previewMemberInTransaction(tx, memberId),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async previewMemberInTransaction(
    tx: Prisma.TransactionClient,
    memberId: string,
  ) {
    const member = await tx.loyaltyMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException("Loyalty member not found");
    // Never attach guest orders or infer ownership from the recipient email.
    const orders = await tx.order.findMany({
      where: { userId: member.userId },
      include: {
        items: true,
        refunds: { include: { event: true } },
        history: {
          where: { eventType: "status_changed" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        purchaseAccount: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const operations = await tx.loyaltyOperation.findMany({
      where: {
        memberId,
        OR: [
          { sourceKey: { startsWith: "purchase:" } },
          { operationKey: { startsWith: "purchase:" } },
        ],
      },
      select: { sourceKey: true, purchaseOrderId: true },
    });
    const issues: PurchaseHistoryIssue[] = [];
    for (const operation of operations) {
      if (!operation.purchaseOrderId)
        issues.push({
          orderId: operation.sourceKey,
          reason: "unlinked_existing_purchase_operation",
        });
    }
    const sources: HistoricalPurchase[] = [];
    for (const order of orders) {
      // Unfinished, never completed purchases have no effect on past reward tiers.
      if (
        order.paymentStatus !== "PAID" &&
        !order.paidAt &&
        !order.completedAt &&
        order.crmStatus !== "COMPLETED" &&
        order.refunds.length === 0
      )
        continue;
      try {
        const pricing = readOrderPricing(order);
        if (
          order.refunds.reduce(
            (sum, refund) => sum + refund.deliveryKopecks,
            0n,
          ) > BigInt(pricing.deliveryKopecks)
        )
          throw new Error("Refunded delivery exceeds checkout delivery");
        const transitions = order.history.map((event) => {
          const payload = event.payload as Record<string, unknown> | null;
          if (
            !payload ||
            (typeof payload.fromStatus !== "string" &&
              !(
                payload.fromStatus === null &&
                payload.source === "order_created"
              )) ||
            typeof payload.toStatus !== "string"
          )
            throw new Error("Invalid status history");
          return {
            at: event.createdAt,
            from: payload.fromStatus,
            to: payload.toStatus,
          };
        });
        const refunds = order.refunds.map((refund) => {
          if (
            !refund.event ||
            refund.event.occurredAt.getTime() !== refund.createdAt.getTime() ||
            refund.deliveryKopecks < 0n ||
            refund.totalKopecks < refund.deliveryKopecks
          )
            throw new Error("Invalid published refund");
          return {
            at: refund.createdAt,
            cashKopecks: refund.totalKopecks - refund.deliveryKopecks,
          };
        });
        if (
          order.purchaseAccount &&
          order.purchaseAccount.memberId !== memberId
        )
          throw new Error("Purchase accounting owner mismatch");
        sources.push({
          id: order.id,
          createdAt: order.createdAt,
          paidAt: order.paidAt,
          completedAt: order.completedAt,
          paid: order.paymentStatus === "PAID",
          status: order.crmStatus.toLowerCase(),
          cashKopecks: BigInt(pricing.itemsTotalKopecks),
          spentPoints: pricing.items.some((item) => item.loyaltyPoints > 0),
          ratePercent: order.loyaltyRatePercent,
          rateVersion: order.loyaltyRateVersion,
          accountRatePercent: order.purchaseAccount?.ratePercent,
          refunds,
          transitions,
          accounted: order.purchaseAccount !== null,
        });
      } catch {
        issues.push({
          orderId: order.id,
          reason: "invalid_purchase_source",
        });
      }
    }
    return { memberId, ...previewPurchaseHistory(sources, issues) };
  }
}
