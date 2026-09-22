import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OrdersService } from "../src/orders/orders.service";

function fixture(method = "TBANK_ACQUIRING") {
  const source = {
    id: "order-1",
    paymentMethod: method,
    paymentStatus: "FAILED",
    total: "799.00",
    tbankAcquiringPaymentId: null as string | null,
    ozonAcquiringOrderId: null as string | null,
    paymentRecovery: { orderId: "order-1" } as object | null,
  };
  const state = {
    tbank: { state: "paid", paymentId: "payment-1" } as {
      state: string;
      paymentId?: string;
      reason?: string;
    },
    ozon: {
      merchantOrderId: "order-1",
      acquiringOrderId: "ozon-1",
      currencyCode: "643",
      amount: "79900",
      status: "STATUS_PAID",
    },
    bankError: undefined as Error | undefined,
    savedStatus: undefined as string | undefined,
  };
  const queries: unknown[] = [];
  const writes: Array<Record<string, unknown>> = [];
  let notifications = 0;
  const init = async () => {
    throw new Error("Recovery must not initialize a payment");
  };
  const service = Object.assign(Object.create(OrdersService.prototype), {
    ordersStorage: {
      getPaymentReconciliationSource: async () => source,
      applyPaymentReconciliation: async (input: Record<string, unknown>) => {
        writes.push(input);
        return {
          order: {
            id: source.id,
            payment: { status: state.savedStatus ?? input.state },
          },
          paymentStatus: String(state.savedStatus ?? input.state).toUpperCase(),
          paymentStatusChangedToPaid: input.state === "paid",
          previousStatus: "new",
          userId: "user-1",
        };
      },
    },
    tbankAcquiringService: {
      createCheckoutPayment: init,
      reconcilePayment: async (input: unknown) => {
        queries.push(input);
        if (state.bankError) throw state.bankError;
        return state.tbank;
      },
    },
    ozonAcquiringService: {
      createCheckoutPayment: init,
      getOrderStatus: async (input: unknown) => {
        queries.push(input);
        if (state.bankError) throw state.bankError;
        return state.ozon;
      },
    },
    queueOrderPaidNotifications: async () => {
      notifications += 1;
    },
  }) as OrdersService;
  return {
    service,
    source,
    state,
    queries,
    writes,
    notifications: () => notifications,
  };
}

describe("original payment reconciliation", () => {
  it("recovers T-Bank's original identity after a lost Init response", async () => {
    const f = fixture();
    assert.deepEqual(await f.service.reconcilePayment("order-1"), {
      state: "paid",
    });
    assert.deepEqual(f.queries, [
      { orderId: "order-1", paymentId: undefined, amountKopecks: 79900 },
    ]);
    assert.deepEqual(f.writes, [
      {
        orderId: "order-1",
        method: "TBANK_ACQUIRING",
        providerOrderId: "order-1",
        paymentId: "payment-1",
        amountKopecks: 79900,
        state: "paid",
      },
    ]);
    assert.equal(f.notifications(), 1);
  });

  it("recovers Ozon by the original merchant extId, without repeating createOrder", async () => {
    const f = fixture("OZON_ACQUIRING");
    assert.deepEqual(await f.service.reconcilePayment("order-1"), {
      state: "paid",
    });
    assert.deepEqual(f.queries, [
      {
        profile: "canonical",
        merchantOrderId: "order-1",
        acquiringOrderId: undefined,
      },
    ]);
    assert.equal(f.writes[0]?.providerOrderId, "ozon-1");
    assert.equal(f.notifications(), 1);
  });

  it("publishes Ozon canceled and expired orders as closed unpaid", async () => {
    for (const status of ["STATUS_CANCELED", "STATUS_EXPIRED"]) {
      const f = fixture("OZON_ACQUIRING");
      f.state.ozon.status = status;
      assert.deepEqual(await f.service.reconcilePayment("order-1"), {
        state: "closed_unpaid",
      });
      assert.deepEqual(f.writes, [
        {
          orderId: "order-1",
          method: "OZON_ACQUIRING",
          providerOrderId: "ozon-1",
          paymentId: undefined,
          amountKopecks: 79900,
          state: "closed_unpaid",
        },
      ]);
      assert.equal(f.notifications(), 0);
    }
  });

  it("rejects Ozon identity, original amount and currency mismatches", async () => {
    for (const change of [
      { merchantOrderId: "another-order" },
      { amount: "79800" },
      { currencyCode: "840" },
      { amount: "799.00" },
    ]) {
      const f = fixture("OZON_ACQUIRING");
      Object.assign(f.state.ozon, change);
      assert.equal(
        (await f.service.reconcilePayment("order-1")).state,
        "attention",
      );
      assert.equal(f.writes.length, 0);
    }
    const f = fixture("OZON_ACQUIRING");
    f.source.ozonAcquiringOrderId = "other-provider-id";
    assert.equal(
      (await f.service.reconcilePayment("order-1")).reason,
      "identity_mismatch",
    );
    assert.equal(f.writes.length, 0);
  });

  it("keeps Ozon pending and authorized payments unresolved, persisting discovered identity", async () => {
    for (const status of [
      "STATUS_NEW",
      "STATUS_PAYMENT_PENDING",
      "STATUS_AUTHORIZED",
    ]) {
      const f = fixture("OZON_ACQUIRING");
      f.state.ozon.status = status;
      assert.equal(
        (await f.service.reconcilePayment("order-1")).state,
        "pending",
      );
      assert.equal(f.writes[0]?.providerOrderId, "ozon-1");
      assert.equal(f.notifications(), 0);
    }
  });

  it("does not mistake partial/refunded or disputed Ozon payments for payment settlement", async () => {
    for (const status of [
      "STATUS_PARTITIONAL_REFUND",
      "STATUS_REFUNDED",
      "STATUS_DISPUTED",
    ]) {
      const f = fixture("OZON_ACQUIRING");
      f.state.ozon.status = status;
      assert.equal(
        (await f.service.reconcilePayment("order-1")).state,
        "attention",
      );
      assert.equal(f.writes.length, 0);
    }
  });

  it("only forwards proven T-Bank closure to the source publisher", async () => {
    const f = fixture();
    f.state.tbank.state = "closed_unpaid";
    assert.deepEqual(await f.service.reconcilePayment("order-1"), {
      state: "closed_unpaid",
    });
    assert.equal(f.writes[0]?.state, "closed_unpaid");
    assert.equal(f.notifications(), 0);
  });

  it("does not mutate ambiguous or unverifiable payments", async () => {
    const f = fixture();
    f.state.tbank = { state: "attention", reason: "payment_ambiguous" };
    assert.equal(
      (await f.service.reconcilePayment("order-1")).reason,
      "payment_ambiguous",
    );
    assert.equal(f.writes.length, 0);
    f.state.tbank = { state: "paid" };
    assert.equal(
      (await f.service.reconcilePayment("order-1")).reason,
      "identity_mismatch",
    );
    assert.equal(f.writes.length, 0);
  });

  it("propagates network failures for durable retry, without source writes", async () => {
    for (const method of ["TBANK_ACQUIRING", "OZON_ACQUIRING"]) {
      const f = fixture(method);
      f.state.bankError = new Error("request timeout");
      await assert.rejects(
        f.service.reconcilePayment("order-1"),
        /request timeout/,
      );
      assert.equal(f.writes.length, 0);
    }
  });

  it("does no remote work for final, untouched or unsupported orders", async () => {
    for (const final of ["PAID", "CLOSED_UNPAID"]) {
      const f = fixture();
      f.source.paymentStatus = final;
      assert.equal(
        (await f.service.reconcilePayment("order-1")).state,
        final.toLowerCase(),
      );
      assert.equal(f.queries.length, 0);
    }
    const f = fixture();
    f.source.paymentRecovery = null;
    assert.equal(
      (await f.service.reconcilePayment("order-1")).state,
      "attention",
    );
    assert.equal(f.queries.length, 0);
    const unsupported = fixture("BANK_CARD_MOCK");
    assert.equal(
      (await unsupported.service.reconcilePayment("order-1")).reason,
      "unsupported_provider",
    );
    assert.equal(unsupported.queries.length, 0);
  });

  it("keeps a webhook's newer PAID result when a pending lookup arrives late", async () => {
    const f = fixture();
    f.state.tbank.state = "pending";
    f.state.savedStatus = "paid";
    assert.deepEqual(await f.service.reconcilePayment("order-1"), {
      state: "paid",
    });
    assert.equal(f.notifications(), 0);
  });
});
