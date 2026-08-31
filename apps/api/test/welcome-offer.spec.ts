import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PromoCodeType, PromoRedemptionStatus } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PromocodesService } from "../src/promocodes/promocodes.service";

const now = new Date("2026-08-31T12:00:00.000Z");

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: "welcome-promo",
    code: "SECRET-CODE",
    kind: "WELCOME",
    name: "Welcome",
    description: null,
    type: PromoCodeType.PERCENTAGE,
    basisPoints: 2_000,
    amountKopecks: null,
    maxDiscountKopecks: 50_000n,
    minSubtotalKopecks: 10_000n,
    startsAt: null,
    endsAt: new Date("2026-09-30T12:00:00.000Z"),
    maxUses: 100,
    maxUsesPerUser: 1,
    isActive: true,
    usedCount: 10,
    reservedCount: 5,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function service(options: { linked?: boolean; occupied?: number; row?: unknown } = {}) {
  return new PromocodesService({
    promoCode: {
      findFirst: async () => ("row" in options ? options.row : promo()),
    },
    telegramAccount: {
      findUnique: async () => (options.linked ? { id: "telegram-1" } : null),
    },
    promoRedemption: {
      count: async ({ where }: { where: { status: unknown } }) => {
        assert.deepEqual(where.status, {
          in: [PromoRedemptionStatus.RESERVED, PromoRedemptionStatus.USED],
        });
        return options.occupied ?? 0;
      },
    },
  } as unknown as PrismaService);
}

describe("welcome offer", () => {
  it("returns authorize for a guest without exposing code or other internals", async () => {
    const result = await service().getWelcomeOffer(undefined, now);

    assert.deepEqual(result, {
      offer: {
        action: "authorize",
        discountPercent: 20,
        amount: null,
        minSubtotal: 100,
        maxDiscount: 500,
        endsAt: "2026-09-30T12:00:00.000Z",
      },
    });
    assert.equal(JSON.stringify(result).includes("SECRET-CODE"), false);
  });

  it("returns link_telegram only for an unlinked authenticated eligible user", async () => {
    assert.equal(
      (await service().getWelcomeOffer("user-1", now)).offer?.action,
      "link_telegram",
    );
    assert.deepEqual(await service({ linked: true }).getWelcomeOffer("user-1", now), {
      offer: null,
    });
    assert.deepEqual(await service({ occupied: 1 }).getWelcomeOffer("user-1", now), {
      offer: null,
    });
  });

  it("returns null outside active dates or after the global cap", async () => {
    for (const row of [
      null,
      promo({ isActive: false }),
      promo({ startsAt: new Date("2026-09-01T00:00:00.000Z") }),
      promo({ endsAt: now }),
      promo({ maxUses: 15 }),
    ]) {
      assert.deepEqual(await service({ row }).getWelcomeOffer(undefined, now), {
        offer: null,
      });
    }
  });

  it("maps fixed offers to RUB with a nullable percentage", async () => {
    const result = await service({
      row: promo({
        type: PromoCodeType.FIXED,
        basisPoints: null,
        amountKopecks: 12_345n,
        maxDiscountKopecks: null,
      }),
    }).getWelcomeOffer(undefined, now);

    assert.deepEqual(result.offer, {
      action: "authorize",
      discountPercent: null,
      amount: 123.45,
      minSubtotal: 100,
      maxDiscount: null,
      endsAt: "2026-09-30T12:00:00.000Z",
    });
  });
});
