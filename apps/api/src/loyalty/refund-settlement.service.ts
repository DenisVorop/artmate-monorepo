import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { readOrderPricing } from "../orders/pricing/read-order-pricing";
import { allocateIncrementalRefund } from "../orders/refunds/refund-accounting";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyWalletService } from "./wallet.service";

@Injectable()
export class LoyaltyRefundSettlementService {
  private readonly logger = new Logger(LoyaltyRefundSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  async processEvent(
    eventId: string,
  ): Promise<{ processed: true; replayed: boolean }> {
    const event = await this.prisma.orderRefundEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException("Order refund event not found");
    const source = await this.prisma.orderRefund.findUnique({
      where: { id: event.refundId },
      select: { orderId: true },
    });
    if (!source) throw new NotFoundException("Order refund not found");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${source.orderId} FOR UPDATE`;
        const receipt = await tx.loyaltyRefundReceipt.findUnique({
          where: { eventId },
        });
        if (receipt?.processedAt)
          return { processed: true as const, replayed: true };
        const refund = await tx.orderRefund.findUnique({
          where: { id: event.refundId },
          include: { items: true },
        });
        if (
          !refund ||
          refund.orderId !== source.orderId ||
          refund.createdAt.getTime() !== event.occurredAt.getTime()
        ) {
          throw new ConflictException(
            "Refund event does not match its immutable source fact",
          );
        }
        const order = await tx.order.findUnique({
          where: { id: refund.orderId },
          include: { items: true },
        });
        if (!order || order.paymentStatus !== "PAID" || !order.paidAt) {
          throw new ConflictException("Refund requires a paid order");
        }
        const snapshot = readOrderPricing(order);
        const delivery = nonnegativeBigInt(refund.deliveryKopecks);
        const total = nonnegativeBigInt(refund.totalKopecks);
        const points = nonnegativeBigInt(refund.loyaltyPoints);
        if (
          delivery > BigInt(snapshot.deliveryKopecks) ||
          total > BigInt(snapshot.totalKopecks) ||
          (refund.items.length === 0 && delivery === 0n)
        ) {
          throw new ConflictException(
            "Refund exceeds the original order amounts",
          );
        }
        const seen = new Set<string>();
        let itemCash = 0n;
        let itemPoints = 0n;
        for (const item of refund.items) {
          if (
            seen.has(item.productId) ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
          ) {
            throw new ConflictException(
              "Invalid refund item quantity or duplicate product",
            );
          }
          seen.add(item.productId);
          const original = snapshot.items.find(
            (original) => original.id === item.productId,
          );
          if (!original)
            throw new ConflictException(
              "Refund product does not belong to order",
            );
          // Persisted ordinals make allocation independent of event processing order.
          const allocated = allocateIncrementalRefund(
            original.priceGroups,
            item.previousQuantity,
            item.quantity,
          );
          if (
            nonnegativeBigInt(item.amountKopecks) !==
              BigInt(allocated.amountKopecks) ||
            nonnegativeBigInt(item.loyaltyPoints) !==
              BigInt(allocated.loyaltyPoints)
          ) {
            throw new ConflictException(
              "Refund item does not match its original paid units",
            );
          }
          itemCash += BigInt(allocated.amountKopecks);
          itemPoints += BigInt(allocated.loyaltyPoints);
        }
        if (itemCash + delivery !== total || itemPoints !== points) {
          throw new ConflictException(
            "Refund totals do not match allocated cash and loyalty points",
          );
        }
        // The wallet requires CONSUMED; refund-before-payment-consumer is retried.
        if (points > 0n)
          await this.wallet.restoreRefundInTransaction(tx, {
            refundId: refund.id,
          });
        const processedAt = new Date();
        await tx.loyaltyRefundReceipt.upsert({
          where: { eventId },
          create: {
            eventId,
            processedAt,
            attempts: 1,
            nextAttemptAt: processedAt,
          },
          update: {
            processedAt,
            attempts: Math.min((receipt?.attempts ?? 0) + 1, 2_147_483_647),
            lastError: null,
          },
        });
        return { processed: true as const, replayed: false };
      });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${source.orderId} FOR UPDATE`;
        const receipt = await tx.loyaltyRefundReceipt.findUnique({
          where: { eventId },
        });
        if (receipt?.processedAt) return;
        const attempts = Math.min((receipt?.attempts ?? 0) + 1, 2_147_483_647);
        const delay = Math.min(
          15_000 * 2 ** Math.min(attempts - 1, 8),
          3_600_000,
        );
        const nextAttemptAt = new Date(Date.now() + delay);
        await tx.loyaltyRefundReceipt.upsert({
          where: { eventId },
          create: {
            eventId,
            attempts,
            nextAttemptAt,
            lastError: "refund_settlement_failed",
          },
          update: {
            attempts,
            nextAttemptAt,
            lastError: "refund_settlement_failed",
          },
        });
      });
      throw error;
    }
  }

  async processDueEvents(limit = 50): Promise<void> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid refund settlement batch size");
    const events = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT event.id FROM order_refund_events event
      LEFT JOIN loyalty_refund_receipts receipt ON receipt.event_id = event.id
      WHERE receipt.event_id IS NULL
        OR (receipt.processed_at IS NULL AND receipt.next_attempt_at <= CURRENT_TIMESTAMP)
      ORDER BY event.created_at, event.id LIMIT ${limit}
    `;
    for (const event of events) {
      try {
        await this.processEvent(event.id);
      } catch {
        this.logger.warn(
          "Loyalty refund settlement failed; durable retry remains pending",
        );
      }
    }
  }
}

function nonnegativeBigInt(value: bigint): bigint {
  if (
    typeof value !== "bigint" ||
    value < 0n ||
    value > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new ConflictException(
      "Refund amount must be a nonnegative safe integer",
    );
  }
  return value;
}
