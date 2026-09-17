import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import {
  type AffiliateOrderSnapshot,
  buildAffiliateCommissionAccrual,
} from "./affiliate-commission-accrual";
import {
  calculateAffiliateCommissionReversal,
  getAffiliateCommissionAvailableAt,
  type AffiliateCommissionSnapshot,
} from "./commission";
import { AffiliatePayoutsService } from "./affiliate-payouts.service";

@Injectable()
export class AffiliateFinancialAccountingService {
  constructor(
    private readonly payoutsService: AffiliatePayoutsService,
  ) {}

  async recordPaidOrderInTransaction(
    tx: Prisma.TransactionClient,
    order: AffiliateOrderSnapshot & { id: string },
  ) {
    const existing = await tx.affiliateCommission.findUnique({
      where: { orderId: order.id },
    });
    if (existing) return existing;

    const accrual = buildAffiliateCommissionAccrual(order);
    if (!accrual) return undefined;

    // Common financial lock order: order -> partner -> commission/refund rows.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "affiliate_partners" WHERE "id" = ${accrual.partnerId} FOR UPDATE`,
    );
    const commission = await tx.affiliateCommission.create({
      data: {
        orderId: order.id,
        partnerId: accrual.partnerId,
        codeSnapshot: accrual.codeSnapshot,
        partnerPercent: accrual.partnerPercent,
        buyerPercent: accrual.buyerPercent,
        isSelfPurchase: accrual.isSelfPurchase,
        subtotalKopecks: BigInt(accrual.subtotalKopecks),
        earnedKopecks: BigInt(accrual.earnedKopecks),
        itemSnapshot: accrual.itemSnapshot as unknown as Prisma.InputJsonValue,
        availableAt: accrual.availableAt,
      },
    });
    await tx.affiliateLedgerEntry.create({
      data: {
        commissionId: commission.id,
        orderId: order.id,
        partnerId: accrual.partnerId,
        kind: "CREDIT",
        amountKopecks: BigInt(accrual.earnedKopecks),
        operationKey: `order:${order.id}:affiliate-credit`,
      },
    });
    return commission;
  }

  async recordCompletionInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    completedAt: Date,
  ) {
    const commission = await tx.affiliateCommission.findUnique({
      where: { orderId },
      select: { availableAt: true, id: true, partnerId: true },
    });
    if (!commission || commission.availableAt) return;

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "affiliate_partners" WHERE "id" = ${commission.partnerId} FOR UPDATE`,
    );
    await tx.affiliateCommission.update({
      where: { id: commission.id },
      data: { availableAt: getAffiliateCommissionAvailableAt(completedAt) },
    });
  }

  async recordRefundReversalInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      commission: {
        earnedKopecks: bigint;
        id: string;
        itemSnapshot: unknown;
        orderId: string;
        partnerId: string;
        subtotalKopecks: bigint;
      };
      nextReturnedQuantities: readonly { id: string; quantity: number }[];
      previousReturnedQuantities: readonly { id: string; quantity: number }[];
      refundId: string;
    },
  ) {
    const existing = await tx.affiliateLedgerEntry.findUnique({
      where: { refundId: input.refundId },
    });
    if (existing) return Math.abs(safeBigIntToNumber(existing.amountKopecks));

    const snapshot: AffiliateCommissionSnapshot = {
      subtotalKopecks: safeBigIntToNumber(input.commission.subtotalKopecks),
      commissionKopecks: safeBigIntToNumber(input.commission.earnedKopecks),
      items: parseCommissionItems(input.commission.itemSnapshot),
    };
    const reversal = calculateAffiliateCommissionReversal(
      snapshot,
      input.previousReturnedQuantities,
      input.nextReturnedQuantities,
    );
    if (reversal.reversedCommissionKopecks === 0) return 0;

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "affiliate_partners" WHERE "id" = ${input.commission.partnerId} FOR UPDATE`,
    );
    await tx.affiliateLedgerEntry.create({
      data: {
        commissionId: input.commission.id,
        orderId: input.commission.orderId,
        partnerId: input.commission.partnerId,
        refundId: input.refundId,
        kind: "REVERSAL",
        amountKopecks: -BigInt(reversal.reversedCommissionKopecks),
        operationKey: `refund:${input.refundId}:affiliate-reversal`,
      },
    });
    await this.payoutsService.cancelPendingInTransaction(
      tx,
      input.commission.partnerId,
      "Возврат заказа изменил партнёрское вознаграждение",
    );
    return reversal.reversedCommissionKopecks;
  }

  async recordEligibilityLossInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const commission = await tx.affiliateCommission.findUnique({
      where: { orderId },
      select: {
        availableAt: true,
        earnedKopecks: true,
        partnerId: true,
        ledgerEntries: {
          select: { amountKopecks: true, kind: true },
        },
      },
    });
    if (!commission) return;
    const credits = commission.ledgerEntries.filter(
      (entry) => entry.kind === "CREDIT",
    );
    const credited = credits.reduce(
      (sum, entry) => sum + entry.amountKopecks,
      0n,
    );
    const reversed = commission.ledgerEntries
      .filter((entry) => entry.kind === "REVERSAL")
      .reduce((sum, entry) => sum - entry.amountKopecks, 0n);
    if (
      credits.length !== 1 ||
      credited !== commission.earnedKopecks ||
      reversed > credited
    ) {
      throw new Error("Affiliate commission ledger is inconsistent");
    }
    if (credited - reversed === 0n) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "affiliate_partners" WHERE "id" = ${commission.partnerId} FOR UPDATE`,
    );
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "now"`,
    );
    if (!clock) throw new Error("Could not capture affiliate eligibility time");
    if (
      !commission.availableAt ||
      commission.availableAt.getTime() > clock.now.getTime()
    ) {
      return;
    }
    await this.payoutsService.cancelPendingInTransaction(
      tx,
      commission.partnerId,
      "Статус заказа изменил доступность партнёрского вознаграждения",
    );
  }
}

function parseCommissionItems(value: unknown) {
  if (!Array.isArray(value)) {
    throw new TypeError("Affiliate commission item snapshot is invalid");
  }
  return value.map((entry, index) => {
    const item = asObject(entry);
    return {
      id: requiredString(item?.id, `Commission item ${index} id`),
      quantity: requiredInteger(
        item?.quantity,
        `Commission item ${index} quantity`,
      ),
      subtotalKopecks: requiredInteger(
        item?.subtotalKopecks,
        `Commission item ${index} subtotal`,
      ),
      commissionKopecks: requiredInteger(
        item?.commissionKopecks,
        `Commission item ${index} commission`,
      ),
    };
  });
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function requiredInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} is invalid`);
  return value as number;
}

function safeBigIntToNumber(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Affiliate amount exceeds safe integer range");
  }
  return result;
}
