import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isISO8601 } from "class-validator";

import {
  Prisma,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
  PromoCodeType as PrismaPromoCodeType,
  PromoRedemptionStatus as PrismaPromoRedemptionStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type { PromoCodeInputDTO, UpdatePromoCodeInputDTO } from "./dto";
import { getPromoIneligibilityMessage } from "./eligibility";
import { calculatePromoPricing, type PromoPricingItemInput } from "./pricing";
import { normalizePromoCodeValue, promoCodePattern } from "./promo-code";
import type { PromoCodeType, PromoTerms } from "./promocodes.types";

const adminInclude = {
  redemptions: {
    orderBy: { createdAt: "desc" as const },
    select: { orderId: true, status: true, createdAt: true, usedAt: true },
  },
};

export type PromoTransaction = Prisma.TransactionClient;
type PromoRecord = Prisma.PromoCodeGetPayload<Record<string, never>>;

export type ReservePromoInput = {
  code: string;
  deliveryPriceKopecks: number;
  orderId: string;
  userId?: string;
  items: readonly PromoPricingItemInput[];
  now?: Date;
};

@Injectable()
export class PromocodesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin() {
    const promos = await this.prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
    });
    return promos.map((promo) => this.mapAdmin(promo));
  }

  async getAdmin(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
      include: adminInclude,
    });
    if (!promo) throw new NotFoundException("Промокод не найден");
    return this.mapAdmin(promo, promo.redemptions);
  }

  async createAdmin(input: PromoCodeInputDTO) {
    const data = this.parseInput(input);
    try {
      const promo = await this.prisma.promoCode.create({ data });
      return this.mapAdmin(promo);
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async updateAdmin(id: string, input: UpdatePromoCodeInputDTO) {
    try {
      const promo = await this.prisma.$transaction(async (tx) => {
        await this.lockPromoById(tx, id);
        const current = await tx.promoCode.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Промокод не найден");
        const data = this.parseInput({
          ...input,
          code: input.code ?? current.code,
        });
        if (input.code !== undefined && current.code !== data.code) {
          throw new BadRequestException(
            "Код промокода нельзя изменить после создания",
          );
        }
        if (
          typeof data.maxUses === "number" &&
          data.maxUses !== current.maxUses &&
          current.usedCount + current.reservedCount > data.maxUses
        ) {
          throw new BadRequestException(
            "Новый лимит меньше числа использованных и зарезервированных применений",
          );
        }
        if (
          typeof data.maxUsesPerUser === "number" &&
          data.maxUsesPerUser !== current.maxUsesPerUser
        ) {
          const occupiedByUser = await tx.promoRedemption.groupBy({
            by: ["userId"],
            where: {
              promoCodeId: id,
              userId: { not: null },
              status: {
                in: [
                  PrismaPromoRedemptionStatus.RESERVED,
                  PrismaPromoRedemptionStatus.USED,
                ],
              },
            },
            _count: { _all: true },
          });
          if (
            occupiedByUser.some(
              (usage) => usage._count._all > data.maxUsesPerUser!,
            )
          ) {
            throw new BadRequestException(
              "Новый лимит на пользователя меньше уже занятых применений",
            );
          }
        }
        return tx.promoCode.update({
          where: { id },
          data: { ...data, code: undefined },
        });
      });
      return this.mapAdmin(promo);
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async preview(input: {
    code: string;
    cartId?: string;
    userId?: string;
    now?: Date;
  }) {
    if (!input.cartId) throw new BadRequestException("Корзина не найдена");
    const [promo, cart] = await Promise.all([
      this.prisma.promoCode.findUnique({
        where: { code: normalizePromoCode(input.code) },
      }),
      this.prisma.cart.findUnique({
        where: { id: input.cartId },
        include: { items: { orderBy: { createdAt: "asc" } } },
      }),
    ]);
    if (!promo) throw new BadRequestException("Промокод не найден");
    if (!cart || cart.items.length === 0)
      throw new BadRequestException("Корзина пуста");
    const items = cart.items.map((item) => ({
      id: item.productId,
      unitPriceKopecks: rublesToKopecks(item.price),
      quantity: item.quantity,
    }));
    const pricing = await this.evaluate(
      promo,
      items,
      input.userId,
      input.now ?? new Date(),
      this.prisma,
    );
    return {
      code: promo.code,
      cartId: cart.id,
      subtotal: pricing.subtotalKopecks / 100,
      discount: pricing.discountKopecks / 100,
      total: pricing.totalKopecks / 100,
      currency: "RUB" as const,
    };
  }

  async calculate(input: {
    code: string;
    items: readonly PromoPricingItemInput[];
    userId?: string;
    now?: Date;
  }) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: normalizePromoCode(input.code) },
    });
    if (!promo) throw new BadRequestException("Промокод не найден");
    const pricing = await this.evaluate(
      promo,
      input.items,
      input.userId,
      input.now ?? new Date(),
      this.prisma,
    );
    return { code: promo.code, pricing };
  }

  async reserveInTransaction(tx: PromoTransaction, input: ReservePromoInput) {
    const code = normalizePromoCode(input.code);
    const lockedPromos = await this.lockPromoByCode(tx, code);
    if (lockedPromos.length === 0) {
      throw new BadRequestException("Промокод не найден");
    }
    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo) throw new BadRequestException("Промокод не найден");
    const pricing = await this.evaluate(
      promo,
      input.items,
      input.userId,
      input.now ?? new Date(),
      tx,
    );
    const termsSnapshot = {
      rulesVersion: "2026-08-31",
      ...this.mapTerms(promo),
    };
    const pricingSnapshot = pricing as unknown as Prisma.InputJsonValue;

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        discount: kopecksToRubles(pricing.discountKopecks),
        promoCode: promo.code,
        promoTermsSnapshot: termsSnapshot as unknown as Prisma.InputJsonValue,
        promoPricingSnapshot: pricingSnapshot,
        total: kopecksToRubles(
          pricing.totalKopecks + input.deliveryPriceKopecks,
        ),
      },
    });
    const redemption = await tx.promoRedemption.create({
      data: {
        promoCodeId: promo.id,
        orderId: input.orderId,
        userId: input.userId,
        codeSnapshot: promo.code,
        termsSnapshot: termsSnapshot as unknown as Prisma.InputJsonValue,
        pricingSnapshot,
        subtotalKopecksSnapshot: BigInt(pricing.subtotalKopecks),
        discountKopecksSnapshot: BigInt(pricing.discountKopecks),
        totalKopecksSnapshot: BigInt(pricing.totalKopecks),
      },
    });
    await tx.promoCode.update({
      where: { id: promo.id },
      data: { reservedCount: { increment: 1 } },
    });
    return { redemption, termsSnapshot, pricingSnapshot: pricing };
  }

  async consumeInTransaction(
    tx: PromoTransaction,
    orderId: string,
    input: { now?: Date; provider: string; source: string },
  ) {
    const redemption = await this.lockRedemption(tx, orderId);
    if (!redemption) {
      return {
        redemption: undefined,
        usedAfterRelease: false,
        changed: false,
      };
    }
    if (redemption.status === PrismaPromoRedemptionStatus.USED) {
      return { redemption, usedAfterRelease: false, changed: false };
    }
    await this.lockPromoById(tx, redemption.promoCodeId);
    const usedAfterRelease =
      redemption.status === PrismaPromoRedemptionStatus.RELEASED;
    const now = input.now ?? new Date();
    const updated = await tx.promoRedemption.update({
      where: { orderId },
      data: {
        status: PrismaPromoRedemptionStatus.USED,
        usedAt: now,
        releasedAt: null,
      },
    });
    await tx.promoCode.update({
      where: { id: redemption.promoCodeId },
      data: {
        ...(usedAfterRelease ? {} : { reservedCount: { decrement: 1 } }),
        usedCount: { increment: 1 },
      },
    });
    if (usedAfterRelease) {
      await tx.orderHistory.create({
        data: {
          orderId,
          eventType: "promo_used_after_release",
          payload: {
            occurredAt: now.toISOString(),
            provider: input.provider,
            source: input.source,
          },
        },
      });
    }
    return { redemption: updated, usedAfterRelease, changed: true };
  }

  async releaseInTransaction(
    tx: PromoTransaction,
    orderId: string,
    input: {
      actorId?: string;
      now?: Date;
      provider: string;
      rawStatus?: string;
      source: string;
    },
  ) {
    const redemption = await this.lockRedemption(tx, orderId);
    if (!redemption) return undefined;
    if (redemption.status !== PrismaPromoRedemptionStatus.RESERVED)
      return redemption;
    await this.lockPromoById(tx, redemption.promoCodeId);
    const now = input.now ?? new Date();
    const updated = await tx.promoRedemption.update({
      where: { orderId },
      data: { status: PrismaPromoRedemptionStatus.RELEASED, releasedAt: now },
    });
    await tx.promoCode.update({
      where: { id: redemption.promoCodeId },
      data: { reservedCount: { decrement: 1 } },
    });
    await tx.orderHistory.create({
      data: {
        orderId,
        authorId: input.actorId,
        eventType: "promo_reservation_released",
        payload: {
          occurredAt: now.toISOString(),
          orderId,
          provider: input.provider,
          rawStatus: input.rawStatus ?? null,
          source: input.source,
        },
      },
    });
    return updated;
  }

  async releaseByAdmin(input: {
    promoCodeId: string;
    orderId: string;
    actorId: string;
    confirmation: string;
    reason: string;
  }) {
    if (input.confirmation !== "payment_closed_without_charge") {
      throw new BadRequestException(
        "Требуется подтверждение закрытого платежа",
      );
    }
    const reason = input.reason.trim();
    if (reason.length < 10 || reason.length > 500) {
      throw new BadRequestException(
        "Причина должна содержать от 10 до 500 символов",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${input.orderId} FOR UPDATE`,
      );
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (!order) throw new NotFoundException("Заказ не найден");
      const redemption = await this.lockRedemption(tx, input.orderId);
      if (!redemption || redemption.promoCodeId !== input.promoCodeId) {
        throw new NotFoundException("Резерв промокода для заказа не найден");
      }
      await this.lockPromoById(tx, redemption.promoCodeId);
      if (
        order.paymentStatus === PrismaOrderPaymentStatus.PAID ||
        redemption.status === PrismaPromoRedemptionStatus.USED
      ) {
        throw new ConflictException(
          "Оплаченный или использованный резерв нельзя освободить",
        );
      }
      if (redemption.status === PrismaPromoRedemptionStatus.RELEASED) return;
      const now = new Date();
      await tx.promoRedemption.update({
        where: { orderId: input.orderId },
        data: {
          status: PrismaPromoRedemptionStatus.RELEASED,
          releasedAt: now,
        },
      });
      await tx.promoCode.update({
        where: { id: redemption.promoCodeId },
        data: { reservedCount: { decrement: 1 } },
      });
      await tx.orderHistory.create({
        data: {
          orderId: input.orderId,
          authorId: input.actorId,
          eventType: "promo_reservation_released",
          payload: {
            actorId: input.actorId,
            occurredAt: now.toISOString(),
            orderId: input.orderId,
            provider: order.paymentMethod.toLowerCase(),
            reason,
            source: "admin_manual",
          },
        },
      });
    });
    return this.getAdmin(input.promoCodeId);
  }

  private async evaluate(
    promo: PromoRecord,
    items: readonly PromoPricingItemInput[],
    userId: string | undefined,
    now: Date,
    client: Pick<PromoTransaction, "promoRedemption">,
  ) {
    const subtotalKopecks = calculatePromoPricing(items, {
      type: "fixed",
      amountKopecks: 0,
    }).subtotalKopecks;
    const userRedemptionCount =
      promo.maxUsesPerUser !== null && userId
        ? await client.promoRedemption.count({
            where: {
              promoCodeId: promo.id,
              userId,
              status: {
                in: [
                  PrismaPromoRedemptionStatus.RESERVED,
                  PrismaPromoRedemptionStatus.USED,
                ],
              },
            },
          })
        : undefined;
    const message = getPromoIneligibilityMessage(
      {
        ...promo,
        minSubtotalKopecks: safeBigIntToNumber(promo.minSubtotalKopecks),
      },
      { now, subtotalKopecks, userId, userRedemptionCount },
    );
    if (message) throw new BadRequestException(message);
    const pricing = calculatePromoPricing(
      items,
      promo.type === PrismaPromoCodeType.PERCENTAGE
        ? {
            type: "percentage",
            basisPoints: promo.basisPoints!,
            maxDiscountKopecks:
              promo.maxDiscountKopecks === null
                ? undefined
                : safeBigIntToNumber(promo.maxDiscountKopecks),
          }
        : {
            type: "fixed",
            amountKopecks: safeBigIntToNumber(promo.amountKopecks!),
          },
    );
    if (
      pricing.items.some((item) =>
        item.priceGroups.some((group) => group.unitPriceKopecks <= 0),
      )
    ) {
      throw new BadRequestException(
        "Промокод создает товар с нулевой ценой; оформление пока недоступно",
      );
    }
    return pricing;
  }

  private parseInput(
    input: PromoCodeInputDTO | UpdatePromoCodeInputDTO,
  ): Prisma.PromoCodeUncheckedCreateInput {
    if (!input.code) {
      throw new BadRequestException("Код промокода обязателен");
    }
    const code = normalizePromoCode(input.code);
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Название промокода обязательно");
    const startsAt = this.parseDate(input.startsAt, "startsAt");
    const endsAt = this.parseDate(input.endsAt, "endsAt");
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException(
        "Дата окончания должна быть позже даты начала",
      );
    }
    if (input.maxDiscountKopecks === 0) {
      throw new BadRequestException(
        "maxDiscountKopecks должен быть больше нуля",
      );
    }
    if (input.type === "percentage") {
      if (
        !input.basisPoints ||
        input.basisPoints > 10_000 ||
        input.amountKopecks != null
      ) {
        throw new BadRequestException(
          "Для процентного промокода нужны basisPoints от 1 до 10000 без amountKopecks",
        );
      }
    } else if (
      !input.amountKopecks ||
      input.basisPoints != null ||
      input.maxDiscountKopecks != null
    ) {
      throw new BadRequestException(
        "Для фиксированного промокода нужен amountKopecks без basisPoints и maxDiscountKopecks",
      );
    }
    for (const [field, value] of Object.entries({
      amountKopecks: input.amountKopecks,
      maxDiscountKopecks: input.maxDiscountKopecks,
      minSubtotalKopecks: input.minSubtotalKopecks ?? 0,
    })) {
      if (value != null && !Number.isSafeInteger(value))
        throw new BadRequestException(
          `${field} должен быть безопасным целым числом`,
        );
    }
    if (name.length > 160) {
      throw new BadRequestException(
        "Название промокода не должно превышать 160 символов",
      );
    }
    for (const [field, value] of Object.entries({
      maxUses: input.maxUses,
      maxUsesPerUser: input.maxUsesPerUser,
    })) {
      if (
        value != null &&
        (!Number.isInteger(value) || value < 1 || value > 2_147_483_647)
      ) {
        throw new BadRequestException(
          `${field} должен быть целым числом от 1 до 2147483647`,
        );
      }
    }
    return {
      code,
      name,
      description: input.description?.trim() || null,
      type:
        input.type === "percentage"
          ? PrismaPromoCodeType.PERCENTAGE
          : PrismaPromoCodeType.FIXED,
      basisPoints: input.type === "percentage" ? input.basisPoints! : null,
      amountKopecks:
        input.type === "fixed" ? BigInt(input.amountKopecks!) : null,
      maxDiscountKopecks:
        input.maxDiscountKopecks == null
          ? null
          : BigInt(input.maxDiscountKopecks),
      minSubtotalKopecks: BigInt(input.minSubtotalKopecks ?? 0),
      startsAt,
      endsAt,
      maxUses: input.maxUses ?? null,
      maxUsesPerUser: input.maxUsesPerUser ?? null,
      isActive: input.isActive,
    };
  }

  private parseDate(value: string | null | undefined, field: string) {
    if (value == null) return null;
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) ||
      !isISO8601(value, { strict: true, strictSeparator: true })
    ) {
      throw new BadRequestException(
        `${field} должен быть корректной ISO датой с часовым поясом`,
      );
    }
    return new Date(value);
  }

  private mapTerms(promo: PromoRecord): PromoTerms {
    return {
      code: promo.code,
      type: promo.type.toLowerCase() as PromoCodeType,
      basisPoints: promo.basisPoints,
      amountKopecks:
        promo.amountKopecks === null
          ? null
          : safeBigIntToNumber(promo.amountKopecks),
      maxDiscountKopecks:
        promo.maxDiscountKopecks === null
          ? null
          : safeBigIntToNumber(promo.maxDiscountKopecks),
      minSubtotalKopecks: safeBigIntToNumber(promo.minSubtotalKopecks),
      startsAt: promo.startsAt?.toISOString() ?? null,
      endsAt: promo.endsAt?.toISOString() ?? null,
      maxUses: promo.maxUses,
      maxUsesPerUser: promo.maxUsesPerUser,
      isActive: promo.isActive,
    };
  }

  private mapAdmin(
    promo: PromoRecord,
    usages?: Array<{
      orderId: string;
      status: PrismaPromoRedemptionStatus;
      createdAt: Date;
      usedAt: Date | null;
    }>,
  ) {
    return {
      id: promo.id,
      ...this.mapTerms(promo),
      name: promo.name,
      description: promo.description,
      usedCount: promo.usedCount,
      reservedCount: promo.reservedCount,
      createdAt: promo.createdAt.toISOString(),
      updatedAt: promo.updatedAt.toISOString(),
      ...(usages && {
        usages: usages.map((usage) => ({
          ...usage,
          status: usage.status.toLowerCase(),
          createdAt: usage.createdAt.toISOString(),
          usedAt: usage.usedAt?.toISOString() ?? null,
        })),
      }),
    };
  }

  private lockPromoById(tx: PromoTransaction, id: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "promo_codes" WHERE "id" = ${id} FOR UPDATE`,
    );
  }

  private lockPromoByCode(tx: PromoTransaction, code: string) {
    return tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "promo_codes" WHERE "code" = ${code} FOR UPDATE`,
    );
  }

  private async lockRedemption(tx: PromoTransaction, orderId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "promo_redemptions" WHERE "order_id" = ${orderId} FOR UPDATE`,
    );
    return tx.promoRedemption.findUnique({ where: { orderId } });
  }

  private handleMutationError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    )
      throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Промокод с таким кодом уже существует");
    }
    throw error;
  }
}

export function normalizePromoCode(code: string) {
  const normalized = normalizePromoCodeValue(code);
  if (!promoCodePattern.test(normalized)) {
    throw new BadRequestException("Некорректный формат промокода");
  }
  return normalized;
}

export function safeBigIntToNumber(value: bigint) {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error("Promo money exceeds safe integer range");
  return number;
}

export function rublesToKopecks(value: { toString(): string }) {
  const raw = value.toString();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match)
    throw new Error("Cart price must have at most two decimal places");
  const kopecks =
    BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return safeBigIntToNumber(kopecks);
}

export function kopecksToRubles(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Kopecks must be a non-negative safe integer");
  const kopecks = BigInt(value);
  return `${kopecks / 100n}.${(kopecks % 100n).toString().padStart(2, "0")}`;
}
