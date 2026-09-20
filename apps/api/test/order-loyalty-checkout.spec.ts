import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import type { AuthUser } from "../src/auth/auth.types";
import { CalculateCheckoutRequestDTO } from "../src/orders/dto/calculate-checkout-request.dto";
import { CreateOrderRequestDTO } from "../src/orders/dto/create-order-request.dto";
import type { OrderDTO } from "../src/orders/dto";
import { OrdersService } from "../src/orders/orders.service";
import {
  applyLoyaltyPoints,
  getMaxLoyaltyPoints,
} from "../src/orders/pricing/apply-loyalty-points";
import type { OrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";

const revision = "a".repeat(64);
const user: AuthUser = {
  id: "buyer",
  provider: "credentials",
  providerUserId: "buyer",
  roles: [],
};

function orderRequest(
  overrides: Record<string, unknown> = {},
): CreateOrderRequestDTO {
  return {
    checkoutAttemptId: "attempt-1",
    customer: {
      email: "buyer@example.com",
      name: "Анна Иванова",
      phone: "+7 (999) 000-00-00",
    },
    delivery: { provider: "ozon", pickupPointId: "point-1" },
    payment: { method: "tbank_acquiring" },
    promoCode: "SALE",
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    ...overrides,
  } as CreateOrderRequestDTO;
}

function previewRequest(points?: unknown): CalculateCheckoutRequestDTO {
  return {
    delivery: { provider: "ozon", pickupPointId: "point-1" },
    promoCode: "SALE",
    loyaltyPointsToSpend: points,
  } as CalculateCheckoutRequestDTO;
}

function fixture(options: { existing?: boolean } = {}) {
  const previews: {
    userId?: string;
    snapshot: OrderPricingSnapshot;
    points: number;
  }[] = [];
  const creates: Record<string, unknown>[] = [];
  const attempts: { userId?: string; fingerprint: string }[] = [];
  let cartReads = 0;
  let paymentInitializations = 0;
  const order = { id: "order-1" } as OrderDTO;
  const service = Object.assign(Object.create(OrdersService.prototype), {
    cartService: {
      getCart: async () => {
        cartReads += 1;
        return {
          id: "cart-1",
          itemsCount: 3,
          subtotal: 30,
          total: 30,
          currency: "RUB",
          isOzonDeliveryAvailable: true,
          items: [
            {
              id: "product-1",
              title: "Product",
              slug: "product",
              image: "/product.jpg",
              price: 10,
              quantity: 3,
              lineTotal: 30,
            },
          ],
        };
      },
      assertItemsInStock: async () => undefined,
    },
    deliveryService: {
      calculatePickupPointDelivery: async () => ({
        provider: "ozon",
        deliveryPrice: 4.99,
        pickupPoint: {
          id: "point-1",
          address: "Москва",
          title: "Пункт",
          workHours: "09:00-21:00",
          deliveryPrice: 4.99,
        },
      }),
    },
    promocodesService: {
      calculate: async () => ({
        code: "SALE",
        pricing: calculatePromoPricing(
          [{ id: "product-1", unitPriceKopecks: 1_000, quantity: 3 }],
          { type: "fixed", amountKopecks: 101 },
        ),
      }),
    },
    ordersLoyaltyService: {
      preview: async (input: {
        userId?: string;
        snapshot: OrderPricingSnapshot;
        points: number;
      }) => {
        previews.push(structuredClone(input));
        return {
          snapshot: applyLoyaltyPoints(input.snapshot, input.points),
          loyalty: {
            availablePoints: input.userId ? 50 : 0,
            maxPoints: input.userId
              ? Math.min(50, getMaxLoyaltyPoints(input.snapshot))
              : 0,
            pointsToSpend: input.points,
            discountKopecks: input.points * 20,
            pricingRevision: revision,
          },
        };
      },
    },
    ordersStorage: {
      getOrderByCheckoutAttempt: async (
        _attemptId: string,
        _cartId: string,
        userId: string | undefined,
        fingerprint: string,
      ) => {
        attempts.push({ userId, fingerprint });
        return options.existing ? order : undefined;
      },
      createOrder: async (input: Record<string, unknown>) => {
        creates.push(input);
        return order;
      },
    },
    initializePaymentForOrder: async (value: OrderDTO) => {
      paymentInitializations += 1;
      return value;
    },
  }) as OrdersService;
  return {
    service,
    previews,
    creates,
    attempts,
    cartReads: () => cartReads,
    paymentInitializations: () => paymentInitializations,
  };
}

describe("order loyalty checkout", () => {
  it("previews promo then loyalty and exposes coordinator totals, balance, limits and revision", async () => {
    const f = fixture();
    const result = await f.service.calculateCheckout(
      "cart-1",
      previewRequest(5),
      user,
    );
    assert.equal(f.previews.length, 1);
    assert.equal(f.previews[0]!.userId, user.id);
    assert.equal(f.previews[0]!.points, 5);
    assert.equal(f.previews[0]!.snapshot.promoDiscountKopecks, 101);
    assert.equal(f.previews[0]!.snapshot.loyaltyDiscountKopecks, 0);
    assert.equal(f.previews[0]!.snapshot.deliveryKopecks, 499);
    assert.equal(result.subtotal, 30);
    assert.equal(result.discount, 2.01);
    assert.equal(result.deliveryPrice, 4.99);
    assert.equal(result.total, 32.98);
    assert.deepEqual(result.loyalty, {
      availablePoints: 50,
      maxPoints: 50,
      pointsToSpend: 5,
      discountKopecks: 100,
      pricingRevision: revision,
    });
    assert.equal(f.creates.length, 0);
  });

  it("allows guest preview without points and normalizes omitted points to zero", async () => {
    const f = fixture();
    const result = await f.service.calculateCheckout(
      "cart-1",
      previewRequest(),
    );
    assert.equal(f.previews[0]!.points, 0);
    assert.equal(f.previews[0]!.userId, undefined);
    assert.equal(result.total, 33.98);
    assert.equal(result.loyalty.availablePoints, 0);
    assert.equal(result.loyalty.maxPoints, 0);
  });

  it("rejects positive guest redemption before any cart or attempt reads", async () => {
    const f = fixture({ existing: true });
    await assert.rejects(
      f.service.calculateCheckout("cart-1", previewRequest(1)),
      UnauthorizedException,
    );
    await assert.rejects(
      f.service.createOrder(
        "cart-1",
        orderRequest({
          loyaltyPointsToSpend: 1,
          loyaltyPricingRevision: revision,
        }),
      ),
      UnauthorizedException,
    );
    assert.equal(f.cartReads(), 0);
    assert.equal(f.attempts.length, 0);
    assert.equal(f.previews.length, 0);
  });

  it("strictly validates points at runtime even when DTO validation is bypassed", async () => {
    for (const points of [
      null,
      "1",
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      true,
    ]) {
      const f = fixture();
      await assert.rejects(
        f.service.calculateCheckout("cart-1", previewRequest(points), user),
        BadRequestException,
      );
      await assert.rejects(
        f.service.createOrder(
          "cart-1",
          orderRequest({
            loyaltyPointsToSpend: points,
            loyaltyPricingRevision: revision,
          }),
          user,
        ),
        BadRequestException,
      );
      assert.equal(f.cartReads(), 0);
      assert.equal(f.attempts.length, 0);
    }
  });

  it("requires a strict revision for redemption and validates provided revisions even for zero points", async () => {
    for (const value of [
      undefined,
      null,
      123,
      "",
      "A".repeat(64),
      "a".repeat(63),
      "g".repeat(64),
      ` ${revision}`,
      `${revision}\n`,
    ]) {
      const f = fixture();
      await assert.rejects(
        f.service.createOrder(
          "cart-1",
          orderRequest({
            loyaltyPointsToSpend: 1,
            loyaltyPricingRevision: value,
          }),
          user,
        ),
        /loyaltyPricingRevision/,
      );
      assert.equal(f.attempts.length, 0);
      if (value !== undefined) {
        await assert.rejects(
          f.service.createOrder(
            "cart-1",
            orderRequest({
              loyaltyPointsToSpend: 0,
              loyaltyPricingRevision: value,
            }),
            user,
          ),
          /loyaltyPricingRevision/,
        );
      }
    }
  });

  it("passes normalized points and revision to transactional storage without client totals", async () => {
    const f = fixture();
    await f.service.createOrder(
      "cart-1",
      orderRequest({
        loyaltyPointsToSpend: 5,
        loyaltyPricingRevision: revision,
        discount: 999,
        total: 1,
      }),
      user,
    );
    const input = f.creates[0]!;
    assert.equal(input.loyaltyPointsToSpend, 5);
    assert.equal(input.loyaltyPricingRevision, revision);
    assert.equal(input.userId, user.id);
    assert.equal("discount" in input, false);
    assert.equal("total" in input, false);
    assert.equal(f.previews.length, 0);
    assert.equal(f.paymentInitializations(), 1);
  });

  it("includes both points and revision in the attempt fingerprint", async () => {
    const f = fixture({ existing: true });
    for (const [points, pricingRevision] of [
      [1, revision],
      [2, revision],
      [1, "b".repeat(64)],
    ] as const) {
      await f.service.createOrder(
        "cart-1",
        orderRequest({
          loyaltyPointsToSpend: points,
          loyaltyPricingRevision: pricingRevision,
        }),
        user,
      );
    }
    assert.equal(
      new Set(f.attempts.map((attempt) => attempt.fingerprint)).size,
      3,
    );
    assert.equal(f.cartReads(), 0);
    assert.equal(f.previews.length, 0);
    assert.equal(f.creates.length, 0);
    assert.equal(f.paymentInitializations(), 3);
  });

  it("normalizes omitted points, explicit zero and unused valid revisions to the same fingerprint", async () => {
    const f = fixture({ existing: true });
    for (const override of [
      {},
      { loyaltyPointsToSpend: 0 },
      { loyaltyPointsToSpend: 0, loyaltyPricingRevision: revision },
    ]) {
      await f.service.createOrder("cart-1", orderRequest(override), user);
    }
    assert.equal(
      new Set(f.attempts.map((attempt) => attempt.fingerprint)).size,
      1,
    );
    const guest = fixture();
    await guest.service.createOrder(
      "cart-1",
      orderRequest({
        loyaltyPointsToSpend: 0,
        loyaltyPricingRevision: revision,
      }),
    );
    assert.equal(guest.creates[0]!.loyaltyPointsToSpend, 0);
    assert.equal(guest.creates[0]!.loyaltyPricingRevision, undefined);
  });

  it("enforces strict DTO field validation without coercing null or strings", async () => {
    for (const value of [null, "1", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const preview = plainToInstance(
        CalculateCheckoutRequestDTO,
        previewRequest(value),
      );
      assert.ok(
        (await validate(preview)).some(
          (error) => error.property === "loyaltyPointsToSpend",
        ),
      );
      const create = plainToInstance(
        CreateOrderRequestDTO,
        orderRequest({
          loyaltyPointsToSpend: value,
          loyaltyPricingRevision: revision,
        }),
      );
      assert.ok(
        (await validate(create)).some(
          (error) => error.property === "loyaltyPointsToSpend",
        ),
      );
    }
    for (const points of [undefined, 0, 1, Number.MAX_SAFE_INTEGER]) {
      const preview = plainToInstance(
        CalculateCheckoutRequestDTO,
        previewRequest(points),
      );
      assert.equal(
        (await validate(preview)).some(
          (error) => error.property === "loyaltyPointsToSpend",
        ),
        false,
      );
    }
    const missingRevision = plainToInstance(
      CreateOrderRequestDTO,
      orderRequest({ loyaltyPointsToSpend: 1 }),
    );
    assert.ok(
      (await validate(missingRevision)).some(
        (error) => error.property === "loyaltyPricingRevision",
      ),
    );
    const trailingNewline = plainToInstance(
      CreateOrderRequestDTO,
      orderRequest({
        loyaltyPointsToSpend: 1,
        loyaltyPricingRevision: `${revision}\n`,
      }),
    );
    assert.ok(
      (await validate(trailingNewline)).some(
        (error) => error.property === "loyaltyPricingRevision",
      ),
    );
    const valid = plainToInstance(
      CreateOrderRequestDTO,
      orderRequest({
        loyaltyPointsToSpend: 1,
        loyaltyPricingRevision: revision,
      }),
    );
    assert.deepEqual(await validate(valid), []);
  });
});
