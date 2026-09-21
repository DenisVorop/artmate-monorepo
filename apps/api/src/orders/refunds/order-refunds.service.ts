import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AffiliateFinancialAccountingService } from "../../affiliate/financial-accounting.service";
import {
  OrderCrmStatus,
  OrderPaymentStatus,
  Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { rublesToKopecks } from "../../promocodes/promocodes.service";
import type { OrderRefundsDTO } from "../dto";
import {
  allocateIncrementalRefund,
  getAffiliateCommissionStatus,
  type RefundPriceGroup,
} from "./refund-accounting";
import { parseOrderRefundRequest } from "./refund-request";
import { readOrderPricing } from "../pricing/read-order-pricing";

const refundOrderInclude = {
  items: { orderBy: { createdAt: "asc" } },
  refunds: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      author: { select: { id: true, name: true } },
      items: true,
      ledgerEntry: true,
    },
  },
  affiliateCommission: {
    include: { ledgerEntries: true },
  },
} satisfies Prisma.OrderInclude;

type RefundOrder = Prisma.OrderGetPayload<{
  include: typeof refundOrderInclude;
}>;

type RefundablePricing = ReadonlyMap<string, readonly RefundPriceGroup[]>;

@Injectable()
export class OrderRefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliateFinancialAccountingService: AffiliateFinancialAccountingService,
  ) {}

  async getOrderRefunds(orderId: string): Promise<OrderRefundsDTO> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: refundOrderInclude,
        });
        if (!order) throw new NotFoundException("Заказ не найден");
        return this.buildProjection(order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async createOrderRefund(
    orderId: string,
    value: unknown,
    authorId: string,
  ): Promise<OrderRefundsDTO> {
    const input = parseOrderRefundRequest(value);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`,
      );
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: refundOrderInclude,
      });
      if (!order) throw new NotFoundException("Заказ не найден");

      const sameRequest = order.refunds.find(
        (refund) => refund.requestId === input.requestId,
      );
      if (sameRequest) {
        if (sameRequest.requestFingerprint !== input.requestFingerprint) {
          throw new ConflictException(
            "requestId уже использован для другого возврата",
          );
        }
        return;
      }
      if (
        order.refunds.some((refund) => refund.reference === input.reference)
      ) {
        throw new ConflictException(
          "Возврат с таким номером операции уже зарегистрирован",
        );
      }
      if (order.paymentStatus !== OrderPaymentStatus.PAID) {
        throw new ConflictException(
          "Возврат можно зарегистрировать только для оплаченного заказа",
        );
      }

      const pricing = this.getRefundablePricing(order);
      const returnedBefore = this.getReturnedQuantities(order);
      const refundItems = input.items.map((requested) => {
        const orderItem = order.items.find(
          (item) => item.productId === requested.productId,
        );
        const priceGroups = pricing.get(requested.productId);
        if (!orderItem || !priceGroups) {
          throw new BadRequestException("Товар не найден в составе заказа");
        }
        const previousQuantity = returnedBefore.get(requested.productId) ?? 0;
        if (previousQuantity + requested.quantity > orderItem.quantity) {
          throw new ConflictException(
            `Количество возврата товара «${orderItem.title}» превышает остаток`,
          );
        }
        const allocation = allocateIncrementalRefund(
          priceGroups,
          previousQuantity,
          requested.quantity,
        );
        return {
          productId: orderItem.productId,
          title: orderItem.title,
          quantity: requested.quantity,
          amountKopecks: allocation.amountKopecks,
          previousQuantity,
          loyaltyPoints: allocation.loyaltyPoints,
        };
      });
      const deliveryPaidKopecks = rublesToKopecks(order.deliveryPrice);
      const deliveryReturnedKopecks = order.refunds.reduce(
        (sum, refund) => sum + safeBigIntToNumber(refund.deliveryKopecks),
        0,
      );
      if (
        deliveryReturnedKopecks + input.deliveryKopecks >
        deliveryPaidKopecks
      ) {
        throw new ConflictException(
          "Сумма возврата доставки превышает оплаченный остаток",
        );
      }
      const merchandiseKopecks = refundItems.reduce(
        (sum, item) => sum + item.amountKopecks,
        0,
      );
      const totalKopecks = merchandiseKopecks + input.deliveryKopecks;
      const loyaltyPoints = refundItems.reduce(
        (sum, item) => sum + BigInt(item.loyaltyPoints),
        0n,
      );
      if (!Number.isSafeInteger(totalKopecks)) {
        throw new BadRequestException("Сумма возврата слишком велика");
      }

      const refund = await tx.orderRefund.create({
        data: {
          orderId,
          authorId,
          requestId: input.requestId,
          requestFingerprint: input.requestFingerprint,
          reference: input.reference,
          reason: input.reason,
          deliveryKopecks: BigInt(input.deliveryKopecks),
          totalKopecks: BigInt(totalKopecks),
          loyaltyPoints,
          items: {
            create: refundItems.map((item) => ({
              productId: item.productId,
              title: item.title,
              quantity: item.quantity,
              amountKopecks: BigInt(item.amountKopecks),
              previousQuantity: item.previousQuantity,
              loyaltyPoints: BigInt(item.loyaltyPoints),
            })),
          },
        },
      });

      await tx.orderRefundEvent.create({
        data: { refundId: refund.id, occurredAt: refund.createdAt },
      });

      let reversedCommissionKopecks = 0;
      if (order.affiliateCommission) {
        const nextReturned = new Map(returnedBefore);
        for (const item of refundItems) {
          nextReturned.set(
            item.productId,
            (nextReturned.get(item.productId) ?? 0) + item.quantity,
          );
        }
        reversedCommissionKopecks =
          await this.affiliateFinancialAccountingService.recordRefundReversalInTransaction(
            tx,
            {
              commission: order.affiliateCommission,
              refundId: refund.id,
              previousReturnedQuantities: toReturnedQuantities(returnedBefore),
              nextReturnedQuantities: toReturnedQuantities(nextReturned),
            },
          );
      }
      await tx.orderHistory.create({
        data: {
          orderId,
          authorId,
          eventType: "refund_recorded",
          payload: {
            refundId: refund.id,
            requestId: input.requestId,
            reference: input.reference,
            deliveryKopecks: input.deliveryKopecks,
            merchandiseKopecks,
            totalKopecks,
            reversedCommissionKopecks,
            source: "admin_manual",
          },
        },
      });
    });

    return this.getOrderRefunds(orderId);
  }

  private buildProjection(order: RefundOrder): OrderRefundsDTO {
    let pricing: RefundablePricing | undefined;
    let pricingError: string | undefined;
    try {
      pricing = this.getRefundablePricing(order);
    } catch {
      pricingError =
        "Сохранённые данные оплаты повреждены, возврат требует проверки";
    }
    const returned = this.getReturnedQuantities(order);
    const items = order.items.map((item) => {
      const returnedQuantity = returned.get(item.productId) ?? 0;
      const groups = pricing?.get(item.productId) ?? [];
      const currentGroups = pricing
        ? allocateIncrementalRefund(groups, returnedQuantity, 0)
            .remainingPriceGroups
        : [];
      const refundableKopecks = pricing
        ? allocateIncrementalRefund(
            groups,
            returnedQuantity,
            item.quantity - returnedQuantity,
          ).amountKopecks
        : 0;
      return {
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        returnedQuantity,
        remainingQuantity: item.quantity - returnedQuantity,
        refundableKopecks,
        remainingPriceGroups: currentGroups.map(
          ({ unitPriceKopecks, quantity }) => ({
            unitPriceKopecks,
            quantity,
          }),
        ),
      };
    });
    const deliveryPaidKopecks = rublesToKopecks(order.deliveryPrice);
    const deliveryReturnedKopecks = order.refunds.reduce(
      (sum, refund) => sum + safeBigIntToNumber(refund.deliveryKopecks),
      0,
    );
    const hasRemaining =
      items.some((item) => item.remainingQuantity > 0) ||
      deliveryReturnedKopecks < deliveryPaidKopecks;
    const blockedReason =
      order.paymentStatus !== OrderPaymentStatus.PAID
        ? "Возврат доступен только после подтверждения оплаты"
        : pricingError
          ? pricingError
          : !hasRemaining
            ? "Заказ уже возвращён полностью"
            : null;
    const totalRefundedKopecks = order.refunds.reduce(
      (sum, refund) => sum + safeBigIntToNumber(refund.totalKopecks),
      0,
    );
    const commission = order.affiliateCommission;
    const reversedKopecks = commission
      ? commission.ledgerEntries
          .filter((entry) => entry.kind === "REVERSAL")
          .reduce(
            (sum, entry) => sum - safeBigIntToNumber(entry.amountKopecks),
            0,
          )
      : 0;
    const earnedKopecks = commission
      ? safeBigIntToNumber(commission.earnedKopecks)
      : 0;

    return {
      orderId: order.id,
      canRecord: blockedReason === null,
      blockedReason,
      items,
      delivery: {
        paidKopecks: deliveryPaidKopecks,
        returnedKopecks: deliveryReturnedKopecks,
        refundableKopecks: deliveryPaidKopecks - deliveryReturnedKopecks,
      },
      totalRefundedKopecks,
      commission: commission
        ? {
            partnerPercent: commission.partnerPercent,
            buyerPercent: commission.buyerPercent,
            isSelfPurchase: commission.isSelfPurchase,
            earnedKopecks,
            reversedKopecks,
            remainingKopecks: Math.max(0, earnedKopecks - reversedKopecks),
            completedAt: order.completedAt?.toISOString() ?? null,
            availableAt: commission.availableAt?.toISOString() ?? null,
            status: getAffiliateCommissionStatus({
              availableAt: commission.availableAt,
              completedAt: order.completedAt,
              earnedKopecks,
              isCancelled: order.crmStatus === OrderCrmStatus.CANCELLED,
              isCompleted: order.crmStatus === OrderCrmStatus.COMPLETED,
              isPaid: order.paymentStatus === OrderPaymentStatus.PAID,
              now: new Date(),
              reversedKopecks,
            }),
          }
        : null,
      refunds: order.refunds.map((refund) => ({
        id: refund.id,
        requestId: refund.requestId,
        reference: refund.reference,
        reason: refund.reason,
        createdAt: refund.createdAt.toISOString(),
        author: { id: refund.author.id, name: refund.author.name },
        items: refund.items.map((item) => ({
          productId: item.productId,
          title: item.title,
          quantity: item.quantity,
          amountKopecks: safeBigIntToNumber(item.amountKopecks),
        })),
        deliveryKopecks: safeBigIntToNumber(refund.deliveryKopecks),
        totalKopecks: safeBigIntToNumber(refund.totalKopecks),
        reversedCommissionKopecks: refund.ledgerEntry
          ? Math.abs(safeBigIntToNumber(refund.ledgerEntry.amountKopecks))
          : 0,
      })),
    };
  }

  private getReturnedQuantities(order: RefundOrder) {
    const returned = new Map<string, number>();
    for (const refund of order.refunds) {
      for (const item of refund.items) {
        returned.set(
          item.productId,
          (returned.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }
    return returned;
  }

  private getRefundablePricing(order: RefundOrder): RefundablePricing {
    const snapshot = readOrderPricing(order);
    return new Map(
      snapshot.items.map((item) => [
        item.id,
        item.priceGroups.map(
          ({ unitPriceKopecks, quantity, loyaltyPointsPerUnit }) => ({
            unitPriceKopecks,
            quantity,
            loyaltyPointsPerUnit,
          }),
        ),
      ]),
    );
  }
}

function safeBigIntToNumber(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Saved amount exceeds safe integer range");
  }
  return result;
}

function toReturnedQuantities(values: ReadonlyMap<string, number>) {
  return [...values].map(([id, quantity]) => ({ id, quantity }));
}
