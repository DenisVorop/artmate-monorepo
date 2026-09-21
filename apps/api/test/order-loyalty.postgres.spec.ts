import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { OrdersLoyaltyService } from "../src/orders/orders-loyalty.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import { PaymentRecoveryService } from "../src/orders/payment-recovery/payment-recovery.service";
import {
  createOrderPricingSnapshot,
  parseOrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";
import type { PrismaService } from "../src/prisma/prisma.service";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import { PromocodesService } from "../src/promocodes/promocodes.service";

// Opt-in isolated local database only; never inherit runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "order loyalty PostgreSQL transactions",
  {
    skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set",
  },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();
    const occurredAt = new Date("2026-09-20T12:00:00.000Z");

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.match(url.pathname, /^\/artmate_loyalty_test[a-z0-9_]*$/);
      assert.equal(url.search, "");
      first = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.toString() }),
      });
      second = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.toString() }),
      });
      await Promise.all([first.$connect(), second.$connect()]);
    });

    after(async () => {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
    });

    function services(
      client: PrismaClient,
      enqueueOrderCreated: (
        tx: Prisma.TransactionClient,
        order: { id: string },
      ) => Promise<void> = async () => {},
      realPromos = false,
      enqueueOrderPaid: (
        tx: Prisma.TransactionClient,
        order: { id: string },
      ) => Promise<void> = async () => {},
    ) {
      const coordinator = new OrdersLoyaltyService(
        client as unknown as PrismaService,
        wallet,
      );
      const unexpected = async () => {
        throw new Error("Unexpected unrelated checkout dependency");
      };
      const promos = new PromocodesService(client as unknown as PrismaService);
      const storage = new OrdersStorage(
        client as unknown as PrismaService,
        realPromos
          ? promos
          : ({
              getAffiliateOwnerUserId: unexpected,
              reserveInTransaction: unexpected,
              releaseInTransaction: async () => undefined,
              consumeInTransaction: async () => ({
                changed: false,
                usedAfterRelease: false,
              }),
            } as unknown as ConstructorParameters<typeof OrdersStorage>[1]),
        {
          attachGuestOrderInTransaction: unexpected,
        } as unknown as ConstructorParameters<typeof OrdersStorage>[2],
        {
          enqueueOrderCreated,
          enqueueOrderPaid,
        } as unknown as ConstructorParameters<typeof OrdersStorage>[3],
        {
          recordPaidOrderInTransaction: async () => undefined,
        } as unknown as ConstructorParameters<typeof OrdersStorage>[4],
        coordinator,
      );
      const consumer = new LoyaltyPaymentSettlementService(
        client as unknown as PrismaService,
        wallet,
      );
      return { coordinator, storage, promos, consumer };
    }

    async function fixture(points = 70, realPromos = false) {
      const user = await first.user.create({ data: {} });
      const member = await first.loyaltyMember.create({
        data: {
          userId: user.id,
          termsVersion: "loyalty-v1",
          historyState: "READY",
          wallet: { create: {} },
        },
      });
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, {
          memberId: member.id,
          points: 100,
          operationKey: `test:credit:${randomUUID()}`,
          sourceKey: `test:seed:${member.id}`,
          rulesVersion: "test-v1",
          occurredAt,
        }),
      );
      const product = await first.product.create({
        data: {
          slug: `loyalty-${randomUUID()}`,
          title: "Loyalty transaction test",
          price: 10_000,
          status: "PUBLISHED",
        },
      });
      const promo = realPromos
        ? await first.promoCode.create({
            data: {
              code: `TEST${randomUUID().replaceAll("-", "").toUpperCase()}`,
              name: "Order loyalty transaction test",
              type: "FIXED",
              amountKopecks: 1_000n,
              basisPoints: null,
              maxDiscountKopecks: null,
              minSubtotalKopecks: 0n,
              maxUses: null,
              maxUsesPerUser: null,
              startsAt: null,
              endsAt: null,
            },
          })
        : undefined;
      const promoPricing = calculatePromoPricing(
        [{ id: product.id, unitPriceKopecks: product.price, quantity: 2 }],
        { type: "fixed", amountKopecks: realPromos ? 1_000 : 0 },
      );
      const snapshot = createOrderPricingSnapshot(promoPricing, 499);
      const service = services(first, undefined, realPromos);
      const preview = await service.coordinator.preview({
        userId: user.id,
        snapshot,
        points,
      });
      const input: Parameters<OrdersStorage["createOrder"]>[0] = {
        userId: user.id,
        cartId: randomUUID(),
        checkoutAttemptId: randomUUID(),
        checkoutPayloadFingerprint: "a".repeat(64),
        customer: {
          name: "Анна Иванова",
          email: "qa@example.test",
          phone: "+7 (999) 000-00-00",
        },
        delivery: {
          provider: "ozon",
          pickupPoint: {
            id: "test-point",
            title: "Test point",
            address: "Test address",
            workHours: "09:00-21:00",
            deliveryPrice: 4.99,
          },
        },
        items: [
          {
            id: product.id,
            title: product.title,
            slug: product.slug,
            price: product.price / 100,
            quantity: 2,
            lineTotal: (product.price / 100) * 2,
            image: "/test.jpg",
          },
        ],
        itemsCount: 2,
        paymentMethod: "tbank_acquiring",
        subtotal: 200,
        promoCode: promo?.code,
        loyaltyPointsToSpend: points,
        loyaltyPricingRevision: preview.loyalty.pricingRevision,
      };
      await first.cart.create({
        data: {
          id: input.cartId,
          items: {
            create: input.items.map((item) => ({
              productId: item.id,
              title: item.title,
              slug: item.slug,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
            })),
          },
        },
      });
      return { ...service, input, member, preview, promo, promoPricing };
    }

    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });
    const operations = (memberId: string) =>
      first.loyaltyOperation.findMany({
        where: { memberId },
        orderBy: { sequence: "asc" },
      });
    const reservation = (orderId: string) =>
      first.loyaltyReservation.findUniqueOrThrow({ where: { orderId } });

    async function markClosed(orderId: string) {
      // Explicit fake provider evidence for this storage-only integration suite.
      // Signature and provider query verification are covered in pipeline unit tests.
      const paymentId = "test-payment-1";
      const order = await first.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "FAILED",
          terminalPaymentFailedAt: occurredAt,
          tbankAcquiringPaymentId: paymentId,
        },
      });
      return {
        orderId,
        paymentId,
        amountKopecks: parseOrderPricingSnapshot(order.pricingSnapshot)
          .totalKopecks,
      };
    }

    async function publishPaid(storage: OrdersStorage, orderId: string) {
      const order = await first.order.update({
        where: { id: orderId },
        data: { tbankAcquiringPaymentId: "test-payment-1" },
      });
      await storage.applyTBankAcquiringNotification({
        orderId,
        paymentId: "test-payment-1",
        amount: String(
          parseOrderPricingSnapshot(order.pricingSnapshot).totalKopecks,
        ),
        raw: {},
        rawStatus: "CONFIRMED",
        status: "paid",
        success: true,
      });
      return first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId, kind: "PAID" } },
      });
    }

    it("persists net order pricing and reserves its exact points atomically", async () => {
      const f = await fixture();
      const result = await f.storage.createOrder(f.input);
      const row = await first.order.findUniqueOrThrow({
        where: { id: result.id },
        include: { items: true },
      });
      assert.deepEqual(
        parseOrderPricingSnapshot(row.pricingSnapshot),
        f.preview.snapshot,
      );
      assert.equal(row.subtotal.toString(), "200");
      assert.equal(row.discount.toString(), "14");
      assert.equal(row.total.toString(), "190.99");
      assert.equal(row.items[0]!.lineTotal.toString(), "200");
      assert.equal(row.checkoutActorUserId, f.member.userId);
      assert.equal((await reservation(row.id)).points, 70n);
      assert.equal((await reservation(row.id)).status, "RESERVED");
      const w = await balance(f.member.id);
      assert.equal(w.balancePoints, 100n);
      assert.equal(w.reservedPoints, 70n);
      assert.equal(w.revision, 2n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE"],
      );
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: row.id } }),
        0,
      );
    });

    for (const points of [0, 70]) {
      it(`finalizes ${points === 0 ? "ordinary promo-only" : "mixed promo and loyalty"} pricing without mutating the promo audit and freezes final money`, async () => {
        const f = await fixture(points, true);
        const order = await f.storage.createOrder(f.input);
        const persisted = await first.order.findUniqueOrThrow({
          where: { id: order.id },
        });
        const pricing = parseOrderPricingSnapshot(persisted.pricingSnapshot);
        assert.equal(pricing.promoDiscountKopecks, 1_000);
        assert.equal(pricing.loyaltyDiscountKopecks, points * 20);
        assert.equal(pricing.discountKopecks, 1_000 + points * 20);
        assert.equal(pricing.totalKopecks, 19_499 - points * 20);
        assert.equal(persisted.discount.toString(), String(10 + points / 5));
        assert.equal(
          persisted.total.toString(),
          points === 0 ? "194.99" : "180.99",
        );
        assert.deepEqual(pricing, f.preview.snapshot);
        assert.deepEqual(persisted.promoPricingSnapshot, f.promoPricing);
        const redemptionBefore = await first.promoRedemption.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(redemptionBefore.status, "RESERVED");
        assert.equal(redemptionBefore.subtotalKopecksSnapshot, 20_000n);
        assert.equal(redemptionBefore.discountKopecksSnapshot, 1_000n);
        assert.equal(redemptionBefore.totalKopecksSnapshot, 19_000n);
        assert.deepEqual(redemptionBefore.pricingSnapshot, f.promoPricing);
        const promoBefore = await first.promoCode.findUniqueOrThrow({
          where: { id: f.promo!.id },
        });
        assert.equal(promoBefore.reservedCount, 1);
        assert.equal(promoBefore.usedCount, 0);
        assert.equal(
          await first.loyaltyReservation.count({
            where: { orderId: order.id },
          }),
          points > 0 ? 1 : 0,
        );

        // Once final pricing exists, money is immutable even before payment.
        await assert.rejects(
          first.order.update({
            where: { id: order.id },
            data: { discount: 0 },
          }),
          /Finalized order amounts are immutable/,
        );
        await assert.rejects(
          first.order.update({ where: { id: order.id }, data: { total: 1 } }),
          /Finalized order amounts are immutable/,
        );

        const event = await publishPaid(f.storage, order.id);
        await publishPaid(services(second, undefined, true).storage, order.id);
        assert.equal(
          await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
          1,
        );
        assert.equal((await balance(f.member.id)).balancePoints, 100n);
        assert.equal(
          (await balance(f.member.id)).reservedPoints,
          BigInt(points),
        );
        await f.consumer.processEvent(event.id);
        await services(second).consumer.processEvent(event.id);

        const paid = await first.order.findUniqueOrThrow({
          where: { id: order.id },
        });
        assert.equal(paid.paymentStatus, "PAID");
        assert.equal(paid.discount.toString(), persisted.discount.toString());
        assert.equal(paid.total.toString(), persisted.total.toString());
        assert.deepEqual(paid.pricingSnapshot, persisted.pricingSnapshot);
        assert.deepEqual(paid.promoPricingSnapshot, f.promoPricing);
        const redemptionAfter = await first.promoRedemption.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(redemptionAfter.status, "USED");
        assert.deepEqual(
          redemptionAfter.pricingSnapshot,
          redemptionBefore.pricingSnapshot,
        );
        assert.equal(redemptionAfter.discountKopecksSnapshot, 1_000n);
        const promoAfter = await first.promoCode.findUniqueOrThrow({
          where: { id: f.promo!.id },
        });
        assert.equal(promoAfter.reservedCount, 0);
        assert.equal(promoAfter.usedCount, 1);
        assert.equal(
          (await balance(f.member.id)).balancePoints,
          BigInt(100 - points),
        );
        assert.equal((await balance(f.member.id)).reservedPoints, 0n);
        assert.deepEqual(
          (await operations(f.member.id)).map((operation) => operation.kind),
          points > 0 ? ["CREDIT", "RESERVE", "CONSUME"] : ["CREDIT"],
        );
        if (points > 0)
          assert.equal((await reservation(order.id)).status, "CONSUMED");

        await assert.rejects(
          first.order.update({
            where: { id: order.id },
            data: { discount: 0 },
          }),
          /Finalized order amounts are immutable/,
        );
        await assert.rejects(
          first.order.update({ where: { id: order.id }, data: { total: 1 } }),
          /Finalized order amounts are immutable/,
        );
        const unchanged = await first.order.findUniqueOrThrow({
          where: { id: order.id },
        });
        assert.equal(
          unchanged.discount.toString(),
          persisted.discount.toString(),
        );
        assert.equal(unchanged.total.toString(), persisted.total.toString());
      });
    }

    it("prevents overspending across concurrent real order transactions", async () => {
      const f = await fixture();
      const other = services(second);
      const secondInput = {
        ...f.input,
        cartId: randomUUID(),
        checkoutAttemptId: randomUUID(),
      };
      const results = await Promise.allSettled([
        f.storage.createOrder(f.input),
        other.storage.createOrder(secondInput),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((result) => result.status === "rejected").length,
        1,
      );
      assert.equal(
        await first.order.count({
          where: { checkoutActorUserId: f.member.userId },
        }),
        1,
      );
      assert.equal(
        await first.loyaltyReservation.count({
          where: { memberId: f.member.id },
        }),
        1,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE"],
      );
    });

    it("replays concurrent checkout attempts without a second order or hold", async () => {
      const f = await fixture();
      const other = services(second);
      const [a, b] = await Promise.all([
        f.storage.createOrder(f.input),
        other.storage.createOrder(f.input),
      ]);
      assert.equal(a.id, b.id);
      assert.equal((await f.storage.createOrder(f.input)).id, a.id);
      assert.equal(
        await first.order.count({
          where: { checkoutAttemptId: f.input.checkoutAttemptId },
        }),
        1,
      );
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      assert.equal((await balance(f.member.id)).revision, 2n);
      assert.equal(
        (await operations(f.member.id)).filter((op) => op.kind === "RESERVE")
          .length,
        1,
      );
    });

    it("rolls back order, history and hold when the pricing revision is stale", async () => {
      const f = await fixture();
      await assert.rejects(
        f.storage.createOrder({
          ...f.input,
          loyaltyPricingRevision: "0".repeat(64),
        }),
      );
      assert.equal(
        await first.order.count({
          where: { checkoutAttemptId: f.input.checkoutAttemptId },
        }),
        0,
      );
      assert.equal(
        await first.orderHistory.count({
          where: { authorId: f.member.userId },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyReservation.count({
          where: { memberId: f.member.id },
        }),
        0,
      );
      const w = await balance(f.member.id);
      assert.equal(w.reservedPoints, 0n);
      assert.equal(w.balancePoints, 100n);
      assert.equal(w.revision, 1n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT"],
      );
    });

    it("rolls back a completed reserve when later order analytics fails", async () => {
      const f = await fixture();
      let reachedAfterReserve = false;
      const failing = services(first, async (tx, order) => {
        const hold = await tx.loyaltyReservation.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(hold.points, 70n);
        assert.equal(
          (
            await tx.loyaltyWallet.findUniqueOrThrow({
              where: { memberId: f.member.id },
            })
          ).reservedPoints,
          70n,
        );
        reachedAfterReserve = true;
        throw new Error("analytics rollback test");
      });
      await assert.rejects(
        failing.storage.createOrder(f.input),
        /analytics rollback test/,
      );
      assert.equal(reachedAfterReserve, true);
      assert.equal(
        await first.order.count({
          where: { checkoutAttemptId: f.input.checkoutAttemptId },
        }),
        0,
      );
      assert.equal(
        await first.orderHistory.count({
          where: { authorId: f.member.userId },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyReservation.count({
          where: { memberId: f.member.id },
        }),
        0,
      );
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 1n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT"],
      );
    });

    it("keeps PAID and its outbox event durable when loyalty processing fails, then retries exactly once", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const event = await publishPaid(f.storage, order.id);
      const duplicate = await publishPaid(services(second).storage, order.id);
      assert.equal(duplicate.id, event.id);
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      const failingWallet = new LoyaltyWalletService();
      failingWallet.consumeInTransaction = async (tx, command) => {
        await wallet.consumeInTransaction(tx, command);
        throw new Error("consumer rollback test");
      };
      const failedConsumer = new LoyaltyPaymentSettlementService(
        first as unknown as PrismaService,
        failingWallet,
      );
      await assert.rejects(
        failedConsumer.processEvent(event.id),
        /consumer rollback test/,
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.notEqual(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paidAt,
        null,
      );
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      const failedReceipt = await first.loyaltyPaymentReceipt.findUniqueOrThrow(
        { where: { eventId: event.id } },
      );
      assert.equal(failedReceipt.processedAt, null);
      assert.equal(failedReceipt.attempts, 1);
      assert.equal(failedReceipt.lastError, "settlement_failed");
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      assert.equal((await balance(f.member.id)).revision, 2n);
      assert.deepEqual(await f.consumer.processEvent(event.id), {
        processed: true,
        replayed: false,
      });
      assert.deepEqual(await services(second).consumer.processEvent(event.id), {
        processed: true,
        replayed: true,
      });
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "CONSUME"],
      );
    });

    it("publishes closed-unpaid only with verified identity and amount, then releases through its consumer", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      await assert.rejects(
        f.storage.confirmTBankClosedUnpaid({
          orderId: order.id,
          paymentId: "test-payment-1",
          amountKopecks: f.preview.snapshot.totalKopecks,
        }),
      );
      const evidence = await markClosed(order.id);
      await assert.rejects(
        f.storage.confirmTBankClosedUnpaid({
          ...evidence,
          paymentId: "wrong-payment",
        }),
      );
      await assert.rejects(
        f.storage.confirmTBankClosedUnpaid({
          ...evidence,
          amountKopecks: evidence.amountKopecks + 1,
        }),
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      await f.storage.confirmTBankClosedUnpaid(evidence);
      await services(second).storage.confirmTBankClosedUnpaid(evidence);
      const closedOrder = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(closedOrder.paymentStatus, "CLOSED_UNPAID");
      assert.ok(closedOrder.paymentClosedUnpaidAt);
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
      });
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      await f.consumer.processEvent(event.id);
      await services(second).consumer.processEvent(event.id);
      assert.equal((await reservation(order.id)).status, "RELEASED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "RELEASE"],
      );
    });

    it("persists late PAID after a released hold and retries the consumer without rolling payment back", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const evidence = await markClosed(order.id);
      await f.storage.confirmTBankClosedUnpaid(evidence);
      const closedEvent = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
      });
      await f.consumer.processEvent(closedEvent.id);
      assert.equal((await reservation(order.id)).status, "RELEASED");
      const paidEvent = await publishPaid(f.storage, order.id);
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      await assert.rejects(f.consumer.processEvent(paidEvent.id));
      await assert.rejects(
        services(second).consumer.processEvent(paidEvent.id),
      );
      assert.equal((await publishPaid(f.storage, order.id)).id, paidEvent.id);
      const paid = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(paid.paymentStatus, "PAID");
      assert.ok(paid.paidAt);
      assert.ok(paid.paymentClosedUnpaidAt);
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        2,
      );
      assert.equal((await reservation(order.id)).status, "RELEASED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.deepEqual(
        (await operations(f.member.id)).map((operation) => operation.kind),
        ["CREDIT", "RESERVE", "RELEASE"],
      );
      const receipt = await first.loyaltyPaymentReceipt.findUniqueOrThrow({
        where: { eventId: paidEvent.id },
      });
      assert.equal(receipt.processedAt, null);
      assert.equal(receipt.attempts, 2);
      assert.equal(receipt.lastError, "settlement_failed");
    });

    it("publishes Ozon authoritative PAID through the same outbox and consumes once", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder({
        ...f.input,
        paymentMethod: "ozon_acquiring",
      });
      // Storage boundary receives already verified identity and authoritative lookup.
      // The signature and remote lookup are intentionally outside this PostgreSQL test.
      const notification = {
        acquiringOrderId: "test-ozon-order",
        amount: String(f.preview.snapshot.totalKopecks),
        currencyCode: "643",
        authoritativeStatus: "STATUS_PAID",
        raw: {},
        verified: {
          profile: "canonical" as const,
          merchantOrderId: order.id,
          acquiringOrderId: "test-ozon-order",
        },
      };
      assert.equal(
        (await f.storage.applyOzonAcquiringNotification(notification))
          ?.paymentStatusChangedToPaid,
        true,
      );
      assert.equal(
        (
          await services(second).storage.applyOzonAcquiringNotification(
            notification,
          )
        )?.paymentStatusChangedToPaid,
        false,
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "PAID" } },
      });
      await f.consumer.processEvent(event.id);
      await services(second).consumer.processEvent(event.id);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal(
        await first.cartItem.count({ where: { cartId: f.input.cartId } }),
        0,
      );
      assert.deepEqual(
        (await operations(f.member.id)).map((operation) => operation.kind),
        ["CREDIT", "RESERVE", "CONSUME"],
      );
    });

    it("rechecks PAID under the lock before closed-unpaid publication and never releases its reservation", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const evidence = await markClosed(order.id);
      const paidAndLocked = deferred();
      const commitPaid = deferred();
      const gated = services(first, undefined, false, async () => {
        paidAndLocked.resolve();
        await commitPaid.promise;
      });
      const payment = publishPaid(gated.storage, order.id);
      try {
        await Promise.race([paidAndLocked.promise, payment]);
        const close =
          services(second).storage.confirmTBankClosedUnpaid(evidence);
        commitPaid.resolve();
        await Promise.all([payment, close]);
      } finally {
        commitPaid.resolve();
      }
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.equal(
        await first.orderPaymentEvent.count({
          where: { orderId: order.id, kind: "CLOSED_UNPAID" },
        }),
        0,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      const event = await payment;
      await f.consumer.processEvent(event.id);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "CONSUME"],
      );
    });

    it("atomically grants one Init permission and one durable recovery job to competing checkout requests", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const other = services(second).storage;
      const claims = await Promise.all([
        f.storage.claimPaymentInitialization(order.id),
        other.claimPaymentInitialization(order.id),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      assert.equal(
        await first.orderPaymentRecovery.count({
          where: { orderId: order.id },
        }),
        1,
      );
      const source = await f.storage.getPaymentReconciliationSource(order.id);
      assert.ok(source);
      assert.equal(source?.paymentRecovery?.orderId, order.id);
      assert.equal(source.tbankAcquiringPaymentId, null);
      const row = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.match(
        row.paymentRedirectUrl,
        /^\/checkout\/payment-initializing\?startedAt=/,
      );
      await first.order.update({
        where: { id: order.id },
        data: { paymentStatus: "FAILED" },
      });
      assert.equal(await other.claimPaymentInitialization(order.id), false);
      assert.equal(
        await first.orderPaymentRecovery.count({
          where: { orderId: order.id },
        }),
        1,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
    });

    it("rolls the Init marker back when durable recovery enqueue fails", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const beforeClaim = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      const faulted = {
        $transaction: (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) =>
          first.$transaction((tx) =>
            callback(
              new Proxy(tx, {
                get(target, property, receiver) {
                  if (property === "orderPaymentRecovery")
                    return new Proxy(target.orderPaymentRecovery, {
                      get(delegate, operation, delegateReceiver) {
                        if (operation === "create")
                          return async () => {
                            throw new Error("recovery enqueue failed");
                          };
                        return Reflect.get(
                          delegate,
                          operation,
                          delegateReceiver,
                        );
                      },
                    });
                  return Reflect.get(target, property, receiver);
                },
              }),
            ),
          ),
      } as unknown as PrismaClient;
      await assert.rejects(
        services(faulted).storage.claimPaymentInitialization(order.id),
        /recovery enqueue failed/,
      );
      const afterClaim = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(
        afterClaim.paymentRedirectUrl,
        beforeClaim.paymentRedirectUrl,
      );
      assert.equal(afterClaim.paymentStatus, beforeClaim.paymentStatus);
      assert.equal(
        await first.orderPaymentRecovery.count({
          where: { orderId: order.id },
        }),
        0,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal(await f.storage.claimPaymentInitialization(order.id), true);
    });

    it("recovers PAID with a previously unknown PaymentId through the common paid publisher exactly once", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      assert.equal(await f.storage.claimPaymentInitialization(order.id), true);
      const before = await f.storage.getPaymentReconciliationSource(order.id);
      assert.equal(before?.tbankAcquiringPaymentId, null);
      let paidOutboxCalls = 0;
      const publisher = services(first, undefined, false, async () => {
        paidOutboxCalls += 1;
      }).storage;
      const evidence = {
        orderId: order.id,
        method: "TBANK_ACQUIRING" as const,
        providerOrderId: order.id,
        paymentId: `recovered-${randomUUID().slice(0, 8)}`,
        amountKopecks: f.preview.snapshot.totalKopecks,
        state: "paid" as const,
      };
      const paid = await publisher.applyPaymentReconciliation(evidence);
      assert.equal(paid.paymentStatusChangedToPaid, true);
      const row = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(row.paymentStatus, "PAID");
      assert.ok(row.paidAt);
      assert.ok(row.cartConsumedAt);
      assert.equal(row.tbankAcquiringPaymentId, evidence.paymentId);
      assert.equal(row.tbankAcquiringOrderId, order.id);
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "PAID" } },
      });
      assert.equal(event.occurredAt.getTime(), row.paidAt.getTime());
      // Publication does not synchronously mutate the loyalty wallet.
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal(
        (await publisher.applyPaymentReconciliation(evidence))
          .paymentStatusChangedToPaid,
        false,
      );
      assert.equal(paidOutboxCalls, 1);
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      await Promise.all([
        f.consumer.processEvent(event.id),
        services(second).consumer.processEvent(event.id),
      ]);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal(
        (await operations(f.member.id)).filter(
          (operation) => operation.kind === "CONSUME",
        ).length,
        1,
      );
      await publisher.applyPaymentReconciliation({
        ...evidence,
        state: "pending",
      });
      await publisher.applyPaymentReconciliation({
        ...evidence,
        state: "closed_unpaid",
      });
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.equal(
        await first.orderPaymentEvent.count({
          where: { orderId: order.id, kind: "CLOSED_UNPAID" },
        }),
        0,
      );
    });

    it("publishes verified closed recovery once and releases only through its durable consumer", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      await f.storage.claimPaymentInitialization(order.id);
      const evidence = {
        orderId: order.id,
        method: "TBANK_ACQUIRING" as const,
        providerOrderId: order.id,
        paymentId: "recovered-closed",
        amountKopecks: f.preview.snapshot.totalKopecks,
        state: "closed_unpaid" as const,
      };
      await f.storage.applyPaymentReconciliation(evidence);
      await services(second).storage.applyPaymentReconciliation(evidence);
      const row = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(row.paymentStatus, "CLOSED_UNPAID");
      assert.ok(row.paymentClosedUnpaidAt);
      assert.ok(row.terminalPaymentFailedAt);
      assert.equal(row.paidAt, null);
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        1,
      );
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
      });
      assert.equal(
        event.occurredAt.getTime(),
        row.paymentClosedUnpaidAt.getTime(),
      );
      await Promise.all([
        f.consumer.processEvent(event.id),
        services(second).consumer.processEvent(event.id),
      ]);
      assert.equal((await reservation(order.id)).status, "RELEASED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal(
        (await operations(f.member.id)).filter(
          (operation) => operation.kind === "RELEASE",
        ).length,
        1,
      );
      await f.storage.applyPaymentReconciliation({
        ...evidence,
        state: "pending",
      });
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "CLOSED_UNPAID",
      );
      assert.equal(await f.storage.claimPaymentInitialization(order.id), false);
    });

    it("releases a real promo reservation exactly once on verified closure recovery without a webhook", async () => {
      const f = await fixture(70, true);
      assert.ok(f.promo);
      const order = await f.storage.createOrder(f.input);
      await f.storage.claimPaymentInitialization(order.id);
      const reservedPromo = await first.promoRedemption.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      assert.equal(reservedPromo.status, "RESERVED");
      assert.equal(
        (await first.promoCode.findUniqueOrThrow({ where: { id: f.promo.id } }))
          .reservedCount,
        1,
      );
      const evidence = {
        orderId: order.id,
        method: "TBANK_ACQUIRING" as const,
        providerOrderId: order.id,
        paymentId: "closed-real-promo",
        amountKopecks: f.preview.snapshot.totalKopecks,
        state: "closed_unpaid" as const,
      };
      await Promise.all([
        f.storage.applyPaymentReconciliation(evidence),
        services(second, undefined, true).storage.applyPaymentReconciliation(
          evidence,
        ),
      ]);
      const releasedPromo = await first.promoRedemption.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      assert.equal(releasedPromo.status, "RELEASED");
      assert.ok(releasedPromo.releasedAt);
      assert.equal(releasedPromo.usedAt, null);
      const code = await first.promoCode.findUniqueOrThrow({
        where: { id: f.promo.id },
      });
      assert.equal(code.reservedCount, 0);
      assert.equal(code.usedCount, 0);
      const releaseHistory = await first.orderHistory.findMany({
        where: { orderId: order.id, eventType: "promo_reservation_released" },
      });
      assert.equal(releaseHistory.length, 1);
      assert.equal(
        (releaseHistory[0]!.payload as { source?: string }).source,
        "payment_reconciliation",
      );
      assert.equal(
        await first.orderPaymentEvent.count({
          where: { orderId: order.id, kind: "CLOSED_UNPAID" },
        }),
        1,
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .lastPaymentNotification,
        null,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
      });
      await f.consumer.processEvent(event.id);
      assert.equal((await reservation(order.id)).status, "RELEASED");
    });

    it("does not release a real promo when PAID wins the order lock before closure recovery", async () => {
      const f = await fixture(70, true);
      assert.ok(f.promo);
      const order = await f.storage.createOrder(f.input);
      await f.storage.claimPaymentInitialization(order.id);
      const evidence = {
        orderId: order.id,
        method: "TBANK_ACQUIRING" as const,
        providerOrderId: order.id,
        paymentId: "paid-real-promo",
        amountKopecks: f.preview.snapshot.totalKopecks,
      };
      const paidAndLocked = deferred();
      const commitPaid = deferred();
      const publisher = services(first, undefined, true, async () => {
        paidAndLocked.resolve();
        await commitPaid.promise;
      }).storage;
      const paid = publisher.applyPaymentReconciliation({
        ...evidence,
        state: "paid",
      });
      try {
        await Promise.race([paidAndLocked.promise, paid]);
        const closed = services(
          second,
          undefined,
          true,
        ).storage.applyPaymentReconciliation({
          ...evidence,
          state: "closed_unpaid",
        });
        commitPaid.resolve();
        await Promise.all([paid, closed]);
      } finally {
        commitPaid.resolve();
      }
      const redemption = await first.promoRedemption.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      assert.equal(redemption.status, "USED");
      assert.ok(redemption.usedAt);
      assert.equal(redemption.releasedAt, null);
      const code = await first.promoCode.findUniqueOrThrow({
        where: { id: f.promo.id },
      });
      assert.equal(code.reservedCount, 0);
      assert.equal(code.usedCount, 1);
      assert.equal(
        await first.orderHistory.count({
          where: { orderId: order.id, eventType: "promo_reservation_released" },
        }),
        0,
      );
      assert.equal(
        await first.orderPaymentEvent.count({
          where: { orderId: order.id, kind: "CLOSED_UNPAID" },
        }),
        0,
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      const event = await first.orderPaymentEvent.findUniqueOrThrow({
        where: { orderId_kind: { orderId: order.id, kind: "PAID" } },
      });
      await f.consumer.processEvent(event.id);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
    });

    it("rejects missing recovery source and mismatched provider, amount or recovered identities", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const evidence = {
        orderId: order.id,
        method: "TBANK_ACQUIRING" as const,
        providerOrderId: order.id,
        paymentId: "recovery-identity",
        amountKopecks: f.preview.snapshot.totalKopecks,
        state: "pending" as const,
      };
      await assert.rejects(
        f.storage.applyPaymentReconciliation(evidence),
        /source mismatch/,
      );
      await f.storage.claimPaymentInitialization(order.id);
      await f.storage.applyPaymentReconciliation(evidence);
      for (const mismatch of [
        { method: "OZON_ACQUIRING" as const },
        { providerOrderId: "different-order" },
        { paymentId: "different-payment" },
        { paymentId: undefined },
        { amountKopecks: evidence.amountKopecks + 1 },
      ]) {
        await assert.rejects(
          f.storage.applyPaymentReconciliation({
            ...evidence,
            ...mismatch,
            state: "paid",
          }),
        );
      }
      const row = await first.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(row.paymentStatus, "PENDING");
      assert.equal(row.paidAt, null);
      assert.equal(row.tbankAcquiringPaymentId, evidence.paymentId);
      assert.equal(
        await first.orderPaymentEvent.count({ where: { orderId: order.id } }),
        0,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
    });

    it("leases separate queued orders to concurrent recovery workers and fences stale settlement", async () => {
      const fixtures = await Promise.all([fixture(), fixture()]);
      const orderIds: string[] = [];
      for (const [index, f] of fixtures.entries()) {
        const order = await f.storage.createOrder(f.input);
        orderIds.push(order.id);
        await f.storage.claimPaymentInitialization(order.id);
        // Sort our isolated fixtures before jobs left by other opt-in runs.
        await first.orderPaymentRecovery.update({
          where: { orderId: order.id },
          data: { nextAttemptAt: new Date(Date.UTC(1900, 0, 1) + index) },
        });
      }
      const workers = [
        new PaymentRecoveryService(first as unknown as PrismaService),
        new PaymentRecoveryService(second as unknown as PrismaService),
      ];
      const leases = await Promise.all(
        workers.map((worker) => worker.claimNext()),
      );
      assert.ok(leases[0]);
      assert.ok(leases[1]);
      assert.deepEqual(
        leases.map((lease) => lease!.orderId).sort(),
        [...orderIds].sort(),
      );
      assert.notEqual(leases[0].leaseToken, leases[1].leaseToken);
      for (const [index, lease] of leases.entries()) {
        const worker = workers[index]!;
        assert.equal(
          await worker.settle(
            { ...lease!, leaseToken: randomUUID() },
            { state: "pending" },
          ),
          false,
        );
        const checking = await first.orderPaymentRecovery.findUniqueOrThrow({
          where: { orderId: lease!.orderId },
        });
        assert.equal(checking.status, "CHECKING");
        assert.equal(checking.attempts, 1);
        assert.equal(await worker.settle(lease!, { state: "pending" }), true);
        assert.equal(await worker.settle(lease!, { state: "paid" }), false);
        const pending = await first.orderPaymentRecovery.findUniqueOrThrow({
          where: { orderId: lease!.orderId },
        });
        assert.equal(pending.status, "PENDING");
        assert.equal(pending.leaseToken, null);
        assert.equal(pending.lastError, "provider_pending");
      }
    });
  },
);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
