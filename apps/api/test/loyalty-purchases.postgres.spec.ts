import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import { PromocodesService } from "../src/promocodes/promocodes.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated test database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "purchase loyalty PostgreSQL settlement",
  {
    skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set",
  },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();
    const paidAt = new Date("2026-09-20T14:00:00.000Z");
    const completedAt = new Date("2026-09-20T15:00:00.000Z");

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.equal(url.port, "55439");
      assert.match(url.pathname, /^\/artmate_loyalty_test(?:_[a-z0-9_]+)?$/);
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

    const service = (client = first, walletService = wallet) =>
      new LoyaltyPurchaseSettlementService(
        client as unknown as PrismaService,
        walletService,
      );
    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });
    const account = (orderId: string) =>
      first.loyaltyPurchaseAccount.findUniqueOrThrow({ where: { orderId } });
    const reward = (cash: bigint, rate: number) =>
      (cash * BigInt(rate) * 5n + 9_999n) / 10_000n;

    async function member(
      options: {
        historyState?: "PENDING" | "READY";
        status?: "ACTIVE" | "BLOCKED";
        userStatus?: "ACTIVE" | "BLOCKED";
      } = {},
    ) {
      const user = await first.user.create({
        data: { status: options.userStatus ?? "ACTIVE" },
      });
      const member = await first.loyaltyMember.create({
        data: {
          userId: user.id,
          termsVersion: "loyalty-v1",
          historyState: options.historyState ?? "READY",
          status: options.status ?? "ACTIVE",
          wallet: { create: {} },
        },
      });
      return { user, member };
    }

    async function credit(memberId: string, points: number) {
      return first.$transaction((tx) =>
        wallet.creditInTransaction(tx, {
          memberId,
          points,
          operationKey: `test:purchase-seed:${randomUUID()}`,
          sourceKey: `test:purchase-seed:${memberId}`,
          rulesVersion: "test-v1",
          occurredAt: paidAt,
        }),
      );
    }

    async function order(
      userId: string,
      options: {
        rate?: 3 | 5 | 7 | 10 | null;
        paid?: boolean;
        completed?: boolean;
        guest?: boolean;
        unitKopecks?: number;
        quantity?: number;
        promoKopecks?: number;
        deliveryKopecks?: number;
        spendMemberId?: string;
      } = {},
    ) {
      const productId = `purchase-product-${randomUUID()}`;
      const quantity = options.quantity ?? 3;
      const unitKopecks = options.unitKopecks ?? 1_001;
      const delivery = options.deliveryKopecks ?? 50_000;
      const rate = options.rate === undefined ? 3 : options.rate;
      const base = createOrderPricingSnapshot(
        calculatePromoPricing(
          [{ id: productId, unitPriceKopecks: unitKopecks, quantity }],
          { type: "fixed", amountKopecks: options.promoKopecks ?? 0 },
        ),
        delivery,
      );
      const snapshot = options.spendMemberId
        ? applyLoyaltyPoints(base, 5)
        : base;
      const result = await first.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: `purchase-${randomUUID().slice(0, 23)}`,
            cartId: randomUUID(),
            userId,
            checkoutActorUserId: options.guest ? null : userId,
            customerName: "Purchase QA",
            customerEmail: "purchase@example.test",
            customerPhone: "+70000000000",
            pickupPointId: "test",
            pickupPointTitle: "test",
            pickupPointAddress: "test",
            pickupPointWorkHours: "test",
            paymentRedirectUrl: "",
            itemsCount: quantity,
            deliveryPrice: delivery / 100,
            subtotal: (unitKopecks * quantity) / 100,
            total: (unitKopecks * quantity + delivery) / 100,
            items: {
              create: {
                productId,
                title: "Purchase product",
                slug: "purchase-product",
                image: "",
                quantity,
                price: unitKopecks / 100,
                lineTotal: (unitKopecks * quantity) / 100,
              },
            },
          },
        });
        const promos = new PromocodesService(first as unknown as PrismaService);
        if (options.promoKopecks) {
          const promo = await tx.promoCode.create({
            data: {
              code: `PURCHASE-${randomUUID().slice(0, 24)}`.toUpperCase(),
              name: "Purchase reward pricing fixture",
              type: "FIXED",
              amountKopecks: BigInt(options.promoKopecks),
            },
          });
          await promos.reserveInTransaction(tx, {
            code: promo.code,
            orderId: created.id,
            userId,
            items: [{ id: productId, unitPriceKopecks: unitKopecks, quantity }],
          });
        }
        if (options.spendMemberId)
          await wallet.reserveInTransaction(tx, {
            orderId: created.id,
            memberId: options.spendMemberId,
            points: 5,
            operationKey: `order:${created.id}:reserve`,
            sourceKey: `order:${created.id}`,
            rulesVersion: "order-spend-v1",
            occurredAt: created.createdAt,
          });
        const updated = await tx.order.update({
          where: { id: created.id },
          data: {
            pricingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            loyaltyRatePercent: rate,
            loyaltyRateVersion: rate === null ? null : "purchase-v1",
            discount: snapshot.discountKopecks / 100,
            total: snapshot.totalKopecks / 100,
            ...(options.paid !== false
              ? { status: "PAID", paymentStatus: "PAID", paidAt }
              : {}),
            ...(options.completed !== false
              ? { crmStatus: "COMPLETED", completedAt }
              : {}),
          },
        });
        const event =
          options.paid !== false
            ? await tx.orderPaymentEvent.create({
                data: { orderId: created.id, kind: "PAID", occurredAt: paidAt },
              })
            : null;
        if (options.promoKopecks && options.paid !== false) {
          await promos.consumeInTransaction(tx, created.id, {
            provider: "test",
            source: "purchase_fixture",
            now: paidAt,
          });
        }
        return { order: updated, event };
      });
      if (options.spendMemberId && result.event)
        await new LoyaltyPaymentSettlementService(
          first as unknown as PrismaService,
          wallet,
        ).processEvent(result.event.id);
      return { ...result, productId, snapshot };
    }

    async function refund(
      source: Awaited<ReturnType<typeof order>>,
      userId: string,
      quantity: number,
      deliveryKopecks = 0,
    ) {
      const refunds = new OrderRefundsService(
        first as unknown as PrismaService,
        {
          recordRefundReversalInTransaction: async () => {
            throw new Error("No affiliate commission in purchase fixture");
          },
        } as unknown as ConstructorParameters<typeof OrderRefundsService>[1],
      );
      const requestId = randomUUID();
      await refunds.createOrderRefund(
        source.order.id,
        {
          requestId,
          reference: `purchase-refund-${requestId}`,
          reason: "Registered manual refund",
          confirmed: true,
          deliveryKopecks,
          items: quantity ? [{ productId: source.productId, quantity }] : [],
        },
        userId,
      );
      return first.orderRefund.findUniqueOrThrow({
        where: { orderId_requestId: { orderId: source.order.id, requestId } },
        include: { event: true },
      });
    }

    it("grants only net cash goods at the frozen rate with exact upward rounding and concurrent replay protection", async () => {
      for (const rate of [3, 5, 7, 10] as const) {
        const f = await member();
        const source = await order(f.user.id, {
          rate,
          unitKopecks: 10_001,
          promoKopecks: 1_000,
        });
        const expected = reward(29_003n, rate);
        const results = await Promise.all([
          service().processOrder(source.order.id),
          service(second).processOrder(source.order.id),
        ]);
        assert.equal(results.filter((result) => result.replayed).length, 1);
        const saved = await account(source.order.id);
        assert.equal(saved.baseKopecks, 29_003n);
        assert.equal(saved.grantedPoints, expected);
        assert.equal(saved.ratePercent, rate);
        assert.equal(saved.rulesVersion, "purchase-v1");
        assert.equal(saved.memberId, f.member.id);
        assert.equal(saved.occurredAt.getTime(), completedAt.getTime());
        assert.equal((await balance(f.member.id)).balancePoints, expected);
        assert.equal(
          await first.loyaltyOperation.count({
            where: { purchaseOrderId: source.order.id, kind: "CREDIT" },
          }),
          1,
        );
        assert.equal(
          (await service().processOrder(source.order.id)).replayed,
          true,
        );
      }
    });

    it("keeps an earlier frozen 3 percent rate after later purchases cross the top tier", async () => {
      const f = await member();
      const earlier = await order(f.user.id, { rate: 3 });
      const later = await order(f.user.id, {
        rate: 10,
        unitKopecks: 1_500_000,
        quantity: 1,
      });
      await service().processOrder(later.order.id);
      await service().processOrder(earlier.order.id);
      assert.equal((await account(earlier.order.id)).grantedPoints, 5n);
      assert.equal((await account(earlier.order.id)).ratePercent, 3);
    });

    it("credits only remaining cash when a refund predates the first award, without granting then reversing", async () => {
      const f = await member();
      const source = await order(f.user.id);
      const recorded = await refund(source, f.user.id, 1, 50_000);
      assert.ok(recorded.event);
      await service().processOrder(source.order.id);
      const saved = await account(source.order.id);
      assert.equal(saved.baseKopecks, 3_003n);
      assert.equal(saved.refundedKopecks, 1_001n);
      assert.equal(saved.grantedPoints, 4n);
      assert.equal(saved.reversedPoints, 0n);
      assert.equal((await balance(f.member.id)).balancePoints, 4n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
        }),
        0,
      );
    });

    it("reconciles cumulative refunds by remaining-reward rounding and never reverses delivery", async () => {
      const f = await member();
      const source = await order(f.user.id);
      await service().processOrder(source.order.id);
      await refund(source, f.user.id, 0, 50_000);
      await service().processOrder(source.order.id);
      assert.equal((await balance(f.member.id)).balancePoints, 5n);
      assert.equal((await account(source.order.id)).refundedKopecks, 0n);
      await refund(source, f.user.id, 1);
      await service().processOrder(source.order.id);
      assert.equal((await balance(f.member.id)).balancePoints, 4n);
      await refund(source, f.user.id, 1);
      await refund(source, f.user.id, 1);
      await Promise.all([
        service().processOrder(source.order.id),
        service(second).processOrder(source.order.id),
      ]);
      assert.equal((await balance(f.member.id)).balancePoints, 0n);
      const saved = await account(source.order.id);
      assert.equal(saved.refundedKopecks, 3_003n);
      assert.equal(saved.reversedPoints, 5n);
      const operations = await first.loyaltyOperation.findMany({
        where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
      });
      assert.equal(operations.length, 2);
      assert.deepEqual(
        operations.map((entry) => entry.requestedPoints).sort(),
        [1n, 4n],
      );
    });

    it("does not earn purchase points when any goods used loyalty spending", async () => {
      const f = await member();
      await credit(f.member.id, 100);
      const source = await order(f.user.id, { spendMemberId: f.member.id });
      await service().processOrder(source.order.id);
      assert.equal((await account(source.order.id)).grantedPoints, 0n);
      assert.equal((await balance(f.member.id)).balancePoints, 95n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id },
        }),
        0,
      );
    });

    it("does not fabricate old rates, memberships, READY history, or confirmed payment facts", async () => {
      const cases = [
        { membership: {}, order: { rate: null } },
        { membership: { historyState: "PENDING" as const }, order: {} },
        { membership: { status: "BLOCKED" as const }, order: {} },
        { membership: { userStatus: "BLOCKED" as const }, order: {} },
        { membership: {}, order: { paid: false, completed: false } },
        { membership: {}, order: { completed: false } },
      ];
      for (const testCase of cases) {
        const f = await member(testCase.membership);
        const source = await order(f.user.id, testCase.order);
        assert.equal(
          (await service().processOrder(source.order.id)).processed,
          false,
        );
        assert.equal(
          await first.loyaltyPurchaseAccount.count({
            where: { orderId: source.order.id },
          }),
          0,
        );
        assert.equal((await balance(f.member.id)).balancePoints, 0n);
        assert.equal(
          (
            await first.loyaltyMember.findUniqueOrThrow({
              where: { id: f.member.id },
            })
          ).historyState,
          testCase.membership.historyState ?? "READY",
        );
      }
      const user = await first.user.create({ data: {} });
      const source = await order(user.id);
      assert.equal(
        (await service().processOrder(source.order.id)).processed,
        false,
      );
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: user.id } }),
        0,
      );
    });

    it("uses the linked order owner for a guest purchase, not the absent checkout actor", async () => {
      const f = await member();
      const source = await order(f.user.id, { guest: true });
      assert.equal(source.order.checkoutActorUserId, null);
      await service().processOrder(source.order.id);
      assert.equal((await account(source.order.id)).memberId, f.member.id);
      assert.equal((await balance(f.member.id)).balancePoints, 5n);
    });

    it("corrects an existing award after member blocking and CRM changes", async () => {
      const f = await member();
      const source = await order(f.user.id);
      await service().processOrder(source.order.id);
      await first.loyaltyMember.update({
        where: { id: f.member.id },
        data: { status: "BLOCKED", historyState: "PENDING" },
      });
      await first.order.update({
        where: { id: source.order.id },
        data: { crmStatus: "CANCELLED" },
      });
      await refund(source, f.user.id, 3);
      await service().processOrder(source.order.id);
      assert.equal((await account(source.order.id)).reversedPoints, 5n);
      assert.equal((await balance(f.member.id)).balancePoints, 0n);
      assert.equal(
        (
          await first.order.findUniqueOrThrow({
            where: { id: source.order.id },
          })
        ).paymentStatus,
        "PAID",
      );
    });

    it("clamps reversal to unreserved balance and never collects waived points from future credits", async () => {
      const f = await member();
      const source = await order(f.user.id);
      await service().processOrder(source.order.id);
      const spending = await order(f.user.id, {
        paid: false,
        completed: false,
      });
      await first.$transaction((tx) =>
        wallet.reserveInTransaction(tx, {
          orderId: spending.order.id,
          memberId: f.member.id,
          points: 4,
          operationKey: `order:${spending.order.id}:reserve`,
          sourceKey: `order:${spending.order.id}`,
          rulesVersion: "order-spend-v1",
          occurredAt: spending.order.createdAt,
        }),
      );
      await refund(source, f.user.id, 3);
      await service().processOrder(source.order.id);
      assert.equal((await account(source.order.id)).reversedPoints, 5n);
      assert.equal((await balance(f.member.id)).balancePoints, 4n);
      assert.equal((await balance(f.member.id)).reservedPoints, 4n);
      const reversed = await first.loyaltyOperation.findFirstOrThrow({
        where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
      });
      assert.equal(reversed.requestedPoints, 5n);
      assert.equal(reversed.balanceDelta, -1n);
      await credit(f.member.id, 7);
      await service().processOrder(source.order.id);
      assert.equal((await balance(f.member.id)).balancePoints, 11n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
        }),
        1,
      );
    });

    it("rolls back wallet and account together, preserves PAID/COMPLETED, and persists retry state", async () => {
      const f = await member();
      const source = await order(f.user.id);
      const failingWallet = new LoyaltyWalletService();
      failingWallet.creditPurchaseInTransaction = async (tx, input) => {
        await wallet.creditPurchaseInTransaction(tx, input);
        throw new Error("PRIVATE injected purchase wallet failure");
      };
      await assert.rejects(
        service(first, failingWallet).processOrder(source.order.id),
        /injected purchase/,
      );
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: source.order.id },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id },
        }),
        0,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 0n);
      const sync = await first.loyaltyPurchaseSync.findUniqueOrThrow({
        where: { orderId: source.order.id },
      });
      assert.equal(sync.attempts, 1);
      assert.ok(sync.nextAttemptAt.getTime() > Date.now());
      assert.doesNotMatch(sync.lastError ?? "", /PRIVATE|injected/);
      const retained = await first.order.findUniqueOrThrow({
        where: { id: source.order.id },
      });
      assert.equal(retained.paymentStatus, "PAID");
      assert.equal(retained.crmStatus, "COMPLETED");
      await service().processOrder(source.order.id);
      assert.equal((await balance(f.member.id)).balancePoints, 5n);
    });

    it("discovers eligible work and new refunds from the database without an in-memory callback", async () => {
      const f = await member();
      const source = await order(f.user.id);
      await service().processDueOrders(100);
      assert.equal((await balance(f.member.id)).balancePoints, 5n);
      await refund(source, f.user.id, 3);
      await service(second).processDueOrders(100);
      assert.equal((await balance(f.member.id)).balancePoints, 0n);
      assert.equal((await account(source.order.id)).reversedPoints, 5n);
      for (const limit of [0, -1, 1.5, 201])
        await assert.rejects(service().processDueOrders(limit));
    });

    it("rejects forged account ownership and account creation without the matching wallet ledger", async () => {
      const f = await member();
      const other = await member();
      const source = await order(f.user.id);
      const data = {
        orderId: source.order.id,
        memberId: f.member.id,
        ratePercent: 3,
        rulesVersion: "purchase-v1",
        baseKopecks: 3_003n,
        grantedPoints: 5n,
        refundedKopecks: 0n,
        occurredAt: completedAt,
      };
      await assert.rejects(
        first.loyaltyPurchaseAccount.create({
          data: { ...data, memberId: other.member.id },
        }),
      );
      await assert.rejects(first.loyaltyPurchaseAccount.create({ data }));
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: source.order.id },
        }),
        0,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 0n);
      await service().processOrder(source.order.id);
      assert.equal((await balance(f.member.id)).balancePoints, 5n);
    });

    it("rejects direct zero-award account forgery for a blocked user even when no credit ledger is required", async () => {
      const f = await member();
      await credit(f.member.id, 100);
      const source = await order(f.user.id, { spendMemberId: f.member.id });
      await first.user.update({
        where: { id: f.user.id },
        data: { status: "BLOCKED" },
      });
      await assert.rejects(
        first.loyaltyPurchaseAccount.create({
          data: {
            orderId: source.order.id,
            memberId: f.member.id,
            ratePercent: 3,
            rulesVersion: "purchase-v1",
            baseKopecks: BigInt(source.snapshot.itemsTotalKopecks),
            grantedPoints: 0n,
            refundedKopecks: 0n,
            occurredAt: completedAt,
          },
        }),
      );
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: source.order.id },
        }),
        0,
      );
      assert.equal((await balance(f.member.id)).balancePoints, 95n);
    });

    it("rejects mutations of frozen order rates and immutable purchase-account identity and basis", async () => {
      const f = await member();
      const other = await member();
      const source = await order(f.user.id);
      await service().processOrder(source.order.id);
      await assert.rejects(
        first.order.update({
          where: { id: source.order.id },
          data: { loyaltyRatePercent: 10 },
        }),
      );
      for (const data of [
        { ratePercent: 10 },
        { memberId: other.member.id },
        { baseKopecks: 99_999n },
        { grantedPoints: 999n },
        { rulesVersion: "forged-v1" },
      ]) {
        await assert.rejects(
          first.loyaltyPurchaseAccount.update({
            where: { orderId: source.order.id },
            data,
          }),
        );
      }
      assert.equal((await account(source.order.id)).grantedPoints, 5n);
      assert.equal((await balance(other.member.id)).balancePoints, 0n);
      const oldOrder = await order(f.user.id, { rate: null });
      await assert.rejects(
        first.order.update({
          where: { id: oldOrder.order.id },
          data: { loyaltyRatePercent: 3, loyaltyRateVersion: "purchase-v1" },
        }),
      );
    });
  },
);
