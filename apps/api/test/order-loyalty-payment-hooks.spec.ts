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
      confirmTBankClosedUnpaid: async (input: unknown) => {
        assert.deepEqual(input, evidence);
        events.push("closed-unpaid-published");
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
  it("persists terminal state before checking all bank attempts and publishing closed-unpaid for any order", async () => {
    for (const Status of ["CANCELED", "DEADLINE_EXPIRED"]) {
      const { service, events } = fixture();
      assert.equal(
        await service.handleTBankPaymentNotification({ Status }),
        "OK",
      );
      assert.deepEqual(events, [
        "signature",
        "terminal-stored",
        "bank-check",
        "closed-unpaid-published",
      ]);
    }
  });

  it("never publishes closed-unpaid on unknown state, network failure or invalid signature", async () => {
    const ambiguous = fixture({ closed: false });
    await ambiguous.service.handleTBankPaymentNotification({
      Status: "CANCELED",
    });
    assert.ok(!ambiguous.events.includes("closed-unpaid-published"));
    const transport = fixture({ bankError: new Error("bank unavailable") });
    await assert.rejects(
      transport.service.handleTBankPaymentNotification({ Status: "CANCELED" }),
      /bank unavailable/,
    );
    assert.ok(!transport.events.includes("closed-unpaid-published"));
    const invalid = fixture({ validSignature: false });
    await assert.rejects(
      invalid.service.handleTBankPaymentNotification({ Status: "CANCELED" }),
      /signature rejected/,
    );
    assert.deepEqual(invalid.events, ["signature"]);
  });

  it("does not query bank closure for non-closing notifications", async () => {
    for (const Status of ["REJECTED", "AUTH_FAIL", "CONFIRMED", "NEW"]) {
      const { service, events } = fixture();
      await service.handleTBankPaymentNotification({ Status });
      assert.deepEqual(events, ["signature", "terminal-stored"]);
    }
  });

  it("never restarts an uncertain Init for ordinary or loyalty orders after the old lease expires", async () => {
    for (const pricingSnapshot of [
      null,
      { loyaltyDiscountKopecks: 0 },
      { loyaltyDiscountKopecks: 20 },
    ]) {
      for (const state of [
        {
          paymentStatus: "PENDING",
          paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
        },
        {
          paymentStatus: "FAILED",
          paymentRedirectUrl: "/checkout/payment-initializing?startedAt=1",
        },
        {
          paymentStatus: "FAILED",
          paymentRedirectUrl: "https://bank.test/pay",
        },
        {
          paymentStatus: "PENDING",
          paymentRedirectUrl: "https://bank.test/pay",
        },
      ]) {
        let writes = 0;
        const tx = {
          $queryRaw: async () => [],
          order: {
            findUnique: async () => ({
              ...state,
              pricingSnapshot,
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
        assert.equal(
          await storage.claimPaymentInitialization("order-1"),
          false,
        );
        assert.equal(writes, 0);
      }
    }
  });

  it("allows the first Init for a new ordinary or loyalty order", async () => {
    const scheduledAt = new Date("2040-01-01T00:01:00.000Z");
    for (const pricingSnapshot of [
      null,
      { loyaltyDiscountKopecks: 0 },
      { loyaltyDiscountKopecks: 20 },
    ]) {
      let writes = 0;
      const tx = {
        $queryRaw: async (query: { strings?: readonly string[] }) => {
          const sql = Array.isArray(query) ? query.join("") : query.strings?.join("") ?? "";
          return sql.includes("clock_timestamp") ? [{ nextAttemptAt: scheduledAt }] : [];
        },
        order: {
          findUnique: async () => ({
            paymentStatus: "PENDING",
            paymentRedirectUrl: "/checkout/success?orderId=order-1",
            pricingSnapshot,
          }),
          update: async () => {
            writes += 1;
          },
        },
        orderPaymentRecovery: {
          create: async ({ data }: { data: { orderId: string; nextAttemptAt: Date } }) => {
            assert.equal(data.orderId, "order-1");
            assert.equal(data.nextAttemptAt.getTime(), scheduledAt.getTime());
          },
        },
      };
      const storage = Object.assign(Object.create(OrdersStorage.prototype), {
        prisma: {
          $transaction: (run: (client: unknown) => unknown) => run(tx),
        },
      }) as OrdersStorage;
      assert.equal(await storage.claimPaymentInitialization("order-1"), true);
      assert.equal(writes, 1);
    }
  });
});
