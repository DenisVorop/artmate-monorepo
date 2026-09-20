import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { LoyaltyWalletService } from "../loyalty/wallet.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  applyLoyaltyPoints,
  getMaxLoyaltyPoints,
} from "./pricing/apply-loyalty-points";
import {
  parseOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "./pricing/pricing-snapshot";
import { readOrderPricing } from "./pricing/read-order-pricing";

const rulesVersion = "order-spend-v1";
type PreviewInput = {
  userId?: string;
  snapshot: OrderPricingSnapshot;
  points: number;
};
type Reader = Pick<Prisma.TransactionClient, "loyaltyMember">;

/** Order owns the transaction and verifies acquiring notifications before settlement. */
@Injectable()
export class OrdersLoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  preview(input: PreviewInput) {
    return this.calculate(this.prisma, input);
  }

  async reserveInTransaction(
    tx: Prisma.TransactionClient,
    input: PreviewInput & { orderId: string; pricingRevision?: string },
  ): Promise<OrderPricingSnapshot> {
    assertPoints(input.points);
    if (input.points === 0) return parseOrderPricingSnapshot(input.snapshot);
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
    const result = await this.calculate(tx, input);
    if (input.pricingRevision !== result.loyalty.pricingRevision) {
      throw new ConflictException({
        code: "LOYALTY_PRICING_CHANGED",
        message: "Обновите расчёт заказа",
      });
    }
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (
      !order ||
      order.checkoutActorUserId !== input.userId ||
      !result.memberId
    ) {
      throw new ConflictException(
        "Order does not belong to this checkout actor",
      );
    }
    await this.wallet.reserveInTransaction(tx, {
      orderId: order.id,
      memberId: result.memberId,
      points: input.points,
      operationKey: `order:${order.id}:reserve`,
      sourceKey: `order:${order.id}`,
      rulesVersion,
      occurredAt: order.createdAt,
    });
    return result.snapshot;
  }

  async consumePaidInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const { order, reservation } = await this.readSettlement(tx, orderId);
    if (!reservation) return;
    if (order.paymentStatus !== "PAID" || !order.paidAt) {
      throw new ConflictException(
        "Loyalty spending requires confirmed payment",
      );
    }
    // Never reinterpret a released hold as new spending or silently forgive it.
    // A contradictory provider state requires manual reconciliation.
    await this.wallet.consumeInTransaction(tx, {
      orderId,
      memberId: reservation.memberId,
      operationKey: `order:${orderId}:consume`,
      sourceKey: `order:${orderId}`,
      rulesVersion,
      occurredAt: order.paidAt,
    });
  }

  async releaseCancelledTBankInTransaction(
    tx: Prisma.TransactionClient,
    input: { orderId: string; paymentId: string; amountKopecks: number },
  ) {
    const { order, reservation } = await this.readSettlement(tx, input.orderId);
    if (!reservation || order.paymentStatus === "PAID" || order.paidAt) return;
    if (
      order.paymentMethod !== "TBANK_ACQUIRING" ||
      order.tbankAcquiringPaymentId !== input.paymentId ||
      !order.terminalPaymentFailedAt ||
      readOrderPricing(order).totalKopecks !== input.amountKopecks
    ) {
      throw new ConflictException(
        "Loyalty release requires verified closed unpaid payment",
      );
    }
    await this.wallet.releaseInTransaction(tx, {
      orderId: order.id,
      memberId: reservation.memberId,
      operationKey: `order:${order.id}:release`,
      sourceKey: `order:${order.id}`,
      rulesVersion,
      occurredAt: order.terminalPaymentFailedAt,
    });
  }

  private async calculate(reader: Reader, input: PreviewInput) {
    assertPoints(input.points);
    const base = parseOrderPricingSnapshot(input.snapshot);
    const member = input.userId
      ? await reader.loyaltyMember.findUnique({
          where: { userId: input.userId },
          include: {
            wallet: true,
            user: { select: { status: true, deletedAt: true } },
          },
        })
      : null;
    const ready =
      member?.status === "ACTIVE" &&
      member.historyState === "READY" &&
      member.user.status === "ACTIVE" &&
      !member.user.deletedAt;
    if (member && !member.wallet)
      throw new ConflictException("Loyalty wallet is missing");
    const balance = member?.wallet?.balancePoints ?? 0n;
    const reserved = member?.wallet?.reservedPoints ?? 0n;
    if (
      balance < 0n ||
      reserved < 0n ||
      reserved > balance ||
      balance > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw new ConflictException("Loyalty wallet is inconsistent");
    }
    const availablePoints = ready ? Number(balance - reserved) : 0;
    const subRuble = base.items.some((item) =>
      item.priceGroups.some((group) => group.unitPriceKopecks < 100),
    );
    const maxPoints =
      ready && !subRuble
        ? Math.min(availablePoints, getMaxLoyaltyPoints(base))
        : 0;
    if (input.points > maxPoints) {
      throw new ConflictException({
        code: "LOYALTY_SPENDING_UNAVAILABLE",
        message: "Списание бонусов недоступно для этого заказа",
      });
    }
    const snapshot = applyLoyaltyPoints(base, input.points);
    const pricingRevision = createHash("sha256")
      .update(
        JSON.stringify({
          rulesVersion,
          userId: input.userId ?? null,
          points: input.points,
          snapshot: {
            ...snapshot,
            items: [...snapshot.items].sort((a, b) =>
              a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
            ),
          },
        }),
      )
      .digest("hex");
    return {
      memberId: member?.id,
      snapshot,
      loyalty: {
        availablePoints,
        maxPoints,
        pointsToSpend: input.points,
        discountKopecks: snapshot.loyaltyDiscountKopecks,
        pricingRevision,
      },
    };
  }

  private async readSettlement(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new ConflictException("Loyalty order not found");
    const reservation = await tx.loyaltyReservation.findUnique({
      where: { orderId },
    });
    if (reservation) {
      const member = await tx.loyaltyMember.findUnique({
        where: { id: reservation.memberId },
      });
      if (!member || member.userId !== order.checkoutActorUserId) {
        throw new ConflictException(
          "Loyalty reservation does not belong to checkout actor",
        );
      }
    }
    const snapshot = readOrderPricing(order);
    const points = snapshot.items.reduce(
      (sum, item) => sum + item.loyaltyPoints,
      0,
    );
    if (reservation ? reservation.points !== BigInt(points) : points !== 0) {
      throw new ConflictException(
        "Loyalty reservation does not match order pricing",
      );
    }
    return { order, reservation };
  }
}

function assertPoints(points: number) {
  if (!Number.isSafeInteger(points) || points < 0) {
    throw new BadRequestException(
      "Loyalty points must be a nonnegative safe integer",
    );
  }
}
