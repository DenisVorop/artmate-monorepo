import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OrdersService } from "../src/orders/orders.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import {
  createOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";

function fixture(
  options: {
    closed?: boolean;
    reserved?: boolean;
    bankError?: Error;
    validSignature?: boolean;
  } = {},
) {
  const events: string[] = [];
  const evidence = {
    orderId: "order-1",
    paymentId: "payment-1",
    amountKopecks: 90000,
  };
  const service = Object.assign(Object.create(OrdersService.prototype), {
    tbankAcquiringService: {
      assertValidNotification: () => {
        events.push("signature");
        if (options.validSignature === false)
          throw new Error("signature rejected");
      },
      parseNotification: (body: { Status: string }) => ({
        paymentId: evidence.paymentId,
        rawStatus: body.Status,
      }),
      verifyOrderClosedUnpaid: async (input: unknown) => {
        events.push("bank-check");
        assert.deepEqual(input, evidence);
        if (options.bankError) throw options.bankError;
        return options.closed ?? true;
      },
    },
    ordersStorage: {
      applyTBankAcquiringNotification: async () => {
        events.push("terminal-stored");
        return {
          order: { id: evidence.orderId, total: 900 },
          paymentStatusChangedToPaid: false,
        };
      },
      hasReservedLoyaltyPoints: async () => {
        events.push("reservation");
        return options.reserved ?? true;
      },
      releaseLoyaltyForClosedTBankPayment: async (input: unknown) => {
        assert.deepEqual(input, evidence);
        events.push("release");
      },
    },
  }) as OrdersService;
  return { service, events };
}

describe("loyalty payment hooks", () => {
  it("validates the receipt row limit after loyalty splits item groups", () => {
    const snapshot = createOrderPricingSnapshot(
      calculatePromoPricing(
        Array.from({ length: 100 }, (_, index) => ({
          id: String(index),
          unitPriceKopecks: 500,
          quantity: 2,
        })),
        { type: "fixed", amountKopecks: 0 },
      ),
      0,
    );
    const storage = Object.create(OrdersStorage.prototype) as {
      assertReceiptPricing: (
        pricing: OrderPricingSnapshot,
        paymentMethod: string,
      ) => void;
    };
    assert.doesNotThrow(() =>
      storage.assertReceiptPricing(snapshot, "tbank_acquiring"),
    );
    const discounted = applyLoyaltyPoints(snapshot, 1);
    assert.equal(
      discounted.items.reduce((sum, item) => sum + item.priceGroups.length, 0),
      101,
    );
    assert.throws(
      () => storage.assertReceiptPricing(discounted, "tbank_acquiring"),
      /100/,
    );
  });
  it("persists terminal state before checking all bank attempts and releasing", async () => {
    for (const Status of ["CANCELED", "DEADLINE_EXPIRED"]) {
      const { service, events } = fixture();
      assert.equal(
        await service.handleTBankPaymentNotification({ Status }),
        "OK",
      );
      assert.deepEqual(events, [
        "signature",
        "terminal-stored",
        "reservation",
        "bank-check",
        "release",
      ]);
    }
  });

  it("never releases on unknown state, network failure or invalid signature", async () => {
    const ambiguous = fixture({ closed: false });
    await ambiguous.service.handleTBankPaymentNotification({
      Status: "CANCELED",
    });
    assert.ok(!ambiguous.events.includes("release"));
    const transport = fixture({ bankError: new Error("bank unavailable") });
    await assert.rejects(
      transport.service.handleTBankPaymentNotification({ Status: "CANCELED" }),
      /bank unavailable/,
    );
    assert.ok(!transport.events.includes("release"));
    const invalid = fixture({ validSignature: false });
    await assert.rejects(
      invalid.service.handleTBankPaymentNotification({ Status: "CANCELED" }),
      /signature rejected/,
    );
    assert.deepEqual(invalid.events, ["signature"]);
  });

  it("does not query bank closure for ordinary orders or non-closing notifications", async () => {
    const ordinary = fixture({ reserved: false });
    await ordinary.service.handleTBankPaymentNotification({
      Status: "CANCELED",
    });
    assert.deepEqual(ordinary.events, [
      "signature",
      "terminal-stored",
      "reservation",
    ]);
    for (const Status of ["REJECTED", "AUTH_FAIL", "CONFIRMED", "NEW"]) {
      const { service, events } = fixture();
      await service.handleTBankPaymentNotification({ Status });
      assert.deepEqual(events, ["signature", "terminal-stored"]);
    }
  });

  it("never restarts an uncertain loyalty Init, even after the old lease expires", async () => {
    for (const state of [
      {
        paymentStatus: "PENDING",
        paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
      },
      {
        paymentStatus: "FAILED",
        paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
      },
      { paymentStatus: "FAILED", paymentRedirectUrl: "https://bank.test/pay" },
      { paymentStatus: "PENDING", paymentRedirectUrl: "https://bank.test/pay" },
    ]) {
      let writes = 0;
      const tx = {
        $queryRaw: async () => [],
        order: {
          findUnique: async () => ({
            ...state,
            pricingSnapshot: { loyaltyDiscountKopecks: 20 },
          }),
          update: async () => {
            writes += 1;
          },
        },
      };
      const storage = Object.assign(Object.create(OrdersStorage.prototype), {
        prisma: {
          $transaction: (run: (client: unknown) => unknown) => run(tx),
        },
      }) as OrdersStorage;
      assert.equal(await storage.claimPaymentInitialization("order-1"), false);
      assert.equal(writes, 0);
    }
  });

  it("allows the first Init for a new loyalty order", async () => {
    let writes = 0;
    const tx = {
      $queryRaw: async () => [],
      order: {
        findUnique: async () => ({
          paymentStatus: "PENDING",
          paymentRedirectUrl: "/checkout/success?orderId=order-1",
          pricingSnapshot: { loyaltyDiscountKopecks: 20 },
        }),
        update: async () => {
          writes += 1;
        },
      },
    };
    const storage = Object.assign(Object.create(OrdersStorage.prototype), {
      prisma: { $transaction: (run: (client: unknown) => unknown) => run(tx) },
    }) as OrdersStorage;
    assert.equal(await storage.claimPaymentInitialization("order-1"), true);
    assert.equal(writes, 1);
  });
});
