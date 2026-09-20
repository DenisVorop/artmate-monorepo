import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { OrdersLoyaltyService } from "../src/orders/orders-loyalty.service";
import { OrdersStorage } from "../src/orders/orders.storage";
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
            } as unknown as ConstructorParameters<typeof OrdersStorage>[1]),
        {
          attachGuestOrderInTransaction: unexpected,
        } as unknown as ConstructorParameters<typeof OrdersStorage>[2],
        { enqueueOrderCreated } as unknown as ConstructorParameters<
          typeof OrdersStorage
        >[3],
        {} as ConstructorParameters<typeof OrdersStorage>[4],
        coordinator,
      );
      return { coordinator, storage, promos };
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

    async function markPaid(tx: Prisma.TransactionClient, orderId: string) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          crmStatus: "PAID",
          paymentStatus: "PAID",
          paidAt: occurredAt,
        },
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
      assert.equal(await f.storage.hasReservedLoyaltyPoints(row.id), true);
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

        const settle = (client: PrismaClient) =>
          client.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
            await f.promos.consumeInTransaction(tx, order.id, {
              now: occurredAt,
              provider: "tbank",
              source: "postgres-test",
            });
            await markPaid(tx, order.id);
            await f.coordinator.consumePaidInTransaction(tx, order.id);
          });
        await settle(first);
        await settle(second);

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

    it("rolls back paid status and consumption together, then consumes exactly once on retry", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      await assert.rejects(
        first.$transaction(async (tx) => {
          await markPaid(tx, order.id);
          await f.coordinator.consumePaidInTransaction(tx, order.id);
          assert.equal(
            (
              await tx.loyaltyWallet.findUniqueOrThrow({
                where: { memberId: f.member.id },
              })
            ).balancePoints,
            30n,
          );
          throw new Error("paid rollback test");
        }),
        /paid rollback test/,
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PENDING",
      );
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paidAt,
        null,
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      assert.equal((await balance(f.member.id)).revision, 2n);
      await first.$transaction(async (tx) => {
        await markPaid(tx, order.id);
        await f.coordinator.consumePaidInTransaction(tx, order.id);
      });
      await second.$transaction((tx) =>
        services(second).coordinator.consumePaidInTransaction(tx, order.id),
      );
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "CONSUME"],
      );
    });

    it("requires closed-payment identity and amount evidence before idempotent release", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      await assert.rejects(
        f.storage.releaseLoyaltyForClosedTBankPayment({
          orderId: order.id,
          paymentId: "test-payment-1",
          amountKopecks: f.preview.snapshot.totalKopecks,
        }),
      );
      const evidence = await markClosed(order.id);
      await assert.rejects(
        f.storage.releaseLoyaltyForClosedTBankPayment({
          ...evidence,
          paymentId: "wrong-payment",
        }),
      );
      await assert.rejects(
        f.storage.releaseLoyaltyForClosedTBankPayment({
          ...evidence,
          amountKopecks: evidence.amountKopecks + 1,
        }),
      );
      assert.equal((await reservation(order.id)).status, "RESERVED");
      assert.equal((await balance(f.member.id)).reservedPoints, 70n);
      await f.storage.releaseLoyaltyForClosedTBankPayment(evidence);
      await services(second).storage.releaseLoyaltyForClosedTBankPayment(
        evidence,
      );
      assert.equal((await reservation(order.id)).status, "RELEASED");
      assert.equal((await balance(f.member.id)).balancePoints, 100n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "RELEASE"],
      );
      assert.equal(await f.storage.hasReservedLoyaltyPoints(order.id), false);
    });

    it("rechecks paid state under the order lock and never releases a paid reservation", async () => {
      const f = await fixture();
      const order = await f.storage.createOrder(f.input);
      const evidence = await markClosed(order.id);
      const paidAndLocked = deferred();
      const commitPaid = deferred();
      const payment = first.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
        await markPaid(tx, order.id);
        await f.coordinator.consumePaidInTransaction(tx, order.id);
        paidAndLocked.resolve();
        await commitPaid.promise;
      });
      try {
        await Promise.race([paidAndLocked.promise, payment]);
        const release =
          services(second).storage.releaseLoyaltyForClosedTBankPayment(
            evidence,
          );
        commitPaid.resolve();
        await Promise.all([payment, release]);
      } finally {
        commitPaid.resolve();
      }
      assert.equal(
        (await first.order.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "PAID",
      );
      assert.equal((await reservation(order.id)).status, "CONSUMED");
      assert.equal((await balance(f.member.id)).balancePoints, 30n);
      assert.equal((await balance(f.member.id)).reservedPoints, 0n);
      assert.equal((await balance(f.member.id)).revision, 3n);
      assert.deepEqual(
        (await operations(f.member.id)).map((op) => op.kind),
        ["CREDIT", "RESERVE", "CONSUME"],
      );
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
