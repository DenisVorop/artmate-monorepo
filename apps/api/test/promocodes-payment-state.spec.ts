import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  OrderCrmStatus,
  OrderDeliveryProvider,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "../src/generated/prisma/client";
import { OrdersStorage } from "../src/orders/orders.storage";
import { OrdersService } from "../src/orders/orders.service";
import { OzonAcquiringService } from "../src/ozon/ozon-acquiring.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { PromocodesService } from "../src/promocodes/promocodes.service";

describe("promocode payment state integrity", () => {
  it("rejects mismatched T-Bank amount and payment id before mutation", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      tbankAcquiringPaymentId: "7001",
    });
    await assert.rejects(
      fixture.storage.applyTBankAcquiringNotification({
        amount: "338699",
        orderId: fixture.state.id,
        paymentId: "7001",
        raw: {},
        rawStatus: "CONFIRMED",
        status: "paid",
        success: true,
      }),
      BadRequestException,
    );
    await assert.rejects(
      fixture.storage.applyTBankAcquiringNotification({
        amount: "338700",
        orderId: fixture.state.id,
        paymentId: "other",
        raw: {},
        rawStatus: "CONFIRMED",
        status: "paid",
        success: true,
      }),
      BadRequestException,
    );
    assert.equal(fixture.updateCount(), 0);
    assert.equal(fixture.consumeCount(), 0);
  });

  it("rejects mismatched Ozon amount/currency/ids before mutation", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
      ozonAcquiringOrderId: "ozon-order-1",
    });
    for (const notification of [
      {
        amount: "1",
        currencyCode: "643",
        acquiringOrderId: "ozon-order-1",
        verified: canonicalVerification(fixture.state.id),
      },
      {
        amount: "338700",
        currencyCode: "840",
        acquiringOrderId: "ozon-order-1",
        verified: canonicalVerification(fixture.state.id),
      },
      {
        amount: "338700",
        currencyCode: "643",
        acquiringOrderId: "other",
        verified: {
          ...canonicalVerification(fixture.state.id),
          acquiringOrderId: "other",
        },
      },
    ]) {
      await assert.rejects(
        fixture.storage.applyOzonAcquiringNotification({
          ...notification,
          extOrderId: fixture.state.id,
          raw: {},
          status: "Completed",
          transactionId: "9001",
        }),
        BadRequestException,
      );
    }
    assert.equal(fixture.updateCount(), 0);
  });

  it("consumes and writes paid history once for duplicate callbacks", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    const notification = {
      amount: "338700",
      orderId: fixture.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    };
    const first =
      await fixture.storage.applyTBankAcquiringNotification(notification);
    const second =
      await fixture.storage.applyTBankAcquiringNotification(notification);

    assert.equal(first?.paymentStatusChangedToPaid, true);
    assert.equal(second?.paymentStatusChangedToPaid, false);
    assert.equal(fixture.consumeCount(), 1);
    assert.equal(
      fixture.history.filter((event) => event.eventType === "status_changed")
        .length,
      1,
    );
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
  });

  it("retains reserve for AUTH_FAIL and Ozon Rejected but releases confirmed terminal T-Bank", async () => {
    const authFail = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    await authFail.storage.applyTBankAcquiringNotification({
      orderId: authFail.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "AUTH_FAIL",
      status: "pending",
      success: false,
    });
    assert.equal(authFail.releaseCount(), 0);

    const rejected = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await rejected.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      extOrderId: rejected.state.id,
      raw: {},
      status: "Rejected",
      transactionId: "9001",
      verified: canonicalVerification(rejected.state.id, "9001"),
    });
    assert.equal(rejected.releaseCount(), 0);
    assert.equal(rejected.state.paymentStatus, OrderPaymentStatus.PENDING);

    const terminal = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    await terminal.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: terminal.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "REJECTED",
      status: "failed",
      success: false,
    });
    assert.equal(terminal.releaseCount(), 1);
    assert.equal(terminal.state.paymentStatus, OrderPaymentStatus.FAILED);
  });

  it("does not let attach/failure overwrite an early paid callback", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    await fixture.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: fixture.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });
    await fixture.storage.attachTBankAcquiringPayment(fixture.state.id, {
      acquiringOrderId: fixture.state.id,
      paymentId: "7001",
      redirectUrl: "https://pay.test",
    });
    await fixture.storage.markTBankAcquiringPaymentFailed(fixture.state.id, {
      errorMessage: "late local error",
    });
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
  });

  it("does not let Ozon attach overwrite an early paid callback", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: {},
      status: "Completed",
      transactionId: "9001",
      verified: canonicalVerification(fixture.state.id),
    });
    await fixture.storage.attachOzonAcquiringPayment(fixture.state.id, {
      acquiringOrderId: "ozon-order-1",
      paymentId: "payment-1",
      redirectUrl: "https://pay.test",
    });
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
    assert.equal(fixture.state.ozonAcquiringOrderId, "ozon-order-1");
    assert.equal(fixture.state.ozonAcquiringPaymentId, "payment-1");
    assert.equal(fixture.state.paymentRedirectUrl, "https://pay.test");
  });

  it("validates terminal T-Bank amount and payment id before release", async () => {
    for (const notification of [
      { amount: "1", paymentId: "7001" },
      { amount: "338700", paymentId: undefined },
    ]) {
      const fixture = createFixture({
        paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      });
      await assert.rejects(
        fixture.storage.applyTBankAcquiringNotification({
          ...notification,
          orderId: fixture.state.id,
          raw: {},
          rawStatus: "CANCELED",
          status: "failed",
          success: false,
        }),
        BadRequestException,
      );
      assert.equal(fixture.releaseCount(), 0);
      assert.equal(fixture.updateCount(), 0);
      assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PENDING);
    }
  });

  it("does not let either attach overwrite an early terminal failure", async () => {
    for (const paymentMethod of [
      OrderPaymentMethod.TBANK_ACQUIRING,
      OrderPaymentMethod.OZON_ACQUIRING,
    ]) {
      const fixture = createFixture({ paymentMethod });
      if (paymentMethod === OrderPaymentMethod.TBANK_ACQUIRING) {
        await fixture.storage.applyTBankAcquiringNotification({
          amount: "338700",
          orderId: fixture.state.id,
          paymentId: "7001",
          raw: {},
          rawStatus: "CANCELED",
          status: "failed",
          success: false,
        });
        await fixture.storage.attachTBankAcquiringPayment(fixture.state.id, {
          acquiringOrderId: fixture.state.id,
          paymentId: "7001",
          redirectUrl: "https://pay.test/tbank",
        });
        assert.equal(fixture.state.tbankAcquiringPaymentId, "7001");
      } else {
        fixture.state.paymentStatus = OrderPaymentStatus.FAILED;
        await fixture.storage.attachOzonAcquiringPayment(fixture.state.id, {
          acquiringOrderId: "ozon-order-1",
          paymentId: "payment-1",
          redirectUrl: "https://pay.test/ozon",
        });
        assert.equal(fixture.state.ozonAcquiringPaymentId, "payment-1");
      }
      assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.FAILED);
      assert.match(fixture.state.paymentRedirectUrl, /^https:\/\/pay\.test\//);
    }
  });

  it("binds only the first confirmed Ozon transaction attempt", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      extOrderId: fixture.state.id,
      raw: {},
      status: "Rejected",
      transactionId: "attempt-1",
      verified: canonicalVerification(fixture.state.id, "attempt-1"),
    });
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);

    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: {},
      status: "Completed",
      transactionId: "attempt-2",
      verified: canonicalVerification(fixture.state.id, "attempt-2"),
    });
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
    assert.equal(fixture.state.ozonAcquiringTransactionId, "attempt-2");

    await assert.rejects(
      fixture.storage.applyOzonAcquiringNotification({
        acquiringOrderId: "ozon-order-1",
        amount: "338700",
        currencyCode: "643",
        extOrderId: fixture.state.id,
        raw: {},
        status: "Completed",
        transactionId: "attempt-3",
        verified: canonicalVerification(fixture.state.id, "attempt-3"),
      }),
      BadRequestException,
    );
  });

  it("binds only the signed canonical transaction branch", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: {},
      status: "Completed",
      transactionId: "unsigned-other-branch",
      transactionUid: "signed-uid",
      verified: {
        profile: "canonical",
        merchantOrderId: fixture.state.id,
        acquiringOrderId: "ozon-order-1",
        transactionIdentity: {
          kind: "transactionUid",
          value: "signed-uid",
        },
      },
    });
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);
    assert.equal(fixture.state.ozonAcquiringTransactionUid, "signed-uid");

    await assert.rejects(
      fixture.storage.applyOzonAcquiringNotification({
        acquiringOrderId: "ozon-order-1",
        amount: "338700",
        currencyCode: "643",
        extOrderId: fixture.state.id,
        raw: {},
        status: "Completed",
        transactionId: "different-branch",
        verified: canonicalVerification(fixture.state.id, "different-branch"),
      }),
      BadRequestException,
    );
  });

  it("does not bind unsigned secondary provider identities before Init", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "unsigned-order",
      amount: "338700",
      currencyCode: "643",
      extTransactionId: fixture.state.id,
      raw: {},
      status: "Completed",
      transactionId: "unsigned-transaction",
      verified: { profile: "secondary", merchantOrderId: fixture.state.id },
    });
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
    assert.equal(fixture.state.ozonAcquiringOrderId, null);
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);
  });

  it("rejects unsigned secondary provider identity conflicts after Init", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
      ozonAcquiringOrderId: "ozon-order-1",
      ozonAcquiringTransactionId: "transaction-1",
    });
    await assert.rejects(
      fixture.storage.applyOzonAcquiringNotification({
        acquiringOrderId: "attacker-order",
        amount: "338700",
        currencyCode: "643",
        extTransactionId: fixture.state.id,
        raw: {},
        status: "Completed",
        transactionId: "attacker-transaction",
        verified: { profile: "secondary", merchantOrderId: fixture.state.id },
      }),
      BadRequestException,
    );
    assert.equal(fixture.updateCount(), 0);
    assert.equal(fixture.consumeCount(), 0);
  });

  it("forbids owner confirmation for real payment methods", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await assert.rejects(
      fixture.storage.markOrderAsPaid(fixture.state.id, "user-1"),
      /Only mock card payments/,
    );
    assert.equal(fixture.consumeCount(), 0);
  });
});

describe("Ozon verified notification profiles", () => {
  it("accepts canonical and secondary signed profiles through the real verifier/parser flow", async () => {
    await withOzonKeys(async () => {
      for (const profile of ["canonical", "secondary"] as const) {
        let applied: Record<string, unknown> | undefined;
        const service = createOzonNotificationService((input) => {
          applied = input;
        });
        const body = createSignedOzonNotification(profile, {
          merchantOrderId: "order-A",
        });
        await service.handleOzonPaymentNotification(body);
        assert.equal(
          (applied?.verified as { profile: string; merchantOrderId: string })
            .profile,
          profile,
        );
        assert.equal(
          (applied?.verified as { profile: string; merchantOrderId: string })
            .merchantOrderId,
          "order-A",
        );
      }
    });
  });

  it("rejects conflicting or missing merchant identity before storage", async () => {
    await withOzonKeys(async () => {
      for (const body of [
        createSignedOzonNotification("secondary", {
          merchantOrderId: "order-A",
          unsigned: { extOrderID: "order-B" },
        }),
        createSignedOzonNotification("canonical", {
          merchantOrderId: "order-A",
          unsigned: { extTransactionID: "order-B" },
        }),
        createSignedOzonNotification("secondary", { merchantOrderId: "" }),
      ]) {
        let writes = 0;
        const service = createOzonNotificationService(() => {
          writes += 1;
        });
        await assert.rejects(
          service.handleOzonPaymentNotification(body),
          /merchant order identit/,
        );
        assert.equal(writes, 0);
      }
    });
  });

  it("canonical verification signs transactionUid only when transactionID is absent", async () => {
    await withOzonKeys(async () => {
      const service = new OzonAcquiringService();
      const body = createSignedOzonNotification("canonical", {
        merchantOrderId: "order-A",
        unsigned: { transactionUid: "transaction-uid" },
      });
      delete body.transactionID;
      body.requestSign = signOzonNotification("canonical", body);

      const verified = service.assertValidNotification(body);
      assert.deepEqual(verified, {
        profile: "canonical",
        merchantOrderId: "order-A",
        acquiringOrderId: "ozon-order-1",
        transactionIdentity: {
          kind: "transactionUid",
          value: "transaction-uid",
        },
      });
    });
  });
});

function canonicalVerification(orderId: string, transactionId = "9001") {
  return {
    profile: "canonical" as const,
    merchantOrderId: orderId,
    acquiringOrderId: "ozon-order-1",
    transactionIdentity: {
      kind: "transactionId" as const,
      value: transactionId,
    },
  };
}

function createOzonNotificationService(
  onApply: (input: Record<string, unknown>) => void,
) {
  return Object.assign(Object.create(OrdersService.prototype), {
    logger: { warn: () => undefined },
    ordersStorage: {
      applyOzonAcquiringNotification: async (
        input: Record<string, unknown>,
      ) => {
        onApply(input);
        return undefined;
      },
    },
    ozonAcquiringService: new OzonAcquiringService(),
  }) as OrdersService;
}

function createSignedOzonNotification(
  profile: "canonical" | "secondary",
  input: {
    merchantOrderId: string;
    unsigned?: Record<string, string>;
  },
) {
  const body: Record<string, unknown> = {
    amount: "338700",
    currencyCode: "643",
    orderID: "ozon-order-1",
    status: "Completed",
    transactionID: 9001,
    ...input.unsigned,
  };
  if (profile === "canonical") body.extOrderID = input.merchantOrderId;
  else body.extTransactionID = input.merchantOrderId;
  body.requestSign = signOzonNotification(profile, body);
  return body;
}

function signOzonNotification(
  profile: "canonical" | "secondary",
  body: Record<string, unknown>,
) {
  const transaction = String(body.transactionID ?? body.transactionUid ?? "");
  return crypto
    .createHash("sha256")
    .update(
      profile === "canonical"
        ? [
            "test-access",
            String(body.orderID ?? ""),
            transaction,
            String(body.extOrderID ?? ""),
            String(body.amount ?? ""),
            String(body.currencyCode ?? ""),
            "test-notification",
          ].join("|")
        : [
            "test-access",
            "",
            "",
            String(body.extTransactionID ?? ""),
            String(body.amount ?? ""),
            String(body.currencyCode ?? ""),
            "test-notification",
          ].join("|"),
    )
    .digest("hex");
}

async function withOzonKeys(run: () => Promise<void>) {
  const accessKey = process.env.OZON_ACQUIRING_ACCESS_KEY;
  const notificationKey = process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY;
  process.env.OZON_ACQUIRING_ACCESS_KEY = "test-access";
  process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY = "test-notification";
  try {
    await run();
  } finally {
    if (accessKey === undefined) delete process.env.OZON_ACQUIRING_ACCESS_KEY;
    else process.env.OZON_ACQUIRING_ACCESS_KEY = accessKey;
    if (notificationKey === undefined) {
      delete process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY;
    } else {
      process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY = notificationKey;
    }
  }
}

function createFixture(
  overrides: Partial<ReturnType<typeof createOrderState>> = {},
) {
  const state = Object.assign(createOrderState(), overrides);
  const history: Array<{ eventType: string; payload: unknown }> = [];
  let updates = 0;
  let consumes = 0;
  let releases = 0;
  const tx = {
    $queryRaw: async () => [],
    order: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; userId?: string };
      }) =>
        where.id === state.id &&
        (!where.userId || where.userId === state.userId)
          ? { ...state }
          : null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.id ? { ...state } : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates += 1;
        const { history: nestedHistory, ...fields } = data;
        Object.assign(state, fields);
        if (
          nestedHistory &&
          typeof nestedHistory === "object" &&
          "create" in nestedHistory
        ) {
          history.push(
            (
              nestedHistory as {
                create: { eventType: string; payload: unknown };
              }
            ).create,
          );
        }
        return state;
      },
    },
    orderHistory: {
      create: async ({
        data,
      }: {
        data: { eventType: string; payload: unknown };
      }) => {
        history.push(data);
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
  } as unknown as PrismaService;
  const promos = {
    consumeInTransaction: async () => {
      consumes += 1;
      return { changed: true, usedAfterRelease: false };
    },
    releaseInTransaction: async () => {
      releases += 1;
      return {};
    },
  } as unknown as PromocodesService;
  return {
    state,
    history,
    storage: new OrdersStorage(prisma, promos),
    consumeCount: () => consumes,
    releaseCount: () => releases,
    updateCount: () => updates,
  };
}

function createOrderState() {
  return {
    id: "order-acceptance-1",
    userId: "user-1",
    cartId: "cart-1",
    status: OrderStatus.PENDING_PAYMENT,
    crmStatus: OrderCrmStatus.WAITING_PAYMENT,
    customerName: "Buyer",
    customerPhone: "+79990000000",
    customerEmail: "buyer@example.com",
    deliveryProvider: OrderDeliveryProvider.OZON,
    pickupPointId: "point-1",
    pickupPointTitle: "Point",
    pickupPointAddress: "Address",
    pickupPointWorkHours: "09:00-21:00",
    deliveryPrice: 490,
    paymentMethod: OrderPaymentMethod.BANK_CARD_MOCK as OrderPaymentMethod,
    paymentStatus: OrderPaymentStatus.PENDING as OrderPaymentStatus,
    paymentRedirectUrl: "/checkout/success",
    ozonAcquiringOrderId: null as string | null,
    ozonAcquiringPaymentId: null as string | null,
    ozonAcquiringTransactionId: null as string | null,
    ozonAcquiringTransactionUid: null as string | null,
    tbankAcquiringOrderId: null as string | null,
    tbankAcquiringPaymentId: null as string | null,
    paymentErrorCode: null as string | null,
    paymentErrorMessage: null as string | null,
    lastPaymentNotification: null,
    itemsCount: 3,
    subtotal: 2_997,
    discount: 100,
    total: { toString: () => "3387.00" },
    promoCode: "SALE10",
    promoTermsSnapshot: {},
    promoPricingSnapshot: {},
    currency: "RUB",
    comment: null,
    paidAt: null as Date | null,
    createdAt: new Date("2026-08-31T00:00:00Z"),
    updatedAt: new Date("2026-08-31T00:00:00Z"),
    items: [
      {
        orderId: "order-acceptance-1",
        productId: "product-1",
        title: "Product",
        slug: "product",
        price: 999,
        category: null,
        categorySlug: null,
        image: "/product.jpg",
        quantity: 3,
        lineTotal: 2_997,
        createdAt: new Date("2026-08-31T00:00:00Z"),
      },
    ],
    shipments: [],
  };
}
