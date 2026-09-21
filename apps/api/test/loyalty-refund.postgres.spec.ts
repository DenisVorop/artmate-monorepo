import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { LoyaltyRefundSettlementService } from "../src/loyalty/refund-settlement.service";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import type { PrismaService } from "../src/prisma/prisma.service";

// Opt-in isolated local database only; never inherit runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "loyalty refund PostgreSQL transactions",
  {
    skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set",
  },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();
    const occurredAt = new Date("2026-09-20T14:00:00.000Z");

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

    const consumer = (client = first, service = wallet) =>
      new LoyaltyRefundSettlementService(
        client as unknown as PrismaService,
        service,
      );
    const paymentConsumer = () =>
      new LoyaltyPaymentSettlementService(
        first as unknown as PrismaService,
        wallet,
      );
    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });

    async function fixture(consume = true) {
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
      const productId = `refund-product-${randomUUID()}`;
      const snapshot = applyLoyaltyPoints(
        createOrderPricingSnapshot(
          calculatePromoPricing(
            [{ id: productId, unitPriceKopecks: 1_000, quantity: 3 }],
            { type: "fixed", amountKopecks: 0 },
          ),
          300,
        ),
        5,
      );
      const { order, event } = await first.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            id: `refund-${randomUUID().slice(0, 24)}`,
            userId: user.id,
            checkoutActorUserId: user.id,
            cartId: randomUUID(),
            customerName: "Refund QA",
            customerEmail: "refund@example.test",
            customerPhone: "+70000000000",
            pickupPointId: "test",
            pickupPointTitle: "test",
            pickupPointAddress: "test",
            pickupPointWorkHours: "test",
            deliveryPrice: 3,
            paymentRedirectUrl: "",
            itemsCount: 3,
            subtotal: 30,
            total: 33,
            items: {
              create: {
                productId,
                title: "Refund product",
                slug: "refund-product",
                image: "",
                price: 10,
                quantity: 3,
                lineTotal: 30,
              },
            },
          },
        });
        await wallet.reserveInTransaction(tx, {
          orderId: order.id,
          memberId: member.id,
          points: 5,
          operationKey: `order:${order.id}:reserve`,
          sourceKey: `order:${order.id}`,
          rulesVersion: "order-spend-v1",
          occurredAt: order.createdAt,
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            pricingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            discount: 1,
            total: 32,
            paymentStatus: "PAID",
            status: "PAID",
            crmStatus: "PAID",
            paidAt: occurredAt,
          },
        });
        const event = await tx.orderPaymentEvent.create({
          data: { orderId: order.id, kind: "PAID", occurredAt },
        });
        return { order, event };
      });
      if (consume) await paymentConsumer().processEvent(event.id);
      const source = new OrderRefundsService(
        first as unknown as PrismaService,
        {
          recordRefundReversalInTransaction: async () => {
            throw new Error("No affiliate commission in refund fixture");
          },
        } as unknown as ConstructorParameters<typeof OrderRefundsService>[1],
      );
      async function refund(quantity: number, deliveryKopecks = 0) {
        const requestId = randomUUID();
        await source.createOrderRefund(
          order.id,
          {
            requestId,
            reference: `refund-${requestId}`,
            reason: "Registered manual refund",
            confirmed: true,
            deliveryKopecks,
            items: quantity ? [{ productId, quantity }] : [],
          },
          user.id,
        );
        const refund = await first.orderRefund.findUniqueOrThrow({
          where: { orderId_requestId: { orderId: order.id, requestId } },
          include: { items: true, event: true },
        });
        assert.ok(refund.event);
        return refund;
      }
      return { user, member, order, event, productId, refund };
    }

    it("publishes exact ordinal allocations and restores out-of-order events exactly once under concurrent workers", async () => {
      const f = await fixture();
      const a = await f.refund(1);
      const b = await f.refund(2);
      assert.deepEqual(
        a.items.map((item) => [
          item.previousQuantity,
          item.quantity,
          item.amountKopecks,
          item.loyaltyPoints,
        ]),
        [[0, 1, 960n, 2n]],
      );
      assert.deepEqual(
        b.items.map((item) => [
          item.previousQuantity,
          item.quantity,
          item.amountKopecks,
          item.loyaltyPoints,
        ]),
        [[1, 2, 1_940n, 3n]],
      );
      await consumer().processEvent(b.event!.id);
      assert.equal((await balance(f.member.id)).balancePoints, 98n);
      const results = await Promise.all([
        consumer().processEvent(a.event!.id),
        consumer(second).processEvent(a.event!.id),
      ]);
      assert.equal(results.filter((result) => result.replayed).length, 1);
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { refundId: { in: [a.id, b.id] }, kind: "RESTORE" },
        }),
        2,
      );
      assert.ok(
        (
          await first.loyaltyRefundReceipt.findUniqueOrThrow({
            where: { eventId: a.event!.id },
          })
        ).processedAt,
      );
      await assert.rejects(f.refund(1));
      assert.equal(
        await first.orderRefund.count({ where: { orderId: f.order.id } }),
        2,
      );
    });

    it("keeps a registered refund durable while payment consumption is pending and succeeds on retry", async () => {
      const f = await fixture(false);
      const refund = await f.refund(1);
      await assert.rejects(
        consumer().processEvent(refund.event!.id),
        /consumed reservation/,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 5n);
      const receipt = await first.loyaltyRefundReceipt.findUniqueOrThrow({
        where: { eventId: refund.event!.id },
      });
      assert.equal(receipt.processedAt, null);
      assert.equal(receipt.lastError, "refund_settlement_failed");
      assert.ok(receipt.nextAttemptAt.getTime() > Date.now());
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: f.order.id } }))
          .paymentStatus,
        "PAID",
      );
      await paymentConsumer().processEvent(f.event.id);
      await consumer().processEvent(refund.event!.id);
      assert.equal((await balance(f.member.id)).balancePoints, 97n);
      assert.equal(
        (
          await first.loyaltyRefundReceipt.findUniqueOrThrow({
            where: { eventId: refund.event!.id },
          })
        ).attempts,
        2,
      );
    });

    it("restores previously spent points to a blocked member without creating new spending authority", async () => {
      const f = await fixture();
      await first.loyaltyMember.update({
        where: { id: f.member.id },
        data: { status: "BLOCKED" },
      });
      const refund = await f.refund(1);
      await consumer().processEvent(refund.event!.id);
      assert.equal((await balance(f.member.id)).balancePoints, 97n);
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: f.member.id },
          })
        ).status,
        "BLOCKED",
      );
    });

    it("processes delivery-only refunds without wallet operations and rejects immutable source tampering", async () => {
      const f = await fixture();
      const refund = await f.refund(0, 300);
      assert.equal(refund.loyaltyPoints, 0n);
      assert.equal(refund.totalKopecks, 300n);
      await consumer().processEvent(refund.event!.id);
      assert.equal((await balance(f.member.id)).balancePoints, 95n);
      assert.equal(
        await first.loyaltyOperation.count({ where: { refundId: refund.id } }),
        0,
      );
      await assert.rejects(
        first.orderRefund.update({
          where: { id: refund.id },
          data: { loyaltyPoints: 1n },
        }),
      );
      await assert.rejects(
        first.orderRefundEvent.update({
          where: { id: refund.event!.id },
          data: { occurredAt: new Date(0) },
        }),
      );
      assert.equal(
        (
          await first.orderRefund.findUniqueOrThrow({
            where: { id: refund.id },
          })
        ).loyaltyPoints,
        0n,
      );
      assert.ok(
        (
          await first.loyaltyRefundReceipt.findUniqueOrThrow({
            where: { eventId: refund.event!.id },
          })
        ).processedAt,
      );
    });

    it("rolls back a failed worker's restoration but preserves the source and persists retry state", async () => {
      const f = await fixture();
      const refund = await f.refund(1);
      const failingWallet = new LoyaltyWalletService();
      failingWallet.restoreRefundInTransaction = async (tx, input) => {
        await wallet.restoreRefundInTransaction(tx, input);
        throw new Error("Injected failure after wallet restoration");
      };
      await assert.rejects(
        consumer(first, failingWallet).processEvent(refund.event!.id),
        /Injected failure/,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 95n);
      assert.equal(
        await first.loyaltyOperation.count({ where: { refundId: refund.id } }),
        0,
      );
      assert.equal(
        (
          await first.orderRefund.findUniqueOrThrow({
            where: { id: refund.id },
          })
        ).loyaltyPoints,
        2n,
      );
      assert.equal(
        (
          await first.loyaltyRefundReceipt.findUniqueOrThrow({
            where: { eventId: refund.event!.id },
          })
        ).processedAt,
        null,
      );
      await consumer().processEvent(refund.event!.id);
      assert.equal((await balance(f.member.id)).balancePoints, 97n);
      assert.equal(
        await first.loyaltyOperation.count({ where: { refundId: refund.id } }),
        1,
      );
    });
  },
);
