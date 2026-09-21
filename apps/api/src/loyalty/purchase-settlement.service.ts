import { ConflictException, Injectable, Logger } from "@nestjs/common";

import { readOrderPricing } from "../orders/pricing/read-order-pricing";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../generated/prisma/client";
import type { PurchaseHistoryEntry } from "./history-preview";
import { LoyaltyWalletService } from "./wallet.service";
import {
  purchasePointsForAmount,
  purchaseRulesVersion,
} from "./purchase-rules";

/** Reconciles published order facts into loyalty-owned accounting, never payments. */
@Injectable()
export class LoyaltyPurchaseSettlementService {
  private readonly logger = new Logger(LoyaltyPurchaseSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  async processOrder(
    orderId: string,
  ): Promise<{ processed: boolean; replayed: boolean }> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.processOrderInTransaction(tx, orderId),
      );
    } catch (error) {
      // A failed consumer must not roll back delivery, payment or a recorded refund.
      await this.prisma.$executeRaw`
        INSERT INTO loyalty_purchase_syncs (order_id, attempts, next_attempt_at, last_error, updated_at)
        VALUES (${orderId}, 1, clock_timestamp() + INTERVAL '15 seconds', 'purchase_processing_failed', clock_timestamp())
        ON CONFLICT (order_id) DO UPDATE SET
          attempts = LEAST(loyalty_purchase_syncs.attempts + 1, 1000000),
          next_attempt_at = clock_timestamp() + LEAST(3600, 15 * power(2, LEAST(loyalty_purchase_syncs.attempts, 8))) * INTERVAL '1 second',
          last_error = 'purchase_processing_failed', updated_at = clock_timestamp()
      `;
      throw error;
    }
  }

  async processOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    history?: { memberId: string; entry: PurchaseHistoryEntry },
  ): Promise<{ processed: boolean; replayed: boolean }> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, refunds: { include: { event: true } } },
    });
    if (!order) return { processed: false, replayed: false };
    const account = await tx.loyaltyPurchaseAccount.findUnique({
      where: { orderId },
    });
    if (order.paymentStatus !== "PAID" || !order.paidAt)
      return { processed: false, replayed: false };
    // An old order is writable only with a verified history source; later
    // corrections use its immutable account, never today's customer tier.
    const hasCheckoutRate = order.loyaltyRatePercent !== null;
    if (!hasCheckoutRate && !account && !history)
      return { processed: false, replayed: false };
    if (
      (hasCheckoutRate && order.loyaltyRateVersion !== purchaseRulesVersion) ||
      (!hasCheckoutRate && order.loyaltyRateVersion !== null)
    )
      throw new ConflictException("Unsupported purchase reward rules");
    if (!account && (order.crmStatus !== "COMPLETED" || !order.completedAt))
      return { processed: false, replayed: false };
    if (!order.userId) return { processed: false, replayed: false };
    const identity = await tx.loyaltyMember.findUnique({
      where: { userId: order.userId },
    });
    if (!identity) return { processed: false, replayed: false };
    await tx.$queryRaw`SELECT id FROM loyalty_members WHERE id = ${identity.id} FOR UPDATE`;
    const member = await tx.loyaltyMember.findUnique({
      where: { id: identity.id },
      include: { user: true },
    });
    if (
      !member ||
      member.userId !== order.userId ||
      (account && account.memberId !== member.id)
    )
      throw new ConflictException("Purchase reward owner does not match order");
    let historicalContext = false;
    if (history) {
      if (history.memberId !== member.id || history.entry.orderId !== orderId)
        throw new ConflictException(
          "Purchase history owner does not match order",
        );
      const [context] = await tx.$queryRaw<Array<{ active: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM loyalty_purchase_history_syncs
          WHERE member_id = ${member.id} AND active_transaction_id = txid_current()) AS active
      `;
      historicalContext = context?.active === true;
      if (!historicalContext)
        throw new ConflictException(
          "Purchase history transaction is not active",
        );
    }
    if (
      !account &&
      (member.status !== "ACTIVE" ||
        (member.historyState !== "READY" &&
          !(historicalContext && member.historyState === "PENDING")) ||
        member.user.status !== "ACTIVE" ||
        member.user.deletedAt)
    )
      return { processed: false, replayed: false };
    const ratePercent =
      order.loyaltyRatePercent ??
      account?.ratePercent ??
      history?.entry.ratePercent;
    if (ratePercent === undefined)
      throw new ConflictException("Purchase reward rate is missing");
    const pricing = readOrderPricing(order);
    const baseKopecks = BigInt(pricing.itemsTotalKopecks);
    let refundedKopecks = 0n;
    for (const refund of order.refunds) {
      if (
        !refund.event ||
        refund.event.occurredAt.getTime() !== refund.createdAt.getTime() ||
        refund.totalKopecks < refund.deliveryKopecks ||
        refund.deliveryKopecks < 0n
      )
        throw new ConflictException("Purchase refund source is invalid");
      refundedKopecks += refund.totalKopecks - refund.deliveryKopecks;
    }
    if (refundedKopecks > baseKopecks)
      throw new ConflictException("Purchase refunds exceed merchandise value");
    const usedPoints = pricing.items.some((item) => item.loyaltyPoints > 0);
    const remainingPoints = usedPoints
      ? 0n
      : purchasePointsForAmount(baseKopecks - refundedKopecks, ratePercent);
    let replayed = false;
    if (!account) {
      const occurredAt = new Date(
        Math.max(order.paidAt.getTime(), order.completedAt!.getTime()),
      );
      await tx.loyaltyPurchaseAccount.create({
        data: {
          orderId,
          memberId: member.id,
          ratePercent,
          rulesVersion: purchaseRulesVersion,
          ...(!hasCheckoutRate
            ? {
                historicalVersion: "purchase-history-v1",
                historicalSpendKopecks: BigInt(
                  history!.entry.spendBeforeCheckoutKopecks,
                ),
              }
            : {}),
          baseKopecks,
          grantedPoints: remainingPoints,
          refundedKopecks,
          occurredAt,
        },
      });
      if (remainingPoints > 0n)
        await this.wallet.creditPurchaseInTransaction(tx, { orderId });
    } else {
      if (
        account.baseKopecks !== baseKopecks ||
        account.ratePercent !== ratePercent ||
        account.rulesVersion !== purchaseRulesVersion ||
        (!hasCheckoutRate &&
          account.historicalVersion !== "purchase-history-v1") ||
        account.refundedKopecks > refundedKopecks ||
        account.reversedPoints > account.grantedPoints ||
        (usedPoints && account.grantedPoints !== 0n)
      )
        throw new ConflictException(
          "Purchase accounting does not match immutable source",
        );
      const target =
        remainingPoints < account.grantedPoints
          ? remainingPoints
          : account.grantedPoints;
      const reversal = account.grantedPoints - account.reversedPoints - target;
      if (reversal < 0n)
        throw new ConflictException(
          "Purchase reversal cannot create a second grant",
        );
      replayed = account.refundedKopecks === refundedKopecks && reversal === 0n;
      if (reversal > 0n)
        await this.wallet.reversePurchaseInTransaction(tx, {
          orderId,
          points: Number(reversal),
          refundedKopecks,
        });
      if (!replayed)
        await tx.loyaltyPurchaseAccount.update({
          where: { orderId },
          data: {
            refundedKopecks,
            reversedPoints: account.reversedPoints + reversal,
          },
        });
    }
    // Queue state is technical; it never changes a bank/order fact.
    await tx.loyaltyPurchaseSync.deleteMany({ where: { orderId } });
    return { processed: true, replayed };
  }

  async processDueOrders(limit = 50): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
      throw new Error("Invalid purchase reconciliation batch size");
    const candidates = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o.id FROM orders o
      LEFT JOIN loyalty_members m ON m.user_id = o.user_id
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN loyalty_purchase_accounts a ON a.order_id = o.id
      LEFT JOIN loyalty_purchase_syncs s ON s.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(r.total_kopecks - r.delivery_kopecks), 0) AS refunded
        FROM order_refunds r JOIN order_refund_events e ON e.refund_id = r.id WHERE r.order_id = o.id
      ) r ON TRUE
      WHERE o.payment_status = 'paid' AND o.paid_at IS NOT NULL
        AND ((o.loyalty_rate_percent IS NOT NULL AND o.loyalty_rate_version = ${purchaseRulesVersion})
          OR (a.historical_version = 'purchase-history-v1' AND a.rules_version = ${purchaseRulesVersion}))
        AND (s.order_id IS NULL OR s.next_attempt_at <= clock_timestamp())
        AND ((a.order_id IS NULL AND o.crm_status = 'completed' AND o.completed_at IS NOT NULL
              AND m.status = 'active' AND m.history_state = 'ready' AND u.status = 'active' AND u.deleted_at IS NULL)
          OR (a.order_id IS NOT NULL AND r.refunded > a.refunded_kopecks))
      ORDER BY COALESCE(s.next_attempt_at, o.created_at), o.id LIMIT ${limit}
    `;
    let processed = 0;
    for (const candidate of candidates) {
      try {
        if ((await this.processOrder(candidate.id)).processed) processed += 1;
      } catch {
        this.logger.warn(
          "Purchase reward processing failed; automatic retry remains pending",
        );
      }
    }
    return processed;
  }
}
