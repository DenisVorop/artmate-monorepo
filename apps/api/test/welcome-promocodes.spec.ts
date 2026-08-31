import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  PromoCodeType,
  PromoRedemptionStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PromocodesService } from "../src/promocodes/promocodes.service";

const now = new Date("2026-08-31T12:00:00.000Z");

function welcomePromo(overrides: Record<string, unknown> = {}) {
  return {
    id: "welcome-promo",
    code: "ARTMSTART",
    kind: "WELCOME",
    name: "Welcome",
    description: null,
    type: PromoCodeType.PERCENTAGE,
    basisPoints: 2_000,
    amountKopecks: null,
    maxDiscountKopecks: null,
    minSubtotalKopecks: 0n,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    maxUsesPerUser: 1,
    isActive: true,
    usedCount: 0,
    reservedCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function getWelcome(
  service: PromocodesService,
  userId: string,
  at = now,
) {
  return service.getWelcome(userId, at);
}

describe("welcome promocode", () => {
  it("returns the read contract in RUB for a linked eligible account", async () => {
    const service = new PromocodesService({
      promoCode: { findFirst: async () => welcomePromo() },
      telegramAccount: { findUnique: async () => ({ id: "telegram-1" }) },
      promoRedemption: { count: async () => 0 },
    } as unknown as PrismaService);

    assert.deepEqual(await getWelcome(service, "user-1"), {
      promo: {
        code: "ARTMSTART",
        discountPercent: 20,
        amount: null,
        minSubtotal: 0,
        maxDiscount: null,
        endsAt: null,
      },
    });
  });

  it("returns fixed and capped monetary values in RUB with nullable counterparts", async () => {
    const service = new PromocodesService({
      promoCode: {
        findFirst: async () =>
          welcomePromo({
            type: PromoCodeType.FIXED,
            basisPoints: null,
            amountKopecks: 12_345n,
            minSubtotalKopecks: 50_000n,
            maxDiscountKopecks: null,
          }),
      },
      telegramAccount: { findUnique: async () => ({ id: "telegram-1" }) },
      promoRedemption: { count: async () => 0 },
    } as unknown as PrismaService);

    assert.deepEqual(await getWelcome(service, "user-1"), {
      promo: {
        code: "ARTMSTART",
        discountPercent: null,
        amount: 123.45,
        minSubtotal: 500,
        maxDiscount: null,
        endsAt: null,
      },
    });
  });

  it("hides the promo for unlinked, USED and RESERVED accounts but allows RELEASED", async () => {
    const run = (linked: boolean, count: number) =>
      getWelcome(
        new PromocodesService({
          promoCode: { findFirst: async () => welcomePromo() },
          telegramAccount: {
            findUnique: async () => (linked ? { id: "telegram-1" } : null),
          },
          promoRedemption: { count: async () => count },
        } as unknown as PrismaService),
        "user-1",
      );

    assert.deepEqual(await run(false, 0), { promo: null });
    assert.deepEqual(await run(true, 1), { promo: null });
    assert.notDeepEqual(await run(true, 0), { promo: null });
  });

  it("hides inactive, future, expired and globally exhausted campaigns", async () => {
    for (const overrides of [
      { isActive: false },
      { startsAt: new Date("2026-09-01T00:00:00.000Z") },
      { endsAt: now },
      { maxUses: 1, usedCount: 1 },
      { maxUses: 1, reservedCount: 1 },
    ]) {
      const service = new PromocodesService({
        promoCode: { findFirst: async () => welcomePromo(overrides) },
        telegramAccount: { findUnique: async () => ({ id: "telegram-1" }) },
        promoRedemption: { count: async () => 0 },
      } as unknown as PrismaService);
      assert.deepEqual(await getWelcome(service, "user-1"), { promo: null });
    }
  });

  it("blocks guest and unlinked direct calculate attempts while preserving standard codes", async () => {
    const calculate = (
      promo: ReturnType<typeof welcomePromo>,
      userId: string | undefined,
      linked: boolean,
    ) =>
      new PromocodesService({
        promoCode: { findUnique: async () => promo },
        telegramAccount: {
          findUnique: async () => (linked ? { id: "telegram-1" } : null),
        },
        promoRedemption: { count: async () => 0 },
      } as unknown as PrismaService).calculate({
        code: promo.code,
        items: [{ id: "item-1", unitPriceKopecks: 10_000, quantity: 1 }],
        userId,
        now,
      });

    await assert.rejects(
      calculate(welcomePromo(), undefined, false),
      BadRequestException,
    );
    await assert.rejects(
      calculate(welcomePromo(), "user-1", false),
      /Telegram/,
    );
    assert.equal(
      (
        await calculate(
          welcomePromo({ kind: "STANDARD", maxUsesPerUser: null }),
          undefined,
          false,
        )
      ).pricing.discountKopecks,
      2_000,
    );
  });

  it("previews and calculates the welcome discount for a linked account", async () => {
    const service = new PromocodesService({
      promoCode: { findUnique: async () => welcomePromo() },
      cart: {
        findUnique: async () => ({
          id: "cart-1",
          items: [
            {
              createdAt: now,
              price: 100,
              productId: "item-1",
              quantity: 1,
            },
          ],
        }),
      },
      telegramAccount: { findUnique: async () => ({ id: "telegram-1" }) },
      promoRedemption: { count: async () => 0 },
    } as unknown as PrismaService);

    assert.deepEqual(
      await service.preview({
        cartId: "cart-1",
        code: "ARTMSTART",
        userId: "user-1",
        now,
      }),
      {
        cartId: "cart-1",
        code: "ARTMSTART",
        currency: "RUB",
        discount: 20,
        subtotal: 100,
        total: 80,
      },
    );
    assert.equal(
      (
        await service.calculate({
          code: "ARTMSTART",
          items: [
            { id: "item-1", unitPriceKopecks: 10_000, quantity: 1 },
          ],
          userId: "user-1",
          now,
        })
      ).pricing.discountKopecks,
      2_000,
    );
  });

  it("rechecks Telegram and USED/RESERVED inside transactional reservation", async () => {
    let writes = 0;
    const reserve = (linked: boolean, redemptionCount: number) => {
      const tx = {
        $queryRaw: async () => [{ id: "welcome-promo" }],
        promoCode: { findUnique: async () => welcomePromo() },
        telegramAccount: {
          findUnique: async () => (linked ? { id: "telegram-1" } : null),
        },
        promoRedemption: {
          count: async () => redemptionCount,
          create: async () => {
            writes += 1;
          },
        },
        order: {
          update: async () => {
            writes += 1;
          },
        },
      };
      return new PromocodesService({} as PrismaService).reserveInTransaction(
        tx as never,
        {
          code: "ARTMSTART",
          deliveryPriceKopecks: 0,
          orderId: "order-1",
          userId: "user-1",
          items: [{ id: "item-1", unitPriceKopecks: 10_000, quantity: 1 }],
          now,
        },
      );
    };

    await assert.rejects(reserve(false, 0), /Telegram/);
    await assert.rejects(reserve(true, 1), /лимит/);
    assert.equal(writes, 0);
  });

  it("uses transactional Telegram state and persists welcome snapshots on reservation", async () => {
    let orderData: Record<string, unknown> | undefined;
    let redemptionData: Record<string, unknown> | undefined;
    let promoUpdateData: Record<string, unknown> | undefined;
    const createTransaction = (linked: boolean) => ({
      $queryRaw: async () => [{ id: "welcome-promo" }],
      promoCode: {
        findUnique: async () => welcomePromo(),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          promoUpdateData = data;
          return welcomePromo();
        },
      },
      telegramAccount: {
        findUnique: async () => (linked ? { id: "telegram-tx" } : null),
      },
      promoRedemption: {
        count: async () => 0,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          redemptionData = data;
          return { id: "redemption-1", ...data };
        },
      },
      order: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          orderData = data;
          return { id: "order-1" };
        },
      },
    });
    const input = {
      code: "ARTMSTART",
      deliveryPriceKopecks: 0,
      orderId: "order-1",
      userId: "user-1",
      items: [{ id: "item-1", unitPriceKopecks: 10_000, quantity: 1 }],
      now,
    };

    const rootLinked = new PromocodesService({
      telegramAccount: { findUnique: async () => ({ id: "telegram-root" }) },
    } as unknown as PrismaService);
    await assert.rejects(
      rootLinked.reserveInTransaction(createTransaction(false) as never, input),
      /Telegram/,
    );

    const rootUnlinked = new PromocodesService({
      telegramAccount: { findUnique: async () => null },
    } as unknown as PrismaService);
    const result = await rootUnlinked.reserveInTransaction(
      createTransaction(true) as never,
      input,
    );

    assert.equal(result.termsSnapshot.kind, "welcome");
    assert.equal(
      (orderData?.promoTermsSnapshot as { kind?: string }).kind,
      "welcome",
    );
    assert.equal(
      (redemptionData?.termsSnapshot as { kind?: string }).kind,
      "welcome",
    );
    assert.deepEqual(promoUpdateData, { reservedCount: { increment: 1 } });
  });

  it("rejects changing welcome maxUsesPerUser and exposes kind in snapshots", async () => {
    const tx = {
      $queryRaw: async () => [{ id: "welcome-promo" }],
      promoCode: {
        findUnique: async () => welcomePromo(),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          ...welcomePromo(),
          ...data,
        }),
      },
      promoRedemption: { groupBy: async () => [] },
    };
    const service = new PromocodesService({
      $transaction: async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaService);

    await assert.rejects(
      service.updateAdmin("welcome-promo", {
        name: "Welcome",
        type: "percentage",
        basisPoints: 2_000,
        maxDiscountKopecks: null,
        minSubtotalKopecks: 0,
        maxUses: null,
        maxUsesPerUser: 2,
        isActive: true,
      }),
      /приветственного промокода/,
    );

    const admin = await new PromocodesService({
      promoCode: { findMany: async () => [welcomePromo()] },
    } as unknown as PrismaService).listAdmin();
    assert.equal(
      (admin[0] as unknown as { kind?: string } | undefined)?.kind,
      "welcome",
    );
  });

  it("counts only USED and RESERVED, so RELEASED does not consume the account limit", async () => {
    let statuses: unknown;
    const service = new PromocodesService({
      promoCode: { findFirst: async () => welcomePromo() },
      telegramAccount: { findUnique: async () => ({ id: "telegram-1" }) },
      promoRedemption: {
        count: async ({ where }: { where: { status: unknown } }) => {
          statuses = where.status;
          return 0;
        },
      },
    } as unknown as PrismaService);

    assert.notDeepEqual(await getWelcome(service, "user-1"), { promo: null });
    assert.deepEqual(statuses, {
      in: [PromoRedemptionStatus.RESERVED, PromoRedemptionStatus.USED],
    });
  });

  it("does not reset USED or RESERVED eligibility after unlinking and relinking the same user", async () => {
    for (const status of [
      PromoRedemptionStatus.USED,
      PromoRedemptionStatus.RESERVED,
    ]) {
      let linked = true;
      const redemption = { status, userId: "user-1" };
      const service = new PromocodesService({
        promoCode: { findFirst: async () => welcomePromo() },
        telegramAccount: {
          findUnique: async () => (linked ? { id: "telegram-new" } : null),
        },
        promoRedemption: {
          count: async ({
            where,
          }: {
            where: { status: { in: PromoRedemptionStatus[] }; userId: string };
          }) =>
            redemption.userId === where.userId &&
            where.status.in.includes(redemption.status)
              ? 1
              : 0,
        },
      } as unknown as PrismaService);

      assert.deepEqual(await getWelcome(service, "user-1"), { promo: null });
      linked = false;
      assert.deepEqual(await getWelcome(service, "user-1"), { promo: null });
      linked = true;
      assert.deepEqual(await getWelcome(service, "user-1"), { promo: null });
    }
  });
});
