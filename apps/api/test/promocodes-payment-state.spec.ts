import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
} from "@nestjs/common";

import type { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import type { OrderActivationService } from "../src/auth/order-activation.service";
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
import { TBankAcquiringService } from "../src/tbank/tbank-acquiring.service";
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
        }),
        BadRequestException,
      );
    }
    assert.equal(fixture.updateCount(), 0);
  });

  it("does not include unsigned status in the verified notification envelope", async () => {
    await withOzonKeys(async () => {
      const ozon = new OzonAcquiringService();
      const notification = createSignedOzonNotification("canonical", {
        merchantOrderId: "order-A",
      });
      notification.status = "Pending";
      notification.requestSign = signOzonNotification("canonical", notification);
      const verified = ozon.assertValidNotification(notification);
      notification.status = "Completed";
      const parsed = ozon.parseNotification(notification, verified);

      assert.equal("status" in verified, false);
      assert.equal("status" in parsed, false);
    });
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
    assert.equal(fixture.activationCount(), 0);
    assert.equal(fixture.analyticsCount(), 1);
    assert.equal(
      fixture.history.filter((event) => event.eventType === "status_changed")
        .length,
      1,
    );
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
  });

  it("provisions a paid guest exactly once for duplicate T-Bank callbacks", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      userId: null,
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

    await fixture.storage.applyTBankAcquiringNotification(notification);
    await fixture.storage.applyTBankAcquiringNotification(notification);

    assert.equal(fixture.activationCount(), 1);
    assert.equal(fixture.analyticsCount(), 1);
  });

  it("provisions a paid guest exactly once for duplicate Ozon callbacks", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
      userId: null,
    });
    await withOzonKeys(async () => {
      const body = createSignedOzonNotification("canonical", {
        merchantOrderId: fixture.state.id,
      });
      const ozon = new OzonAcquiringService();
      const parsed = ozon.parseNotification(
        body,
        ozon.assertValidNotification(body),
      );
      const notification = {
        ...parsed,
        authoritativeStatus: "STATUS_PAID",
        raw: body,
      };

      await fixture.storage.applyOzonAcquiringNotification(notification);
      await fixture.storage.applyOzonAcquiringNotification(notification);
    });

    assert.equal(fixture.activationCount(), 1);
    assert.equal(fixture.analyticsCount(), 1);
  });

  it("does not enqueue paid analytics for pending or failed transitions", async () => {
    const tbank = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    await tbank.storage.applyTBankAcquiringNotification({
      orderId: tbank.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "AUTH_FAIL",
      status: "pending",
      success: false,
    });
    await tbank.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: tbank.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "REJECTED",
      status: "failed",
      success: false,
    });
    assert.equal(tbank.analyticsCount(), 0);
  });

  it("rejects unpaid admin transitions into the paid workflow without payment side effects", async () => {
    for (const status of ["paid", "delivering", "completed"] as const) {
      const fixture = createFixture({
        ozonAcquiringOrderId: "ozon-order-1",
        ozonAcquiringPaymentId: "payment-1",
      });
      const paymentState = {
        paidAt: fixture.state.paidAt,
        paymentStatus: fixture.state.paymentStatus,
        status: fixture.state.status,
        ozonAcquiringOrderId: fixture.state.ozonAcquiringOrderId,
        ozonAcquiringPaymentId: fixture.state.ozonAcquiringPaymentId,
        userId: fixture.state.userId,
      };

      await assert.rejects(
        fixture.storage.updateAdminOrderStatus(
          fixture.state.id,
          status,
          "admin-1",
        ),
        (error: unknown) =>
          error instanceof ConflictException &&
          error.getStatus() === 409 &&
          /payment must be confirmed/i.test(error.message),
      );

      assert.deepEqual(
        {
          paidAt: fixture.state.paidAt,
          paymentStatus: fixture.state.paymentStatus,
          status: fixture.state.status,
          ozonAcquiringOrderId: fixture.state.ozonAcquiringOrderId,
          ozonAcquiringPaymentId: fixture.state.ozonAcquiringPaymentId,
          userId: fixture.state.userId,
        },
        paymentState,
      );
      assert.equal(fixture.state.crmStatus, OrderCrmStatus.WAITING_PAYMENT);
      assert.equal(fixture.updateCount(), 0);
      assert.equal(fixture.consumeCount(), 0);
      assert.equal(fixture.activationCount(), 0);
      assert.equal(fixture.analyticsCount(), 0);
      assert.equal(fixture.history.length, 0);
    }
  });

  it("moves an already paid order through CRM stages without mutating payment state", async () => {
    const paidAt = new Date("2026-09-07T12:00:00.000Z");
    const fixture = createFixture({
      crmStatus: OrderCrmStatus.PAID,
      paidAt,
      paymentStatus: OrderPaymentStatus.PAID,
      status: OrderStatus.PAID,
      tbankAcquiringOrderId: "tbank-order-1",
      tbankAcquiringPaymentId: "7001",
      userId: "paid-user",
    });

    for (const status of ["paid", "delivering", "completed"] as const) {
      await fixture.storage.updateAdminOrderStatus(
        fixture.state.id,
        status,
        "admin-1",
      );
    }

    assert.equal(fixture.state.crmStatus, OrderCrmStatus.COMPLETED);
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
    assert.equal(fixture.state.status, OrderStatus.PAID);
    assert.equal(fixture.state.paidAt, paidAt);
    assert.equal(fixture.state.tbankAcquiringOrderId, "tbank-order-1");
    assert.equal(fixture.state.tbankAcquiringPaymentId, "7001");
    assert.equal(fixture.state.userId, "paid-user");
    assert.equal(fixture.consumeCount(), 0);
    assert.equal(fixture.activationCount(), 0);
    assert.equal(fixture.analyticsCount(), 0);
    assert.deepEqual(
      fixture.history.map((event) => event.eventType),
      ["status_changed", "status_changed"],
    );
  });

  it("rolls back the first paid transition when transactional enqueue fails", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    fixture.rejectAnalytics();

    await assert.rejects(
      fixture.storage.applyTBankAcquiringNotification({
        amount: "338700",
        orderId: fixture.state.id,
        paymentId: "7001",
        raw: {},
        rawStatus: "CONFIRMED",
        status: "paid",
        success: true,
      }),
      /analytics enqueue failed/,
    );

    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PENDING);
    assert.equal(fixture.analyticsCount(), 0);
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
    assert.equal(terminal.state.terminalPaymentFailedAt instanceof Date, true);
    assert.equal(terminal.state.paymentRedirectUrl, "/checkout/failure");
  });

  it("restores a verified terminal T-Bank snapshot once without doubling existing quantities", async () => {
    const fixture = createFixture({
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      terminalPaymentFailedAt: new Date(),
      userId: null,
    });
    fixture.cartItems.set("product-1", 3);

    assert.deepEqual(
      await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId),
      { redirectUrl: "/checkout" },
    );
    const restoredAt = fixture.state.cartRestoredAt;
    assert.equal(fixture.cartItems.get("product-1"), 3);

    assert.deepEqual(
      await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId),
      { redirectUrl: "/checkout" },
    );
    assert.equal(fixture.state.cartRestoredAt, restoredAt);
    assert.equal(fixture.cartItems.get("product-1"), 3);
    assert.equal(
      fixture.history.filter((event) => event.eventType === "cart_restored").length,
      1,
    );
  });

  it("does not consume a legacy order cart snapshot without a checkout attempt id", async () => {
    const fixture = createFixture({
      checkoutAttemptId: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      paymentRedirectUrl: "https://pay.test",
    });
    fixture.cartItems.set("product-1", 5);

    await consumeOrderCartSnapshot(fixture);

    assert.equal(fixture.cartItems.get("product-1"), 5);
    assert.equal(fixture.state.cartConsumedAt, null);
    assert.equal(fixture.state.cartConsumedQuantities, null);
    assert.equal(
      fixture.history.filter((event) => event.eventType === "cart_consumed")
        .length,
      0,
    );
  });

  it("does not consume a legacy order cart snapshot on verified paid webhook", async () => {
    const fixture = createFixture({
      checkoutAttemptId: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });
    fixture.cartItems.set("product-1", 5);

    await fixture.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: fixture.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });

    assert.equal(fixture.cartItems.get("product-1"), 5);
    assert.equal(fixture.state.cartConsumedAt, null);
    assert.equal(fixture.state.cartConsumedQuantities, null);
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
  });

  it("consumes the order snapshot once while preserving unrelated and same-SKU additions", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      paymentRedirectUrl: "https://pay.test",
    });
    fixture.cartItems.set("product-1", 5);
    fixture.cartItems.set("unrelated", 4);

    await consumeOrderCartSnapshot(fixture);
    const consumedAt = fixture.state.cartConsumedAt;
    await consumeOrderCartSnapshot(fixture);

    assert.equal(consumedAt instanceof Date, true);
    assert.equal(fixture.state.cartConsumedAt, consumedAt);
    assert.deepEqual(fixture.state.cartConsumedQuantities, {
      "product-1": 3,
    });
    assert.equal(fixture.cartItems.get("product-1"), 2);
    assert.equal(fixture.cartItems.get("unrelated"), 4);
    assert.equal(
      fixture.history.filter((event) => event.eventType === "cart_consumed").length,
      1,
    );
  });

  it("records and restores only the quantity available during consumption", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      paymentRedirectUrl: "https://pay.test",
      terminalPaymentFailedAt: null,
      userId: null,
    });
    fixture.cartItems.set("product-1", 2);

    await consumeOrderCartSnapshot(fixture);
    assert.equal(fixture.cartItems.has("product-1"), false);
    assert.deepEqual(fixture.state.cartConsumedQuantities, {
      "product-1": 2,
    });
    fixture.state.terminalPaymentFailedAt = new Date();
    fixture.state.paymentStatus = OrderPaymentStatus.FAILED;
    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);

    assert.equal(fixture.cartItems.get("product-1"), 2);
    assert.deepEqual(fixture.state.cartRestoredQuantities, {
      "product-1": 2,
    });
  });

  it("records an empty ledger and restores nothing when the cart has no snapshot items", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      paymentRedirectUrl: "https://pay.test",
      terminalPaymentFailedAt: null,
      userId: null,
    });

    await consumeOrderCartSnapshot(fixture);
    assert.deepEqual(fixture.state.cartConsumedQuantities, {});
    fixture.state.terminalPaymentFailedAt = new Date();
    fixture.state.paymentStatus = OrderPaymentStatus.FAILED;
    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);

    assert.equal(fixture.cartItems.has("product-1"), false);
    assert.deepEqual(fixture.state.cartRestoredQuantities, {});
  });

  it("does not duplicate quantities when a second order consumes the same cart", async () => {
    const cartItems = new Map([["product-1", 3]]);
    const cartLock = createTestMutex();
    const first = createFixture(
      {
        cartConsumedAt: null,
        cartRestoredAt: null,
        paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
        paymentRedirectUrl: "https://pay.test",
        terminalPaymentFailedAt: null,
        userId: null,
      },
      { cartItems, cartLock },
    );

    const second = createFixture(
      {
        id: "order-acceptance-2",
        cartConsumedAt: null,
        cartRestoredAt: null,
        paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
        paymentRedirectUrl: "https://pay.test",
        terminalPaymentFailedAt: null,
        userId: null,
      },
      { cartItems, cartLock },
    );

    await Promise.all([
      consumeOrderCartSnapshot(first),
      consumeOrderCartSnapshot(second),
    ]);

    assert.equal(
      (first.state.cartConsumedQuantities?.["product-1"] ?? 0) +
        (second.state.cartConsumedQuantities?.["product-1"] ?? 0),
      3,
    );
    assert.equal(cartItems.has("product-1"), false);
    first.state.terminalPaymentFailedAt = new Date();
    first.state.paymentStatus = OrderPaymentStatus.FAILED;
    second.state.terminalPaymentFailedAt = new Date();
    second.state.paymentStatus = OrderPaymentStatus.FAILED;
    await Promise.all([
      first.storage.recoverGuestPayment(first.state.id, first.state.cartId),
      second.storage.recoverGuestPayment(second.state.id, second.state.cartId),
    ]);
    assert.equal(cartItems.get("product-1"), 3);
  });

  it("restores consumed quantities additively and makes delayed consumption a no-op", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      paymentRedirectUrl: "https://pay.test",
      terminalPaymentFailedAt: null,
      userId: null,
    });
    fixture.cartItems.set("product-1", 5);
    fixture.cartItems.set("unrelated", 4);
    await consumeOrderCartSnapshot(fixture);
    assert.equal(fixture.cartItems.get("product-1"), 2);
    fixture.state.terminalPaymentFailedAt = new Date();
    fixture.state.paymentStatus = OrderPaymentStatus.FAILED;

    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);
    await consumeOrderCartSnapshot(fixture);

    assert.equal(fixture.cartItems.get("product-1"), 5);
    assert.equal(fixture.cartItems.get("unrelated"), 4);
  });

  it("does not duplicate an unconsumed snapshot during recovery", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      terminalPaymentFailedAt: new Date(),
      userId: null,
    });
    fixture.cartItems.set("product-1", 5);

    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);

    assert.equal(fixture.cartItems.get("product-1"), 5);
  });

  it("verified paid retries missing consumption and preserves manual additions", async () => {
    const fixture = createFixture({
      cartConsumedAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      userId: null,
    });
    fixture.cartItems.set("product-1", 5);
    fixture.cartItems.set("unrelated", 4);

    await fixture.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: fixture.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });

    assert.equal(fixture.state.cartConsumedAt instanceof Date, true);
    assert.equal(fixture.cartItems.get("product-1"), 2);
    assert.equal(fixture.cartItems.get("unrelated"), 4);
  });

  it("caps restored quantities at 99", async () => {
    const fixture = createFixture({
      cartConsumedAt: new Date(),
      cartConsumedQuantities: { "product-1": 120 },
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      terminalPaymentFailedAt: new Date(),
      userId: null,
    });
    fixture.state.items[0]!.quantity = 120;

    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);

    assert.equal(fixture.cartItems.get("product-1"), 99);
  });

  it("late paid subtracts only the quantity actually restored at the cart cap", async () => {
    const fixture = createFixture({
      cartConsumedAt: new Date(),
      cartConsumedQuantities: { "product-1": 3 },
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      terminalPaymentFailedAt: new Date(),
      userId: null,
    });
    fixture.cartItems.set("product-1", 98);

    await fixture.storage.recoverGuestPayment(fixture.state.id, fixture.state.cartId);
    assert.equal(fixture.cartItems.get("product-1"), 99);
    await fixture.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: fixture.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });

    assert.equal(fixture.cartItems.get("product-1"), 98);
  });

  it("does not restore when paid wins and consumes after recovery beats delayed cleanup", async () => {
    const paidFirst = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      userId: null,
    });
    await paidFirst.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: paidFirst.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });
    assert.deepEqual(
      await paidFirst.storage.recoverGuestPayment(
        paidFirst.state.id,
        paidFirst.state.cartId,
      ),
      { redirectUrl: "/checkout/success" },
    );
    assert.equal(paidFirst.state.cartRestoredAt, null);

    const restoredFirst = createFixture({
      cartRestoredAt: null,
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
      terminalPaymentFailedAt: new Date(),
      userId: null,
    });
    restoredFirst.cartItems.set("unrelated", 4);
    await restoredFirst.storage.recoverGuestPayment(
      restoredFirst.state.id,
      restoredFirst.state.cartId,
    );
    restoredFirst.cartItems.set("product-1", 5);
    await restoredFirst.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: restoredFirst.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });
    await restoredFirst.storage.applyTBankAcquiringNotification({
      amount: "338700",
      orderId: restoredFirst.state.id,
      paymentId: "7001",
      raw: {},
      rawStatus: "CONFIRMED",
      status: "paid",
      success: true,
    });

    assert.equal(restoredFirst.cartItems.get("product-1"), 2);
    assert.equal(restoredFirst.cartItems.get("unrelated"), 4);
    assert.equal(restoredFirst.state.cartRestoredAt instanceof Date, true);
    assert.equal(
      restoredFirst.history.filter(
        (event) => event.eventType === "cart_consumed",
      ).length,
      1,
    );
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

  it("rejects unsafe provider redirect URLs before storing them", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.TBANK_ACQUIRING,
    });

    await assert.rejects(
      fixture.storage.attachTBankAcquiringPayment(fixture.state.id, {
        acquiringOrderId: fixture.state.id,
        paymentId: "7001",
        redirectUrl: "http://securepay.tinkoff.ru/session",
      }),
      BadRequestException,
    );
    assert.equal(fixture.updateCount(), 0);
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
      authoritativeStatus: "STATUS_PAID",
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
    assert.equal(fixture.state.paymentRedirectUrl, "/checkout/success");
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
      assert.equal(
        fixture.state.paymentRedirectUrl,
        paymentMethod === OrderPaymentMethod.TBANK_ACQUIRING
          ? "/checkout/failure"
          : "https://pay.test/ozon",
      );
    }
  });

  it("does not reject delayed attempt A after aggregate paid status from attempt B", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      extOrderId: fixture.state.id,
      raw: { transactionID: "attempt-1" },
      verified: canonicalVerification(fixture.state.id, "attempt-1"),
    });
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);

    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: { transactionID: "attempt-2" },
      authoritativeStatus: "STATUS_PAID",
      verified: canonicalVerification(fixture.state.id, "attempt-2"),
    });
    assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);

    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: { transactionID: "attempt-1" },
      authoritativeStatus: "STATUS_PAID",
      verified: canonicalVerification(fixture.state.id, "attempt-1"),
    });
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);
    assert.equal(fixture.analyticsCount(), 1);
  });

  it("does not bind transactionUid from an aggregate paid lookup", async () => {
    const fixture = createFixture({
      paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
    });
    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: {
        transactionID: "unsigned-other-branch",
        transactionUid: "signed-uid",
      },
      authoritativeStatus: "STATUS_PAID",
      verified: {
        profile: "canonical",
        merchantOrderId: fixture.state.id,
        acquiringOrderId: "ozon-order-1",
      },
    });
    assert.equal(fixture.state.ozonAcquiringTransactionId, null);
    assert.equal(fixture.state.ozonAcquiringTransactionUid, null);

    await fixture.storage.applyOzonAcquiringNotification({
      acquiringOrderId: "ozon-order-1",
      amount: "338700",
      currencyCode: "643",
      extOrderId: fixture.state.id,
      raw: { transactionID: "different-branch" },
      authoritativeStatus: "STATUS_PAID",
      verified: canonicalVerification(fixture.state.id, "different-branch"),
    });
    assert.equal(fixture.state.ozonAcquiringTransactionUid, null);
  });

});

describe("Ozon verified notification profiles", () => {
  it("accepts a canonical signed profile through the real verifier/parser flow", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        jsonResponse({
          extId: "order-A",
          id: "ozon-order-1",
          originalAmount: { currencyCode: "643", value: "338700" },
          status: "STATUS_PAYMENT_PENDING",
        });
      try {
        let applied: Record<string, unknown> | undefined;
        const service = createOzonNotificationService((input) => {
          applied = input;
        });
        const body = createSignedOzonNotification("canonical", {
          merchantOrderId: "order-A",
        });
        await service.handleOzonPaymentNotification(body);
        assert.equal(
          (applied?.verified as { profile: string; merchantOrderId: string })
            .profile,
          "canonical",
        );
        assert.equal(
          (applied?.verified as { profile: string; merchantOrderId: string })
            .merchantOrderId,
          "order-A",
        );
        assert.equal("status" in (applied ?? {}), false);
        assert.equal(applied?.authoritativeStatus, "STATUS_PAYMENT_PENDING");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("rejects conflicting or missing merchant identity before storage", async () => {
    await withOzonKeys(async () => {
      for (const body of [
        createSignedOzonNotification("canonical", {
          merchantOrderId: "order-A",
          unsigned: { extTransactionID: "order-B" },
        }),
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

  it("rejects an invalid signature before payment storage", async () => {
    await withOzonKeys(async () => {
      let writes = 0;
      const service = createOzonNotificationService(() => {
        writes += 1;
      });
      const body = createSignedOzonNotification("canonical", {
        merchantOrderId: "order-A",
      });
      body.requestSign = "invalid-signature";

      await assert.rejects(
        service.handleOzonPaymentNotification(body),
        /signature is invalid/,
      );
      assert.equal(writes, 0);
    });
  });

  it("canonical verification accepts a transactionUid signature without trusting its identity", async () => {
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
      });
    });
  });

  it("preserves integer callback errorCode for diagnostics", async () => {
    await withOzonKeys(async () => {
      const ozon = new OzonAcquiringService();
      const body = createSignedOzonNotification("canonical", {
        merchantOrderId: "order-A",
      });
      body.errorCode = 7;
      const parsed = ozon.parseNotification(
        body,
        ozon.assertValidNotification(body),
      );

      assert.equal(parsed.errorCode, "7");
    });
  });
});

describe("Ozon canonical callback status confirmation", () => {
  it("uses the documented status lookup request and automatically applies STATUS_PAID", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      const fixture = createFixture({
        paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
        userId: null,
      });
      let requestUrl: string | undefined;
      let requestBody: Record<string, unknown> | undefined;
      let paidNotifications = 0;
      globalThis.fetch = async (url, init) => {
        requestUrl = String(url);
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({
          extId: fixture.state.id,
          id: "ozon-order-1",
          originalAmount: { currencyCode: "643", value: "338700" },
          status: "STATUS_PAID",
        });
      };
      try {
        const service = createOzonNotificationServiceWithStorage(
          fixture,
          () => {
            paidNotifications += 1;
          },
        );

        await service.handleOzonPaymentNotification(
          createSignedOzonNotification("canonical", {
            merchantOrderId: fixture.state.id,
          }),
        );

        assert.equal(requestUrl, "https://ozon.test/v1/getOrderStatus");
        assert.deepEqual(requestBody, {
          accessKey: "test-access",
          extId: fixture.state.id,
          requestSign: crypto
            .createHash("sha256")
            .update(
              `${fixture.state.id}test-accesstest-secret`,
              "utf8",
            )
            .digest("hex"),
        });
        assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
        assert.equal(fixture.activationCount(), 1);
        assert.equal(fixture.analyticsCount(), 1);
        assert.equal(paidNotifications, 1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("uses id-only lookup when signed canonical extOrderID is empty", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      let applied: Record<string, unknown> | undefined;
      let requestBody: Record<string, unknown> | undefined;
      globalThis.fetch = async (_url, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({
          extId: "order-A",
          id: "ozon-order-1",
          originalAmount: { currencyCode: "643", value: "338700" },
          status: "STATUS_PAID",
        });
      };
      try {
        const service = createOzonNotificationService((input) => {
          applied = input;
        });
        const notification = createSignedOzonNotification("canonical", {
          merchantOrderId: "",
        });

        await service.handleOzonPaymentNotification(notification);

        assert.deepEqual(requestBody, {
          accessKey: "test-access",
          id: "ozon-order-1",
          requestSign: crypto
            .createHash("sha256")
            .update("ozon-order-1test-accesstest-secret", "utf8")
            .digest("hex"),
        });
        assert.equal(
          (applied?.verified as { merchantOrderId: string }).merchantOrderId,
          "order-A",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("fails closed when a valid signature is reused after changing only unsigned status", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      try {
        for (const scenario of ["non-paid", "mismatch", "provider-error"] as const) {
          const fixture = createFixture({
            paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
            userId: null,
          });
          let paidNotifications = 0;
          const notification = createSignedOzonNotification("canonical", {
            merchantOrderId: fixture.state.id,
          });
          notification.status = "Pending";
          notification.requestSign = signOzonNotification(
            "canonical",
            notification,
          );
          notification.status = "Completed";
          globalThis.fetch = async () => {
            if (scenario === "provider-error") {
              return jsonResponse({ message: "unavailable" }, 503);
            }
            return jsonResponse({
              extId: fixture.state.id,
              id: scenario === "mismatch" ? "other-order" : "ozon-order-1",
              originalAmount: { currencyCode: "643", value: "338700" },
              status:
                scenario === "non-paid"
                  ? "STATUS_PAYMENT_PENDING"
                  : "STATUS_PAID",
            });
          };
          const service = createOzonNotificationServiceWithStorage(
            fixture,
            () => {
              paidNotifications += 1;
            },
          );

          if (scenario === "non-paid") {
            await service.handleOzonPaymentNotification(notification);
          } else {
            await assert.rejects(
              service.handleOzonPaymentNotification(notification),
            );
          }

          assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PENDING);
          assert.equal(fixture.activationCount(), 0);
          assert.equal(fixture.analyticsCount(), 0);
          assert.equal(paidNotifications, 0);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("rejects a valid secondary signature before fetch and storage", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      let fetches = 0;
      let writes = 0;
      globalThis.fetch = async () => {
        fetches += 1;
        return jsonResponse({});
      };
      try {
        const service = createOzonNotificationService(() => {
          writes += 1;
        });
        const notification = createSignedOzonNotification("secondary", {
          merchantOrderId: "order-A",
        });
        delete notification.orderID;
        delete notification.transactionID;

        await assert.rejects(
          service.handleOzonPaymentNotification(notification),
          /signature is invalid/,
        );

        assert.equal(fetches, 0);
        assert.equal(writes, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("uses authoritative amount and currency instead of raw callback values", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      const fixture = createFixture({
        paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
      });
      globalThis.fetch = async () =>
        jsonResponse({
          extId: fixture.state.id,
          id: "ozon-order-1",
          originalAmount: { currencyCode: "643", value: "338700" },
          status: "STATUS_PAID",
        });
      try {
        const notification = createSignedOzonNotification("canonical", {
          merchantOrderId: fixture.state.id,
        });
        notification.amount = "1";
        notification.currencyCode = "840";
        notification.requestSign = signOzonNotification(
          "canonical",
          notification,
        );

        await createOzonNotificationServiceWithStorage(
          fixture,
          () => undefined,
        ).handleOzonPaymentNotification(notification);

        assert.equal(fixture.state.paymentStatus, OrderPaymentStatus.PAID);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("fails closed for malformed or mismatched authoritative paid data", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      const scenarios: unknown[] = [
        { id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-A", originalAmount: { currencyCode: "643", value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-B", id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "other-order", originalAmount: { currencyCode: "643", value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "643" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "840", value: "338700" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "3387.00" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "338701" }, status: "STATUS_PAID" },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "338700" } },
        { extId: "order-A", id: "ozon-order-1", originalAmount: { currencyCode: "643", value: "338700" }, status: "PAID" },
      ];
      try {
        for (const responseBody of scenarios) {
          const fixture = createFixture({
            id: "order-A",
            paymentMethod: OrderPaymentMethod.OZON_ACQUIRING,
            userId: null,
          });
          let paidNotifications = 0;
          globalThis.fetch = async () => jsonResponse(responseBody);
          const service = createOzonNotificationServiceWithStorage(
            fixture,
            () => {
              paidNotifications += 1;
            },
          );

          await assert.rejects(
            service.handleOzonPaymentNotification(
              createSignedOzonNotification("canonical", {
                merchantOrderId: fixture.state.id,
              }),
            ),
          );
          assert.equal(fixture.updateCount(), 0);
          assert.equal(fixture.consumeCount(), 0);
          assert.equal(fixture.activationCount(), 0);
          assert.equal(fixture.analyticsCount(), 0);
          assert.equal(paidNotifications, 0);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("maps timeout to sanitized 504 and provider/malformed failures to sanitized 502 before storage", async () => {
    await withOzonKeys(async () => {
      const originalFetch = globalThis.fetch;
      const cases = [
        {
          exception: GatewayTimeoutException,
          fetch: async (_url: string | URL | Request, init?: RequestInit) => {
            assert.ok(init?.signal instanceof AbortSignal);
            const error = new Error("secret timeout detail");
            error.name = "TimeoutError";
            throw error;
          },
          status: 504,
        },
        { exception: BadGatewayException, fetch: async () => jsonResponse({ secret: "provider detail" }, 429), status: 502 },
        { exception: BadGatewayException, fetch: async () => jsonResponse({ secret: "provider detail" }, 500), status: 502 },
        { exception: BadGatewayException, fetch: async () => jsonResponse("not-an-object"), status: 502 },
      ];
      try {
        for (const testCase of cases) {
          let writes = 0;
          globalThis.fetch = testCase.fetch;
          const service = createOzonNotificationService(() => {
            writes += 1;
          });

          await assert.rejects(
            service.handleOzonPaymentNotification(
              createSignedOzonNotification("canonical", {
                merchantOrderId: "order-A",
              }),
            ),
            (error: unknown) => {
              assert.ok(error instanceof testCase.exception);
              assert.equal(error.getStatus(), testCase.status);
              assert.doesNotMatch(JSON.stringify(error.getResponse()), /secret|provider detail/i);
              return true;
            },
          );
          assert.equal(writes, 0);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

describe("T-Bank verified terminal notifications", () => {
  it("rejects invalid tokens before storage and forwards every signed terminal status", async () => {
    const previousPassword = process.env.TBANK_ACQUIRING_PASSWORD;
    const previousTerminal = process.env.TBANK_ACQUIRING_TERMINAL_KEY;
    process.env.TBANK_ACQUIRING_PASSWORD = "test-password";
    process.env.TBANK_ACQUIRING_TERMINAL_KEY = "test-terminal";
    try {
      const applied: Array<Record<string, unknown>> = [];
      const service = Object.assign(Object.create(OrdersService.prototype), {
        logger: { warn: () => undefined },
        ordersStorage: {
          applyTBankAcquiringNotification: async (input: Record<string, unknown>) => {
            applied.push(input);
            return undefined;
          },
        },
        tbankAcquiringService: new TBankAcquiringService(),
      }) as OrdersService;
      const invalid = createSignedTBankNotification("CANCELED");
      invalid.Token = "invalid";
      await assert.rejects(
        service.handleTBankPaymentNotification(invalid),
        /token is invalid/,
      );
      assert.equal(applied.length, 0);

      for (const status of ["CANCELED", "DEADLINE_EXPIRED", "REJECTED"]) {
        await service.handleTBankPaymentNotification(
          createSignedTBankNotification(status),
        );
      }

      assert.deepEqual(
        applied.map((notification) => notification.rawStatus),
        ["CANCELED", "DEADLINE_EXPIRED", "REJECTED"],
      );
    } finally {
      if (previousPassword === undefined) {
        delete process.env.TBANK_ACQUIRING_PASSWORD;
      } else {
        process.env.TBANK_ACQUIRING_PASSWORD = previousPassword;
      }
      if (previousTerminal === undefined) {
        delete process.env.TBANK_ACQUIRING_TERMINAL_KEY;
      } else {
        process.env.TBANK_ACQUIRING_TERMINAL_KEY = previousTerminal;
      }
    }
  });
});

function canonicalVerification(orderId: string, transactionId = "9001") {
  void transactionId;
  return {
    profile: "canonical" as const,
    merchantOrderId: orderId,
    acquiringOrderId: "ozon-order-1",
  };
}

function createSignedTBankNotification(status: string) {
  const notification: Record<string, unknown> = {
    Amount: 338_700,
    ErrorCode: "0",
    OrderId: "order-acceptance-1",
    PaymentId: 7001,
    Status: status,
    Success: false,
    TerminalKey: "test-terminal",
  };
  notification.Token = crypto
    .createHash("sha256")
    .update(
      Object.entries({ ...notification, Password: "test-password" })
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => String(value))
        .join(""),
      "utf8",
    )
    .digest("hex");
  return notification;
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

function createOzonNotificationServiceWithStorage(
  fixture: ReturnType<typeof createFixture>,
  onPaidNotification: () => void,
) {
  return Object.assign(Object.create(OrdersService.prototype), {
    logger: { warn: () => undefined },
    ordersStorage: fixture.storage,
    ozonAcquiringService: new OzonAcquiringService(),
    queueOrderPaidNotifications: async () => onPaidNotification(),
  }) as OrdersService;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
  const baseUrl = process.env.OZON_ACQUIRING_BASE_URL;
  const notificationKey = process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY;
  const secretKey = process.env.OZON_ACQUIRING_SECRET_KEY;
  process.env.OZON_ACQUIRING_ACCESS_KEY = "test-access";
  process.env.OZON_ACQUIRING_BASE_URL = "https://ozon.test";
  process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY = "test-notification";
  process.env.OZON_ACQUIRING_SECRET_KEY = "test-secret";
  try {
    await run();
  } finally {
    if (accessKey === undefined) delete process.env.OZON_ACQUIRING_ACCESS_KEY;
    else process.env.OZON_ACQUIRING_ACCESS_KEY = accessKey;
    if (baseUrl === undefined) delete process.env.OZON_ACQUIRING_BASE_URL;
    else process.env.OZON_ACQUIRING_BASE_URL = baseUrl;
    if (notificationKey === undefined) {
      delete process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY;
    } else {
      process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY = notificationKey;
    }
    if (secretKey === undefined) delete process.env.OZON_ACQUIRING_SECRET_KEY;
    else process.env.OZON_ACQUIRING_SECRET_KEY = secretKey;
  }
}

function createFixture(
  overrides: Partial<ReturnType<typeof createOrderState>> = {},
  options: {
    cartItems?: Map<string, number>;
    cartLock?: ReturnType<typeof createTestMutex>;
  } = {},
) {
  const state = Object.assign(createOrderState(), overrides);
  const history: Array<{ eventType: string; payload: unknown }> = [];
  const cartItems = options.cartItems ?? new Map<string, number>();
  let updates = 0;
  let consumes = 0;
  let releases = 0;
  let activations = 0;
  let analytics = 0;
  let analyticsShouldFail = false;
  let releaseCartLock: (() => void) | undefined;
  const tx = {
    $queryRaw: async (query: {
      strings?: readonly string[];
      values?: readonly unknown[];
    }) => {
      const sql = query.strings?.join("") ?? "";
      if (
        options.cartLock &&
        sql.includes('FROM "carts"') &&
        sql.includes("FOR UPDATE") &&
        query.values?.includes(state.cartId)
      ) {
        releaseCartLock = await options.cartLock.acquire();
      }
      return [];
    },
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
    cart: {
      upsert: async () => ({ id: state.cartId }),
      update: async () => ({ id: state.cartId }),
    },
    cartItem: {
      findUnique: async ({ where }: { where: { cartId_productId: { productId: string } } }) => {
        const quantity = cartItems.get(where.cartId_productId.productId);
        return quantity === undefined ? null : { quantity };
      },
      upsert: async ({ create, update }: { create: { productId: string; quantity: number }; update: { quantity: number } }) => {
        const productId = create.productId;
        cartItems.set(productId, cartItems.has(productId) ? update.quantity : create.quantity);
      },
      deleteMany: async ({ where }: { where: { productId: string } }) => {
        cartItems.delete(where.productId);
      },
      update: async ({ where, data }: { where: { cartId_productId: { productId: string } }; data: { quantity: number } }) => {
        cartItems.set(where.cartId_productId.productId, data.quantity);
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => unknown) => {
      const snapshot = { ...state };
      const historyLength = history.length;
      try {
        return await callback(tx);
      } catch (error) {
        for (const key of Object.keys(state)) delete (state as Record<string, unknown>)[key];
        Object.assign(state, snapshot);
        history.length = historyLength;
        throw error;
      } finally {
        releaseCartLock?.();
        releaseCartLock = undefined;
      }
    },
    user: {
      findUnique: async () => ({ id: "admin-1" }),
    },
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
  const orderActivationService = {
    attachPaidGuestOrderInTransaction: async () => {
      activations += 1;
      state.userId = "activated-user";
      return state.userId;
    },
  };
  const analyticsOutboxService = {
    enqueueOrderPaid: async (writer: unknown) => {
      assert.equal(writer, tx);
      if (analyticsShouldFail) throw new Error("analytics enqueue failed");
      analytics += 1;
    },
  };
  const storage = new OrdersStorage(
    prisma,
    promos,
    orderActivationService as unknown as OrderActivationService,
    analyticsOutboxService as unknown as AnalyticsOutboxService,
  );
  (
    storage as unknown as { mapAdminOrder: (value: unknown) => unknown }
  ).mapAdminOrder = (value) => value;
  return {
    state,
    history,
    cartItems,
    storage,
    analyticsCount: () => analytics,
    rejectAnalytics: () => {
      analyticsShouldFail = true;
    },
    activationCount: () => activations,
    consumeCount: () => consumes,
    releaseCount: () => releases,
    updateCount: () => updates,
  };
}

function createTestMutex() {
  let tail = Promise.resolve();

  return {
    async acquire() {
      const previous = tail;
      let release: () => void = () => {};
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      return release;
    },
  };
}

function createOrderState() {
  return {
    id: "order-acceptance-1",
    userId: "user-1" as string | null,
    cartId: "cart-1",
    checkoutAttemptId: "attempt-1" as string | null,
    status: OrderStatus.PENDING_PAYMENT as OrderStatus,
    crmStatus: OrderCrmStatus.WAITING_PAYMENT as OrderCrmStatus,
    customerName: "Buyer",
    customerPhone: "+79990000000",
    customerEmail: "buyer@example.com",
    yandexClientId: "123456",
    yandexYclid: "987654",
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
    terminalPaymentFailedAt: null as Date | null,
    cartConsumedAt: null as Date | null,
    cartConsumedQuantities: null as Record<string, number> | null,
    cartRestoredAt: null as Date | null,
    cartRestoredQuantities: null as Record<string, number> | null,
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

async function consumeOrderCartSnapshot(
  fixture: ReturnType<typeof createFixture>,
) {
  const consume = (
    fixture.storage as unknown as {
      consumeOrderCartSnapshot?: (orderId: string) => Promise<unknown>;
    }
  ).consumeOrderCartSnapshot;
  assert.ok(consume, "OrdersStorage.consumeOrderCartSnapshot must exist");
  await consume.call(fixture.storage, fixture.state.id);
}
