import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyHistoryFinalizationService } from "../src/loyalty/history-finalization.service";
import type { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import { LoyaltyHistoryPreviewService as HistoryPreview } from "../src/loyalty/history-preview.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { LoyaltyPurchaseHistoryService } from "../src/loyalty/purchase-history.service";
import { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import { LoyaltyRefundSettlementService } from "../src/loyalty/refund-settlement.service";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated test database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;
const at = (day: number, hour = 0) =>
  new Date(Date.UTC(2026, 0, day, hour));

describe(
  "purchase-history PostgreSQL settlement",
  {
    skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set",
  },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.equal(url.port, "55439");
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

    const purchases = (
      client = first,
      walletService: LoyaltyWalletService = wallet,
    ) =>
      new LoyaltyPurchaseSettlementService(
        client as unknown as PrismaService,
        walletService,
      );
    const history = (
      client = first,
      purchaseService = purchases(client),
      preview: LoyaltyHistoryPreviewService = new HistoryPreview(
        client as unknown as PrismaService,
      ),
    ) =>
      new LoyaltyPurchaseHistoryService(
        client as unknown as PrismaService,
        preview,
        purchaseService,
      );
    const finalizer = (client = first) =>
      new LoyaltyHistoryFinalizationService(
        client as unknown as PrismaService,
        new HistoryPreview(client as unknown as PrismaService),
      );
    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });
    const account = (orderId: string) =>
      first.loyaltyPurchaseAccount.findUniqueOrThrow({ where: { orderId } });

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
      const created = await first.loyaltyMember.create({
        data: {
          userId: user.id,
          termsVersion: "loyalty-v1",
          historyState: options.historyState ?? "PENDING",
          status: options.status ?? "ACTIVE",
          wallet: { create: {} },
        },
      });
      return { user, member: created };
    }

    async function credit(memberId: string, points: number) {
      return first.$transaction((tx) =>
        wallet.creditInTransaction(tx, {
          memberId,
          points,
          operationKey: `test:history-seed:${randomUUID()}`,
          sourceKey: `test:history-seed:${memberId}`,
          rulesVersion: "test-v1",
          occurredAt: at(1),
        }),
      );
    }

    async function order(
      userId: string | null,
      options: {
        createdDay?: number;
        cashKopecks?: number;
        quantity?: number;
        deliveryKopecks?: number;
        rate?: 3 | 5 | 7 | 10 | null;
        paid?: boolean;
        completed?: boolean;
        pricing?: boolean;
        realHistory?: boolean;
        spendMemberId?: string;
        spendPoints?: number;
      } = {},
    ) {
      const createdDay = options.createdDay ?? 2;
      const createdAt = at(createdDay);
      const paidAt = at(createdDay, 1);
      const completedAt = at(createdDay, 2);
      const quantity = options.quantity ?? 1;
      const cashKopecks = options.cashKopecks ?? 100_000;
      assert.equal(cashKopecks % quantity, 0);
      const unitKopecks = cashKopecks / quantity;
      const deliveryKopecks = options.deliveryKopecks ?? 10_000;
      const productId = `history-product-${randomUUID()}`;
      const base = createOrderPricingSnapshot(
        calculatePromoPricing(
          [{ id: productId, unitPriceKopecks: unitKopecks, quantity }],
          { type: "fixed", amountKopecks: 0 },
        ),
        deliveryKopecks,
      );
      const snapshot = options.spendMemberId
        ? applyLoyaltyPoints(base, options.spendPoints ?? 1)
        : base;
      const rate = options.rate ?? null;
      const result = await first.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: `hist-${randomUUID().slice(0, 24)}`,
            cartId: randomUUID(),
            userId,
            checkoutActorUserId: userId,
            customerName: "History QA",
            customerEmail: "history@example.test",
            customerPhone: "+70000000000",
            pickupPointId: "test",
            pickupPointTitle: "test",
            pickupPointAddress: "test",
            pickupPointWorkHours: "test",
            paymentRedirectUrl: "",
            itemsCount: quantity,
            deliveryPrice: deliveryKopecks / 100,
            subtotal: cashKopecks / 100,
            total: (cashKopecks + deliveryKopecks) / 100,
            createdAt,
            items: {
              create: {
                productId,
                title: "History product",
                slug: "history-product",
                image: "",
                quantity,
                price: unitKopecks / 100,
                lineTotal: cashKopecks / 100,
              },
            },
          },
        });
        if (options.spendMemberId)
          await wallet.reserveInTransaction(tx, {
            orderId: created.id,
            memberId: options.spendMemberId,
            points: options.spendPoints ?? 1,
            operationKey: `order:${created.id}:reserve`,
            sourceKey: `order:${created.id}`,
            rulesVersion: "order-spend-v1",
            occurredAt: createdAt,
          });
        const updated = await tx.order.update({
          where: { id: created.id },
          data: {
            ...(options.pricing === false
              ? {}
              : {
                  pricingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                  discount: snapshot.discountKopecks / 100,
                  total: snapshot.totalKopecks / 100,
                  loyaltyRatePercent: rate,
                  loyaltyRateVersion: rate === null ? null : "purchase-v1",
                }),
            ...(options.paid === false
              ? {}
              : { status: "PAID", paymentStatus: "PAID", paidAt }),
            ...(options.completed === false
              ? {}
              : { crmStatus: "COMPLETED", completedAt }),
          },
        });
        const event =
          options.paid === false
            ? null
            : await tx.orderPaymentEvent.create({
                data: { orderId: created.id, kind: "PAID", occurredAt: paidAt },
              });
        if (options.realHistory)
          await tx.orderHistory.createMany({
            data: [
              {
                orderId: created.id,
                eventType: "status_changed",
                payload: {
                  fromStatus: null,
                  source: "order_created",
                  toStatus: "waiting_payment",
                },
                createdAt,
              },
              {
                orderId: created.id,
                eventType: "status_changed",
                payload: {
                  fromStatus: "waiting_payment",
                  source: "payment_notification",
                  toStatus: "paid",
                },
                createdAt: paidAt,
              },
              {
                orderId: created.id,
                eventType: "status_changed",
                payload: { fromStatus: "paid", toStatus: "completed" },
                createdAt: completedAt,
              },
            ],
          });
        return { order: updated, event };
      });
      return { ...result, productId, snapshot };
    }

    async function refund(
      source: Awaited<ReturnType<typeof order>>,
      authorId: string,
      quantity: number,
      deliveryKopecks = 0,
    ) {
      const refunds = new OrderRefundsService(
        first as unknown as PrismaService,
        {
          recordRefundReversalInTransaction: async () => {
            throw new Error("No affiliate commission in history fixture");
          },
        } as unknown as ConstructorParameters<typeof OrderRefundsService>[1],
      );
      const requestId = randomUUID();
      await refunds.createOrderRefund(
        source.order.id,
        {
          requestId,
          reference: `history-refund-${requestId}`,
          reason: "Registered history test refund",
          confirmed: true,
          deliveryKopecks,
          items: quantity ? [{ productId: source.productId, quantity }] : [],
        },
        authorId,
      );
      return first.orderRefund.findUniqueOrThrow({
        where: { orderId_requestId: { orderId: source.order.id, requestId } },
        include: { event: true },
      });
    }

    async function waitForBlockedQuery(fragment: string) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [state] = await first.$queryRaw<Array<{ blocked: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock'
              AND position(${fragment} in query) > 0
          ) AS blocked
        `;
        if (state?.blocked) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Timed out waiting for blocked query: ${fragment}`);
    }

    it("restores progressive 3/5/7/10 percent history with explicit provenance", async () => {
      const fixture = await member();
      const sources = await Promise.all([
        order(fixture.user.id, { createdDay: 2, cashKopecks: 300_000 }),
        order(fixture.user.id, { createdDay: 3, cashKopecks: 400_000 }),
        order(fixture.user.id, { createdDay: 4, cashKopecks: 500_000 }),
        order(fixture.user.id, { createdDay: 5, cashKopecks: 10_000 }),
      ]);

      assert.deepEqual(await history().processMember(fixture.member.id), {
        processed: true,
        orders: 4,
      });
      const accounts = await first.loyaltyPurchaseAccount.findMany({
        where: { orderId: { in: sources.map((source) => source.order.id) } },
        orderBy: { occurredAt: "asc" },
      });
      assert.deepEqual(
        accounts.map((saved) => [
          saved.ratePercent,
          saved.historicalSpendKopecks,
          saved.grantedPoints,
          saved.historicalVersion,
        ]),
        [
          [3, 0n, 450n, "purchase-history-v1"],
          [5, 300_000n, 1_000n, "purchase-history-v1"],
          [7, 700_000n, 1_750n, "purchase-history-v1"],
          [10, 1_200_000n, 50n, "purchase-history-v1"],
        ],
      );
      assert.equal((await balance(fixture.member.id)).balancePoints, 3_250n);
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: fixture.member.id },
          })
        ).historyState,
        "PENDING",
      );
    });

    it("accepts the real order-created, paid and completed status chain", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id, { realHistory: true });

      assert.deepEqual(await history().processMember(fixture.member.id), {
        processed: true,
        orders: 1,
      });
      assert.equal((await account(source.order.id)).grantedPoints, 150n);
      assert.equal((await balance(fixture.member.id)).balancePoints, 150n);
      assert.equal(
        await first.orderHistory.count({
          where: { orderId: source.order.id, eventType: "status_changed" },
        }),
        3,
      );
    });

    it("serializes concurrent replays and uses the same purchase credit key as live settlement", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id);

      const attempts = await Promise.allSettled([
        history(first).processMember(fixture.member.id),
        history(second).processMember(fixture.member.id),
      ]);
      assert.ok(attempts.some((attempt) => attempt.status === "fulfilled"));
      await history().processMember(fixture.member.id);
      assert.equal((await balance(fixture.member.id)).balancePoints, 150n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: {
            purchaseOrderId: source.order.id,
            operationKey: `purchase:${source.order.id}:credit`,
          },
        }),
        1,
      );
      assert.deepEqual(await purchases().processOrder(source.order.id), {
        processed: true,
        replayed: true,
      });
      const sync = await first.loyaltyPurchaseHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.equal(sync.activeTransactionId, null);
      assert.ok(sync.completedAt);
    });

    it("credits only net goods after a pre-settlement refund and records a spent-points order with zero grant", async () => {
      const cash = await member();
      const refunded = await order(cash.user.id, {
        cashKopecks: 100_000,
        quantity: 2,
      });
      await refund(refunded, cash.user.id, 1, 10_000);
      await history().processMember(cash.member.id);
      assert.equal((await account(refunded.order.id)).grantedPoints, 75n);
      assert.equal((await account(refunded.order.id)).refundedKopecks, 50_000n);

      const spent = await member({ historyState: "READY" });
      await credit(spent.member.id, 100);
      const spentOrder = await order(spent.user.id, {
        createdDay: 3,
        spendMemberId: spent.member.id,
        spendPoints: 5,
      });
      assert.ok(spentOrder.event);
      await new LoyaltyPaymentSettlementService(
        first as unknown as PrismaService,
        wallet,
      ).processEvent(spentOrder.event.id);
      await first.loyaltyMember.update({
        where: { id: spent.member.id },
        data: { historyState: "PENDING" },
      });
      await history().processMember(spent.member.id);
      assert.equal((await account(spentOrder.order.id)).grantedPoints, 0n);
      assert.equal((await balance(spent.member.id)).balancePoints, 95n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: spentOrder.order.id },
        }),
        0,
      );
    });

    it("preserves frozen checkout rates and stored historical rates across later replays", async () => {
      const fixture = await member();
      const frozen = await order(fixture.user.id, {
        createdDay: 4,
        cashKopecks: 100_000,
        rate: 10,
      });
      await history().processMember(fixture.member.id);
      const saved = await account(frozen.order.id);
      assert.equal(saved.ratePercent, 10);
      assert.equal(saved.grantedPoints, 500n);
      assert.equal(saved.historicalVersion, null);
      assert.equal(saved.historicalSpendKopecks, null);
      await assert.rejects(
        first.order.update({
          where: { id: frozen.order.id },
          data: { loyaltyRatePercent: 3 },
        }),
      );

      const historical = await order(fixture.user.id, {
        createdDay: 5,
        cashKopecks: 100_000,
      });
      await history().processMember(fixture.member.id);
      const historicalBefore = await account(historical.order.id);
      const earlier = await order(fixture.user.id, {
        createdDay: 2,
        cashKopecks: 1_200_000,
      });
      await history().processMember(fixture.member.id);
      const historicalAfter = await account(historical.order.id);
      assert.equal(historicalAfter.ratePercent, historicalBefore.ratePercent);
      assert.equal(
        historicalAfter.historicalSpendKopecks,
        historicalBefore.historicalSpendKopecks,
      );
      assert.equal((await account(earlier.order.id)).ratePercent, 3);
      await assert.rejects(
        first.loyaltyPurchaseAccount.update({
          where: { orderId: historical.order.id },
          data: { historicalSpendKopecks: 1_200_000n },
        }),
      );
    });

    it("discovers an order completed after the previous history pass", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id, {
        paid: true,
        completed: false,
      });
      assert.deepEqual(await history().processMember(fixture.member.id), {
        processed: true,
        orders: 0,
      });
      await first.order.update({
        where: { id: source.order.id },
        data: { crmStatus: "COMPLETED", completedAt: at(2, 2) },
      });
      await first.loyaltyPurchaseHistorySync.update({
        where: { memberId: fixture.member.id },
        data: { nextAttemptAt: new Date(0) },
      });

      assert.ok((await history(second).processDueMembers(50)) >= 1);
      assert.equal((await account(source.order.id)).grantedPoints, 150n);
      for (const limit of [0, -1, 1.5, 51])
        await assert.rejects(history().processDueMembers(limit));
    });

    it("finalizes only after every purchase account and published goods refund are reconciled", async () => {
      const fixture = await member();
      const original = await order(fixture.user.id, {
        cashKopecks: 100_000,
        quantity: 2,
      });
      await history().processMember(fixture.member.id);

      const later = await order(fixture.user.id, { createdDay: 3 });
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: later.order.id },
        }),
        0,
      );

      await history().processMember(fixture.member.id);
      await refund(original, fixture.user.id, 1);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      await purchases().processOrder(original.order.id);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
    });

    it("reads a refund committed while finalization waits behind its order lock", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id, {
        cashKopecks: 100_000,
        quantity: 2,
      });
      await history().processMember(fixture.member.id);
      const author = await first.user.create({ data: { roles: ["ADMIN"] } });
      let confirmAuthorLock!: () => void;
      let releaseAuthorLock!: () => void;
      const authorLocked = new Promise<void>((resolve) => {
        confirmAuthorLock = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseAuthorLock = resolve;
      });
      const authorBarrier = first.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${author.id} FOR UPDATE`;
        confirmAuthorLock();
        await release;
      });
      await authorLocked;

      const refundAttempt = Promise.allSettled([
        refund(source, author.id, 1),
      ]);
      let finalizationAttempt:
        | Promise<
            PromiseSettledResult<{ processed: boolean; ready: boolean }>[]
          >
        | undefined;
      try {
        await waitForBlockedQuery("order_refunds");
        finalizationAttempt = Promise.allSettled([
          finalizer(second).processMember(fixture.member.id),
        ]);
        await waitForBlockedQuery("SELECT o.id FROM orders o");
      } finally {
        releaseAuthorLock();
      }

      await authorBarrier;
      const settledRefund = await refundAttempt;
      assert.equal(settledRefund[0]?.status, "fulfilled");
      assert.ok(finalizationAttempt);
      assert.deepEqual((await finalizationAttempt)[0], {
        status: "fulfilled",
        value: { processed: true, ready: false },
      });
      await purchases().processOrder(source.order.id);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
    });

    it("waits for this member's payment and refund receipts but ignores unrelated bank events", async () => {
      const unrelated = await first.user.create({ data: {} });
      await order(unrelated.id);

      const fixture = await member({ historyState: "READY" });
      await credit(fixture.member.id, 20);
      const spent = await order(fixture.user.id, {
        cashKopecks: 100_000,
        quantity: 2,
        spendMemberId: fixture.member.id,
        spendPoints: 10,
      });
      assert.ok(spent.event);
      await first.loyaltyMember.update({
        where: { id: fixture.member.id },
        data: { historyState: "PENDING" },
      });
      await history().processMember(fixture.member.id);

      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      await new LoyaltyPaymentSettlementService(
        first as unknown as PrismaService,
        wallet,
      ).processEvent(spent.event.id);

      const registered = await refund(spent, fixture.user.id, 1);
      assert.ok(registered.event);
      await purchases().processOrder(spent.order.id);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      await new LoyaltyRefundSettlementService(
        first as unknown as PrismaService,
        wallet,
      ).processEvent(registered.event!.id);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
    });

    it("does not auto-enroll users, mark history READY, or credit blocked identities", async () => {
      const blockedMember = await member({ status: "BLOCKED" });
      const blockedUser = await member({ userStatus: "BLOCKED" });
      const memberOrder = await order(blockedMember.user.id);
      const userOrder = await order(blockedUser.user.id);
      for (const fixture of [blockedMember, blockedUser]) {
        assert.deepEqual(await history().processMember(fixture.member.id), {
          processed: false,
          orders: 0,
        });
        assert.equal((await balance(fixture.member.id)).balancePoints, 0n);
        assert.equal(
          (
            await first.loyaltyMember.findUniqueOrThrow({
              where: { id: fixture.member.id },
            })
          ).historyState,
          "PENDING",
        );
      }
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: { in: [memberOrder.order.id, userOrder.order.id] } },
        }),
        0,
      );

      const plainUser = await first.user.create({ data: {} });
      await order(plainUser.id);
      await history().processDueMembers(50);
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: plainUser.id } }),
        0,
      );
    });

    it("rolls back every order on an injected wallet failure and persists sanitized automatic retry", async () => {
      const fixture = await member();
      const sources = await Promise.all([
        order(fixture.user.id, { createdDay: 2 }),
        order(fixture.user.id, { createdDay: 3 }),
      ]);
      const failingWallet = new LoyaltyWalletService();
      let credits = 0;
      failingWallet.creditPurchaseInTransaction = async (tx, input) => {
        const result = await wallet.creditPurchaseInTransaction(tx, input);
        credits += 1;
        if (credits === 2)
          throw new Error("PRIVATE injected history wallet failure");
        return result;
      };

      await assert.rejects(
        history(first, purchases(first, failingWallet)).processMember(
          fixture.member.id,
        ),
        /injected history wallet failure/,
      );
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: { in: sources.map((source) => source.order.id) } },
        }),
        0,
      );
      assert.equal((await balance(fixture.member.id)).balancePoints, 0n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: {
            purchaseOrderId: {
              in: sources.map((source) => source.order.id),
            },
          },
        }),
        0,
      );
      const sync = await first.loyaltyPurchaseHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.equal(sync.attempts, 1);
      assert.equal(sync.activeTransactionId, null);
      assert.equal(sync.lastError, "purchase_history_processing_failed");
      assert.doesNotMatch(sync.lastError, /PRIVATE|injected/);
      assert.ok(sync.nextAttemptAt.getTime() > Date.now());
      await history().processMember(fixture.member.id);
      assert.equal((await balance(fixture.member.id)).balancePoints, 300n);
    });

    it("does not let an older delayed failure overwrite a newer successful checkpoint", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id);
      let reachedBackoff!: () => void;
      let releaseBackoff!: () => void;
      const backoffReached = new Promise<void>((resolve) => {
        reachedBackoff = resolve;
      });
      const backoffRelease = new Promise<void>((resolve) => {
        releaseBackoff = resolve;
      });
      const delayedPrisma = {
        $transaction: first.$transaction.bind(first),
        $executeRaw: async (
          strings: TemplateStringsArray,
          ...values: Array<string | Date>
        ) => {
          if (strings.join("?").includes("purchase_history_processing_failed")) {
            reachedBackoff();
            await backoffRelease;
          }
          return first.$executeRaw(strings, ...values);
        },
      } as unknown as PrismaService;
      const failingWallet = new LoyaltyWalletService();
      failingWallet.creditPurchaseInTransaction = async (tx, input) => {
        await wallet.creditPurchaseInTransaction(tx, input);
        throw new Error("delayed older history failure");
      };
      const older = new LoyaltyPurchaseHistoryService(
        delayedPrisma,
        new HistoryPreview(delayedPrisma),
        new LoyaltyPurchaseSettlementService(delayedPrisma, failingWallet),
      ).processMember(fixture.member.id);
      await backoffReached;

      assert.deepEqual(await history().processMember(fixture.member.id), {
        processed: true,
        orders: 1,
      });
      const successful =
        await first.loyaltyPurchaseHistorySync.findUniqueOrThrow({
          where: { memberId: fixture.member.id },
        });
      assert.ok(successful.completedAt);
      releaseBackoff();
      await assert.rejects(older, /delayed older history failure/);

      const retained = await first.loyaltyPurchaseHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.equal(retained.lastError, null);
      assert.equal(retained.attempts, 0);
      assert.equal(retained.activeTransactionId, null);
      assert.equal(
        retained.completedAt?.getTime(),
        successful.completedAt?.getTime(),
      );
      assert.equal((await balance(fixture.member.id)).balancePoints, 150n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id, kind: "CREDIT" },
        }),
        1,
      );
    });

    it("refuses an incomplete source before granting any order in the member history", async () => {
      const fixture = await member();
      const good = await order(fixture.user.id, { createdDay: 2 });
      const corrupt = await order(fixture.user.id, {
        createdDay: 3,
        pricing: false,
      });

      await assert.rejects(
        history().processMember(fixture.member.id),
        /sources are incomplete/,
      );
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: { in: [good.order.id, corrupt.order.id] } },
        }),
        0,
      );
      assert.equal((await balance(fixture.member.id)).balancePoints, 0n);
      assert.equal(
        (
          await first.loyaltyPurchaseHistorySync.findUniqueOrThrow({
            where: { memberId: fixture.member.id },
          })
        ).lastError,
        "purchase_history_processing_failed",
      );
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: fixture.member.id },
          })
        ).historyState,
        "PENDING",
      );
    });

    it("rejects tampered preview rates in SQL and rejects cross-member source ownership", async () => {
      const owner = await member();
      const other = await member();
      const source = await order(owner.user.id);
      const fakePreview = (memberId: string, ratePercent: number) =>
        ({
          previewMemberInTransaction: async () => ({
            memberId,
            complete: true,
            scope: "purchases",
            rulesVersion: "purchase-history-v1",
            proposedCreditPoints: 500,
            issues: [],
            entries: [
              {
                orderId: source.order.id,
                ratePercent,
                rateSource: "historical",
                spendBeforeCheckoutKopecks: "0",
                netRewardPoints: 500,
                proposedCreditPoints: 500,
                accounted: false,
              },
            ],
          }),
        }) as unknown as LoyaltyHistoryPreviewService;

      await assert.rejects(
        history(first, purchases(), fakePreview(owner.member.id, 10)).processMember(
          owner.member.id,
        ),
      );
      await assert.rejects(
        history(first, purchases(), fakePreview(other.member.id, 3)).processMember(
          other.member.id,
        ),
        /owner does not match order/,
      );
      assert.equal(
        await first.loyaltyPurchaseAccount.count({
          where: { orderId: source.order.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member.id)).balancePoints, 0n);
      assert.equal((await balance(other.member.id)).balancePoints, 0n);
    });

    it("reverses a later refund only from free balance and never creates debt against future credits", async () => {
      const fixture = await member();
      const source = await order(fixture.user.id, {
        cashKopecks: 3_003,
        quantity: 3,
      });
      await history().processMember(fixture.member.id);
      assert.equal((await balance(fixture.member.id)).balancePoints, 5n);
      await first.loyaltyMember.update({
        where: { id: fixture.member.id },
        data: { historyState: "READY" },
      });
      const spending = await order(fixture.user.id, {
        createdDay: 4,
        paid: false,
        completed: false,
        rate: 3,
        spendMemberId: fixture.member.id,
        spendPoints: 4,
      });
      await first.loyaltyMember.update({
        where: { id: fixture.member.id },
        data: { historyState: "PENDING" },
      });
      await refund(source, fixture.user.id, 3);
      await purchases().processOrder(source.order.id);

      const walletAfterRefund = await balance(fixture.member.id);
      assert.equal(walletAfterRefund.balancePoints, 4n);
      assert.equal(walletAfterRefund.reservedPoints, 4n);
      const reversed = await first.loyaltyOperation.findFirstOrThrow({
        where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
      });
      assert.equal(reversed.requestedPoints, 5n);
      assert.equal(reversed.balanceDelta, -1n);
      assert.equal((await account(source.order.id)).reversedPoints, 5n);
      await credit(fixture.member.id, 7);
      await purchases().processOrder(source.order.id);
      assert.equal((await balance(fixture.member.id)).balancePoints, 11n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { purchaseOrderId: source.order.id, kind: "REVERSAL" },
        }),
        1,
      );
      assert.equal(
        (
          await first.loyaltyReservation.findUniqueOrThrow({
            where: { orderId: spending.order.id },
          })
        ).points,
        4n,
      );
    });
  },
);
