import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import {
  PromoCodeType,
  PromoRedemptionStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PromocodesService } from "../src/promocodes/promocodes.service";

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: "promo-1",
    code: "SALE10",
    name: "Sale",
    description: null,
    type: PromoCodeType.PERCENTAGE,
    basisPoints: 1_000,
    amountKopecks: null,
    maxDiscountKopecks: null,
    minSubtotalKopecks: 0n,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    maxUsesPerUser: null,
    isActive: true,
    usedCount: 0,
    reservedCount: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PromocodesService", () => {
  it("previews from read-only queries and returns RUB totals", async () => {
    const calls: string[] = [];
    const prisma = {
      promoCode: {
        findUnique: async () => {
          calls.push("promo.findUnique");
          return promo();
        },
      },
      cart: {
        findUnique: async () => {
          calls.push("cart.findUnique");
          return {
            id: "cart-1",
            items: [
              {
                productId: "item-1",
                price: { toString: () => "100.00" },
                quantity: 2,
              },
            ],
          };
        },
      },
      promoRedemption: { count: async () => 0 },
      $transaction: () => assert.fail("preview must not start a transaction"),
    } as unknown as PrismaService;
    const service = new PromocodesService(prisma);

    assert.deepEqual(
      await service.preview({ code: "sale10", cartId: "cart-1" }),
      {
        code: "SALE10",
        cartId: "cart-1",
        subtotal: 200,
        discount: 20,
        total: 180,
        currency: "RUB",
      },
    );
    assert.deepEqual(calls, ["promo.findUnique", "cart.findUnique"]);
  });

  it("rejects zero-priced net groups before any reservation write", async () => {
    let writes = 0;
    const tx = {
      $queryRaw: async () => [{ id: "promo-1" }],
      promoCode: {
        findUnique: async () =>
          promo({
            type: PromoCodeType.FIXED,
            basisPoints: null,
            amountKopecks: 10_000n,
          }),
        update: async () => {
          writes += 1;
        },
      },
      promoRedemption: {
        count: async () => 0,
        create: async () => {
          writes += 1;
        },
      },
    };
    const service = new PromocodesService({} as PrismaService);

    await assert.rejects(
      service.reserveInTransaction(tx as never, {
        code: "SALE10",
        deliveryPriceKopecks: 0,
        orderId: "order-1",
        items: [{ id: "item", unitPriceKopecks: 10_000, quantity: 1 }],
      }),
      (error: unknown) =>
        error instanceof BadRequestException &&
        /нулевой ценой/.test(error.message),
    );
    assert.equal(writes, 0);
  });

  it("fails reservation immediately when no promo row was locked", async () => {
    let readAfterLock = false;
    const tx = {
      $queryRaw: async () => [],
      promoCode: {
        findUnique: async () => {
          readAfterLock = true;
          return promo();
        },
      },
    };
    const service = new PromocodesService({} as PrismaService);

    await assert.rejects(
      service.reserveInTransaction(tx as never, {
        code: "SALE10",
        deliveryPriceKopecks: 0,
        orderId: "order-1",
        items: [{ id: "item", unitPriceKopecks: 10_000, quantity: 1 }],
      }),
      (error: unknown) =>
        error instanceof BadRequestException &&
        /Промокод не найден/.test(error.message),
    );
    assert.equal(readAfterLock, false);
  });

  it("writes order and redemption snapshots through the caller transaction", async () => {
    const calls: Array<{ operation: string; data?: Record<string, unknown> }> =
      [];
    const tx = {
      $queryRaw: async () => {
        calls.push({ operation: "lock" });
        return [{ id: "promo-1" }];
      },
      promoCode: {
        findUnique: async () => promo(),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ operation: "counter", data });
          return promo({ reservedCount: 1 });
        },
      },
      order: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ operation: "order", data });
          return {};
        },
      },
      promoRedemption: {
        count: async () => 0,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ operation: "redemption", data });
          return { id: "redemption-1", ...data };
        },
      },
    };
    const service = new PromocodesService({} as PrismaService);

    const result = await service.reserveInTransaction(tx as never, {
      code: "sale10",
      deliveryPriceKopecks: 49_000,
      orderId: "order-1",
      userId: "user-1",
      items: [{ id: "item", unitPriceKopecks: 10_000, quantity: 1 }],
    });

    assert.deepEqual(
      calls.map((call) => call.operation),
      ["lock", "order", "redemption", "counter"],
    );
    assert.equal(calls[1]?.data?.discount, "10.00");
    assert.equal(calls[1]?.data?.promoCode, "SALE10");
    assert.equal(calls[1]?.data?.total, "580.00");
    assert.equal(
      (calls[1]?.data?.promoTermsSnapshot as { rulesVersion: string })
        .rulesVersion,
      "2026-08-31",
    );
    assert.equal(calls[2]?.data?.discountKopecksSnapshot, 1_000n);
    assert.equal(result.pricingSnapshot.totalKopecks, 9_000);
  });

  it("allows omitted PATCH code and rejects code changes or lowered occupied limits", async () => {
    const input = {
      name: "Updated sale",
      type: "percentage" as const,
      basisPoints: 1_000,
      maxDiscountKopecks: null,
      minSubtotalKopecks: 0,
      maxUses: null,
      maxUsesPerUser: 2,
      isActive: true,
    };
    const createService = (
      currentOverrides: Record<string, unknown> = {},
      occupiedByUser = 0,
    ) =>
      new PromocodesService({
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            $queryRaw: async () => [{ id: "promo-1" }],
            promoCode: {
              findUnique: async () => promo(currentOverrides),
              update: async ({ data }: { data: Record<string, unknown> }) => ({
                ...promo(currentOverrides),
                ...Object.fromEntries(
                  Object.entries(data).filter(
                    ([, value]) => value !== undefined,
                  ),
                ),
              }),
            },
            promoRedemption: {
              groupBy: async () =>
                occupiedByUser > 0
                  ? [{ userId: "user-1", _count: { _all: occupiedByUser } }]
                  : [],
            },
          }),
      } as unknown as PrismaService);

    assert.equal(
      (await createService().updateAdmin("promo-1", input)).code,
      "SALE10",
    );
    await assert.rejects(
      createService().updateAdmin("promo-1", { ...input, code: "OTHER" }),
      /нельзя изменить/,
    );
    await assert.rejects(
      createService({ usedCount: 2 }).updateAdmin("promo-1", {
        ...input,
        maxUses: 1,
        maxUsesPerUser: null,
      }),
      /Новый лимит меньше/,
    );
    await assert.rejects(
      createService({ maxUsesPerUser: 3 }, 2).updateAdmin("promo-1", {
        ...input,
        maxUses: null,
        maxUsesPerUser: 1,
      }),
      /лимит на пользователя/,
    );
  });

  it("handles duplicate release/consume and records late paid after release", async () => {
    const makeTransaction = () => {
      const state = {
        redemption: {
          id: "redemption-1",
          orderId: "order-1",
          promoCodeId: "promo-1",
          status: PromoRedemptionStatus.RESERVED,
          usedAt: null as Date | null,
          releasedAt: null as Date | null,
        },
        promo: { reservedCount: 1, usedCount: 0 },
        redemptionUpdates: 0,
      };
      const tx = {
        $queryRaw: async () => [{ id: "locked-row" }],
        promoRedemption: {
          findUnique: async () => ({ ...state.redemption }),
          update: async ({
            data,
          }: {
            data: Partial<typeof state.redemption>;
          }) => {
            state.redemptionUpdates += 1;
            Object.assign(state.redemption, data);
            return { ...state.redemption };
          },
        },
        promoCode: {
          update: async ({
            data,
          }: {
            data: {
              reservedCount?: { decrement: number };
              usedCount?: { increment: number };
            };
          }) => {
            state.promo.reservedCount -= data.reservedCount?.decrement ?? 0;
            state.promo.usedCount += data.usedCount?.increment ?? 0;
            return state.promo;
          },
        },
        orderHistory: {
          create: async () => ({}),
        },
      };
      return { state, tx };
    };
    const service = new PromocodesService({} as PrismaService);

    const consumed = makeTransaction();
    const payment = { provider: "tbank_acquiring", source: "webhook" };
    const release = { provider: "tbank_acquiring", source: "terminal" };
    await service.consumeInTransaction(
      consumed.tx as never,
      "order-1",
      payment,
    );
    await service.consumeInTransaction(
      consumed.tx as never,
      "order-1",
      payment,
    );
    await service.releaseInTransaction(
      consumed.tx as never,
      "order-1",
      release,
    );
    assert.deepEqual(consumed.state.promo, { reservedCount: 0, usedCount: 1 });
    assert.equal(consumed.state.redemptionUpdates, 1);
    assert.equal(consumed.state.redemption.status, PromoRedemptionStatus.USED);

    const released = makeTransaction();
    await service.releaseInTransaction(
      released.tx as never,
      "order-1",
      release,
    );
    await service.releaseInTransaction(
      released.tx as never,
      "order-1",
      release,
    );
    assert.deepEqual(released.state.promo, { reservedCount: 0, usedCount: 0 });
    assert.equal(released.state.redemptionUpdates, 1);
    const latePaid = await service.consumeInTransaction(
      released.tx as never,
      "order-1",
      payment,
    );
    assert.equal(latePaid.usedAfterRelease, true);
    assert.deepEqual(released.state.promo, { reservedCount: 0, usedCount: 1 });
    assert.equal(released.state.redemption.status, PromoRedemptionStatus.USED);
  });

  it("keeps late-paid overrun truthful, blocks new reserve, and allows pause with unchanged limits", async () => {
    let usedCount = 1;
    let reservedCount = 0;
    let isActive = true;
    let name = "Sale";
    let redemptionStatus: PromoRedemptionStatus =
      PromoRedemptionStatus.RELEASED;
    let auditCount = 0;
    let reservationWrites = 0;
    let groupByCalls = 0;
    const currentPromo = () =>
      promo({
        usedCount,
        reservedCount,
        isActive,
        name,
        maxUses: 1,
        maxUsesPerUser: 1,
      });
    const tx = {
      $queryRaw: async () => [{ id: "locked-row" }],
      promoCode: {
        findUnique: async () => currentPromo(),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          const usedCounter = data.usedCount as
            | { increment: number }
            | undefined;
          const reservedCounter = data.reservedCount as
            | { decrement?: number; increment?: number }
            | undefined;
          usedCount += usedCounter?.increment ?? 0;
          reservedCount += reservedCounter?.increment ?? 0;
          reservedCount -= reservedCounter?.decrement ?? 0;
          if (typeof data.isActive === "boolean") isActive = data.isActive;
          if (typeof data.name === "string") name = data.name;
          return currentPromo();
        },
      },
      promoRedemption: {
        findUnique: async () => ({
          id: "redemption-1",
          orderId: "order-late",
          promoCodeId: "promo-1",
          userId: "user-1",
          status: redemptionStatus,
        }),
        update: async ({
          data,
        }: {
          data: { status: PromoRedemptionStatus };
        }) => {
          redemptionStatus = data.status;
          return {
            orderId: "order-late",
            promoCodeId: "promo-1",
            status: redemptionStatus,
          };
        },
        count: async () => 2,
        create: async () => {
          reservationWrites += 1;
          return {};
        },
        groupBy: async () => {
          groupByCalls += 1;
          return [{ userId: "user-1", _count: { _all: 2 } }];
        },
      },
      order: {
        update: async () => {
          reservationWrites += 1;
          return {};
        },
      },
      orderHistory: {
        create: async () => {
          auditCount += 1;
          return {};
        },
      },
    };
    const service = new PromocodesService({
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaService);
    const payment = { provider: "tbank_acquiring", source: "webhook" };

    const latePaid = await service.consumeInTransaction(
      tx as never,
      "order-late",
      payment,
    );
    const repeated = await service.consumeInTransaction(
      tx as never,
      "order-late",
      payment,
    );

    assert.equal(latePaid.usedAfterRelease, true);
    assert.equal(repeated.changed, false);
    assert.equal(usedCount, 2);
    assert.equal(reservedCount, 0);
    assert.equal(auditCount, 1);
    await assert.rejects(
      service.reserveInTransaction(tx as never, {
        code: "SALE10",
        deliveryPriceKopecks: 0,
        orderId: "order-new",
        userId: "user-1",
        items: [{ id: "item", unitPriceKopecks: 10_000, quantity: 1 }],
      }),
      /Лимит применений промокода исчерпан/,
    );
    assert.equal(reservationWrites, 0);

    const paused = await service.updateAdmin("promo-1", {
      name: "Paused after late payment",
      type: "percentage",
      basisPoints: 1_000,
      maxDiscountKopecks: null,
      minSubtotalKopecks: 0,
      maxUses: 1,
      maxUsesPerUser: 1,
      isActive: false,
    });
    assert.equal(paused.isActive, false);
    assert.equal(paused.name, "Paused after late payment");
    assert.equal(groupByCalls, 0);
  });

  it("releases an unpaid matching reservation manually with trimmed audit reason", async () => {
    const events: Array<{
      authorId?: string;
      eventType: string;
      orderId?: string;
      payload: Record<string, unknown>;
    }> = [];
    let status: PromoRedemptionStatus = PromoRedemptionStatus.RESERVED;
    let reservedCount = 1;
    const tx = {
      $queryRaw: async () => [{ id: "locked-row" }],
      order: {
        findUnique: async () => ({
          paymentMethod: "TBANK_ACQUIRING",
          paymentStatus: "PENDING",
        }),
      },
      promoRedemption: {
        findUnique: async () => ({
          orderId: "order-1",
          promoCodeId: "promo-1",
          status,
        }),
        update: async () => {
          status = PromoRedemptionStatus.RELEASED;
          return {};
        },
      },
      promoCode: {
        update: async () => {
          reservedCount -= 1;
          return {};
        },
      },
      orderHistory: {
        create: async ({ data }: { data: (typeof events)[number] }) => {
          events.push(data);
          return data;
        },
      },
    };
    const service = new PromocodesService({
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      promoCode: {
        findUnique: async () => ({ ...promo(), redemptions: [] }),
      },
    } as unknown as PrismaService);

    await service.releaseByAdmin({
      promoCodeId: "promo-1",
      orderId: "order-1",
      actorId: "admin-1",
      confirmation: "payment_closed_without_charge",
      reason: "  Provider confirms no charge  ",
    });
    await service.releaseByAdmin({
      promoCodeId: "promo-1",
      orderId: "order-1",
      actorId: "admin-1",
      confirmation: "payment_closed_without_charge",
      reason: "Provider confirms no charge",
    });

    assert.equal(reservedCount, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.authorId, "admin-1");
    assert.equal(events[0]?.eventType, "promo_reservation_released");
    assert.equal(events[0]?.orderId, "order-1");
    assert.equal(events[0]?.payload.actorId, "admin-1");
    assert.match(String(events[0]?.payload.occurredAt), /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(events[0]?.payload.orderId, "order-1");
    assert.equal(events[0]?.payload.provider, "tbank_acquiring");
    assert.equal(events[0]?.payload.reason, "Provider confirms no charge");
    assert.equal(events[0]?.payload.source, "admin_manual");
  });

  it("rejects manual release for another promo, paid orders, and used redemptions", async () => {
    const attempt = async (input: {
      paymentStatus: "PAID" | "PENDING";
      promoCodeId: string;
      status: PromoRedemptionStatus;
    }) => {
      let writes = 0;
      const tx = {
        $queryRaw: async () => [{ id: "locked-row" }],
        order: {
          findUnique: async () => ({
            paymentMethod: "TBANK_ACQUIRING",
            paymentStatus: input.paymentStatus,
          }),
        },
        promoRedemption: {
          findUnique: async () => ({
            orderId: "order-1",
            promoCodeId: input.promoCodeId,
            status: input.status,
          }),
          update: async () => {
            writes += 1;
            return {};
          },
        },
        promoCode: {
          update: async () => {
            writes += 1;
            return {};
          },
        },
        orderHistory: {
          create: async () => {
            writes += 1;
            return {};
          },
        },
      };
      const service = new PromocodesService({
        $transaction: async (callback: (value: typeof tx) => unknown) =>
          callback(tx),
      } as unknown as PrismaService);
      const release = service.releaseByAdmin({
        promoCodeId: "promo-1",
        orderId: "order-1",
        actorId: "admin-1",
        confirmation: "payment_closed_without_charge",
        reason: "Provider confirms no charge",
      });
      return { release, writes: () => writes };
    };

    const wrongPromo = await attempt({
      paymentStatus: "PENDING",
      promoCodeId: "promo-other",
      status: PromoRedemptionStatus.RESERVED,
    });
    await assert.rejects(
      wrongPromo.release,
      (error: unknown) => error instanceof NotFoundException,
    );
    assert.equal(wrongPromo.writes(), 0);

    const paid = await attempt({
      paymentStatus: "PAID",
      promoCodeId: "promo-1",
      status: PromoRedemptionStatus.RESERVED,
    });
    await assert.rejects(
      paid.release,
      (error: unknown) => error instanceof ConflictException,
    );
    assert.equal(paid.writes(), 0);

    const used = await attempt({
      paymentStatus: "PENDING",
      promoCodeId: "promo-1",
      status: PromoRedemptionStatus.USED,
    });
    await assert.rejects(
      used.release,
      (error: unknown) => error instanceof ConflictException,
    );
    assert.equal(used.writes(), 0);
  });
});
