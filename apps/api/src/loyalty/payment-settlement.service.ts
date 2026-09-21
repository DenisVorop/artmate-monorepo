import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { readOrderPricing } from "../orders/pricing/read-order-pricing";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyWalletService } from "./wallet.service";

const rulesVersion = "order-spend-v1";

@Injectable()
export class LoyaltyPaymentSettlementService {
  private readonly logger = new Logger(LoyaltyPaymentSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  async processEvent(
    eventId: string,
  ): Promise<{ processed: true; replayed: boolean }> {
    const event = await this.prisma.orderPaymentEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException("Order payment event not found");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${event.orderId} FOR UPDATE`;
        const receipt = await tx.loyaltyPaymentReceipt.findUnique({
          where: { eventId },
        });
        if (receipt?.processedAt)
          return { processed: true as const, replayed: true };
        const order = await tx.order.findUnique({
          where: { id: event.orderId },
          include: { items: true },
        });
        if (!order) throw new ConflictException("Loyalty order not found");
        const sourceTime =
          event.kind === "PAID" ? order.paidAt : order.paymentClosedUnpaidAt;
        if (
          !sourceTime ||
          sourceTime.getTime() !== event.occurredAt.getTime()
        ) {
          throw new ConflictException(
            "Payment event timestamp does not match its source fact",
          );
        }
        const paid = order.paymentStatus === "PAID" && order.paidAt !== null;
        const closed =
          order.paymentStatus === "CLOSED_UNPAID" &&
          order.paymentClosedUnpaidAt !== null &&
          !order.paidAt;
        if ((!paid && !closed) || (event.kind === "PAID" && !paid)) {
          throw new ConflictException(
            "Payment event does not match the current final order state",
          );
        }
        const snapshot = readOrderPricing(order);
        const points = snapshot.items.reduce(
          (sum, item) => sum + BigInt(item.loyaltyPoints),
          0n,
        );
        const reservation = await tx.loyaltyReservation.findUnique({
          where: { orderId: order.id },
        });
        if (reservation ? reservation.points !== points : points !== 0n) {
          throw new ConflictException(
            "Loyalty reservation does not match order pricing",
          );
        }
        if (reservation) {
          const member = await tx.loyaltyMember.findUnique({
            where: { id: reservation.memberId },
          });
          if (!member || member.userId !== order.checkoutActorUserId) {
            throw new ConflictException(
              "Loyalty reservation does not belong to checkout actor",
            );
          }
          const command = {
            memberId: reservation.memberId,
            orderId: order.id,
            operationKey: `order:${order.id}:${paid ? "consume" : "release"}`,
            sourceKey: `order:${order.id}`,
            rulesVersion,
            occurredAt: (paid ? order.paidAt : order.paymentClosedUnpaidAt)!,
          };
          // A stale closed event follows the current PAID fact, never releases it.
          if (paid) await this.wallet.consumeInTransaction(tx, command);
          else await this.wallet.releaseInTransaction(tx, command);
        }
        const processedAt = new Date();
        await tx.loyaltyPaymentReceipt.upsert({
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
      // Separate transaction: the published payment fact survives consumer failure.
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${event.orderId} FOR UPDATE`;
        const receipt = await tx.loyaltyPaymentReceipt.findUnique({
          where: { eventId },
        });
        if (receipt?.processedAt) return;
        const attempts = Math.min((receipt?.attempts ?? 0) + 1, 2_147_483_647);
        const delayMs = Math.min(
          15_000 * 2 ** Math.min(attempts - 1, 8),
          3_600_000,
        );
        const nextAttemptAt = new Date(Date.now() + delayMs);
        await tx.loyaltyPaymentReceipt.upsert({
          where: { eventId },
          create: {
            eventId,
            attempts,
            nextAttemptAt,
            lastError: "settlement_failed",
          },
          update: { attempts, nextAttemptAt, lastError: "settlement_failed" },
        });
      });
      throw error;
    }
  }

  async processDueEvents(limit = 50): Promise<void> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid settlement batch size");
    const events = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT event.id FROM order_payment_events event
      LEFT JOIN loyalty_payment_receipts receipt ON receipt.event_id = event.id
      WHERE receipt.event_id IS NULL
        OR (receipt.processed_at IS NULL AND receipt.next_attempt_at <= CURRENT_TIMESTAMP)
      ORDER BY event.created_at, event.id LIMIT ${limit}
    `;
    for (const event of events) {
      try {
        await this.processEvent(event.id);
      } catch {
        this.logger.warn(
          "Loyalty payment settlement failed; durable retry remains pending",
        );
      }
    }
  }
}
