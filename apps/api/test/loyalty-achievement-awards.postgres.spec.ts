import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, it } from "node:test";
import { inspect } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { AchievementBadgeService } from "../src/achievements/badge.service";
import { AchievementsService } from "../src/achievements/achievements.service";
import { LoyaltyAchievementAwardService } from "../src/loyalty/achievement-award.service";
import { LoyaltyAchievementDraftsService } from "../src/loyalty/achievement-drafts.service";
import { LoyaltyHistoryFinalizationService } from "../src/loyalty/history-finalization.service";
import { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import { LoyaltyMembershipService } from "../src/loyalty/membership.service";
import { LoyaltyPaymentSettlementService } from "../src/loyalty/payment-settlement.service";
import { LoyaltyPurchaseHistoryService } from "../src/loyalty/purchase-history.service";
import { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { LoyaltyWorkRewardService } from "../src/loyalty/work-reward.service";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";
import { PromocodesService } from "../src/promocodes/promocodes.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated local database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "loyalty achievement awards in PostgreSQL",
  { skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set" },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    let authorId: string;
    const wallet = new LoyaltyWalletService();

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
      authorId = (await first.user.create({ data: { roles: ["ADMIN"] } })).id;
    });

    after(async () => {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
    });

    afterEach(async () => {
      const unfinished = await first.loyaltyAchievementDefinition.findMany({
        where: {
          archivedAt: null,
          revisions: { some: { createdById: authorId } },
        },
        select: { id: true, currentVersion: true },
      });
      for (const definition of unfinished)
        await drafts().archive(definition.id, definition.currentVersion);
    });

    const badges = (client = first) =>
      new AchievementBadgeService(client as unknown as PrismaService);
    async function qualifyMember(memberId: string) {
      const member = await first.loyaltyMember.findUniqueOrThrow({
        where: { id: memberId },
      });
      await badges().processUser(member.userId);
    }
    const achievements = (userId: string) =>
      new AchievementsService(first as unknown as PrismaService).getMine(
        userId,
      );
    const awards = (client = first, walletService = wallet) =>
      new LoyaltyAchievementAwardService(
        client as unknown as PrismaService,
        walletService,
      );
    const drafts = (client = first) =>
      new LoyaltyAchievementDraftsService(client as unknown as PrismaService);
    const workRewards = (client = first) =>
      new LoyaltyWorkRewardService(client as unknown as PrismaService, wallet);
    const historyPreview = (client = first) =>
      new LoyaltyHistoryPreviewService(client as unknown as PrismaService);
    const purchaseHistory = (client = first) =>
      new LoyaltyPurchaseHistoryService(
        client as unknown as PrismaService,
        historyPreview(client),
        new LoyaltyPurchaseSettlementService(
          client as unknown as PrismaService,
          wallet,
        ),
      );
    const finalizer = (client = first) =>
      new LoyaltyHistoryFinalizationService(
        client as unknown as PrismaService,
        historyPreview(client),
      );
    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });

    const dashboard = (userId: string) =>
      new LoyaltyMembershipService(
        first as unknown as PrismaService,
      ).getDashboard(userId);
    async function dashboardCard(userId: string, definitionId: string) {
      const cards = (await achievements(userId)).achievements.filter(
        (card) => card.id === definitionId,
      );
      assert.equal(
        cards.length,
        1,
        "Exactly one active or awarded card per definition",
      );
      return cards[0]!;
    }

    async function createOrder(
      userId: string,
      options: {
        paid?: boolean;
        completed?: boolean;
        quantity?: number;
        promoKopecks?: number;
        deliveryKopecks?: number;
        spendMemberId?: string;
      } = {},
    ) {
      const productId = `achievement-order-product-${randomUUID()}`;
      const quantity = options.quantity ?? 1;
      const unitKopecks = 1_001;
      const deliveryKopecks = options.deliveryKopecks ?? 500;
      const base = createOrderPricingSnapshot(
        calculatePromoPricing(
          [{ id: productId, unitPriceKopecks: unitKopecks, quantity }],
          {
            type: "fixed",
            amountKopecks: options.promoKopecks ?? 0,
          },
        ),
        deliveryKopecks,
      );
      const snapshot = options.spendMemberId
        ? applyLoyaltyPoints(base, 5)
        : base;
      const result = await first.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: `achievement-${randomUUID().slice(0, 20)}`,
            cartId: randomUUID(),
            userId,
            checkoutActorUserId: userId,
            customerName: "Achievement order QA",
            customerEmail: "achievement-order@example.test",
            customerPhone: "+70000000000",
            pickupPointId: "test",
            pickupPointTitle: "test",
            pickupPointAddress: "test",
            pickupPointWorkHours: "test",
            paymentRedirectUrl: "",
            itemsCount: quantity,
            deliveryPrice: deliveryKopecks / 100,
            subtotal: (unitKopecks * quantity) / 100,
            total: (unitKopecks * quantity + deliveryKopecks) / 100,
            items: {
              create: {
                productId,
                title: "Achievement order product",
                slug: "achievement-order-product",
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
              code: `ACHIEVEMENT-${randomUUID().slice(0, 20)}`.toUpperCase(),
              name: "Achievement order fixture",
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
        const paidAt = new Date(created.createdAt.getTime() + 1);
        const completedAt = new Date(created.createdAt.getTime() + 2);
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
        const order = await tx.order.update({
          where: { id: created.id },
          data: {
            pricingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            discount: snapshot.discountKopecks / 100,
            total: snapshot.totalKopecks / 100,
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
                data: { orderId: order.id, kind: "PAID", occurredAt: paidAt },
              });
        if (options.promoKopecks && event)
          await promos.consumeInTransaction(tx, order.id, {
            provider: "test",
            source: "achievement_fixture",
            now: paidAt,
          });
        return { order, event };
      });
      if (options.spendMemberId && result.event)
        await new LoyaltyPaymentSettlementService(
          first as unknown as PrismaService,
          wallet,
        ).processEvent(result.event.id);
      return { ...result, productId, quantity, snapshot };
    }

    async function refundOrder(
      source: Awaited<ReturnType<typeof createOrder>>,
      authorId: string,
      quantity: number,
      deliveryKopecks = 0,
    ) {
      const refunds = new OrderRefundsService(
        first as unknown as PrismaService,
        {
          recordRefundReversalInTransaction: async () => {
            throw new Error("No affiliate commission in achievement fixture");
          },
        } as unknown as ConstructorParameters<typeof OrderRefundsService>[1],
      );
      const requestId = randomUUID();
      await refunds.createOrderRefund(
        source.order.id,
        {
          requestId,
          reference: `achievement-refund-${requestId}`,
          reason: "Registered achievement fixture refund",
          confirmed: true,
          deliveryKopecks,
          items: quantity ? [{ productId: source.productId, quantity }] : [],
        },
        authorId,
      );
      return first.orderRefund.findUniqueOrThrow({
        where: { orderId_requestId: { orderId: source.order.id, requestId } },
        include: { items: true, event: true },
      });
    }

    async function seedBalance(memberId: string, points: number) {
      return first.$transaction((tx) =>
        wallet.creditInTransaction(tx, {
          memberId,
          points,
          operationKey: `test:achievement-order-seed:${randomUUID()}`,
          sourceKey: `test:achievement-order-seed:${memberId}`,
          rulesVersion: "test-v1",
          occurredAt: new Date(),
        }),
      );
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

    it("earns before enrollment and credits the frozen archived badge exactly once after enrollment", async () => {
      const definition = await activateAchievement(first, authorId, {
        rewardPoints: 41,
      });
      const owner = await createOwner(first, { enrolled: false });
      await createWork(first, owner.user.id, await createColoring(first));
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).earnedAt,
        null,
      );
      assert.deepEqual(await badges().processUser(owner.user.id), {
        processed: true,
        badges: 1,
      });
      const badge = await first.achievementBadge.findUniqueOrThrow({
        where: {
          userId_definitionId: {
            userId: owner.user.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).earnedAt,
        badge.earnedAt.toISOString(),
      );
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: owner.user.id } }),
        0,
      );
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { badgeId: badge.id },
        }),
        0,
      );

      await drafts().update(definition.id, authorId, {
        ...achievementInput({ target: 8, rewardPoints: 99 }),
        expectedVersion: 1,
      });
      await drafts().activate(definition.id, authorId, 2);
      await drafts().archive(definition.id, 2);
      const member = await enroll(first, owner.user.id, "PENDING");
      assert.deepEqual(await awards().processMember(member.id), {
        processed: true,
        awards: 1,
      });
      assert.deepEqual(await awards().processMember(member.id), {
        processed: true,
        awards: 0,
      });
      const receipt = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: { badgeId: badge.id },
      });
      assert.equal(receipt.points, 41);
      assert.equal(receipt.revisionVersion, 1);
      assert.equal((await balance(member.id)).balancePoints, 41n);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: receipt.id },
        }),
        1,
      );
      assert.deepEqual(
        await first.achievementBadge.findUniqueOrThrow({
          where: { id: badge.id },
        }),
        badge,
      );
      await assert.rejects(
        first.achievementBadge.update({
          where: { id: badge.id },
          data: { rewardPoints: 99 },
        }),
      );
      await assert.rejects(
        first.achievementBadge.delete({ where: { id: badge.id } }),
      );
    });

    it("credits a persisted completed-order badge after the underlying order was fully returned", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        rewardPoints: 43,
      });
      const owner = await createOwner(first, { enrolled: false });
      const order = await createOrder(owner.user.id);
      await badges().processUser(owner.user.id);
      const before = await dashboardCard(owner.user.id, definition.id);
      await refundOrder(order, authorId, 1);
      await drafts().archive(definition.id, 1);
      const member = await enroll(first, owner.user.id, "PENDING");
      assert.deepEqual(await awards().processMember(member.id), {
        processed: true,
        awards: 1,
      });
      assert.equal((await balance(member.id)).balancePoints, 43n);
      assert.deepEqual(
        await dashboardCard(owner.user.id, definition.id),
        before,
      );
    });

    it("waits for qualification and then the unpaid badge even after archival before finalizing history", async () => {
      const definition = await activateAchievement(first, authorId, {
        rewardPoints: 47,
      });
      const owner = await createOwner(first);
      await createWork(first, owner.user.id, await createColoring(first));
      await workRewards().processMember(owner.member!.id);
      await purchaseHistory().processMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: false,
      });
      await badges().processUser(owner.user.id);
      await drafts().archive(definition.id, 1);
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: false,
      });
      await awards().processMember(owner.member!.id);
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: true,
      });
    });

    it("independent concurrent qualification awards once to a nonmember and rejects inactive users", async () => {
      const definition = await activateAchievement(first, authorId, {
        rewardPoints: 0,
      });
      const owner = await createOwner(first, { enrolled: false });
      await createWork(first, owner.user.id, await createColoring(first));
      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "BLOCKED" },
      });
      assert.deepEqual(await badges().processUser(owner.user.id), {
        processed: false,
        badges: 0,
      });
      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "ACTIVE" },
      });
      const concurrent = await Promise.allSettled([
        badges(first).processUser(owner.user.id),
        badges(second).processUser(owner.user.id),
      ]);
      assert.ok(concurrent.some((result) => result.status === "fulfilled"));
      assert.ok(
        concurrent.every(
          (result) =>
            result.status === "fulfilled" ||
            isSerializationConflict(result.reason),
        ),
      );
      await badges().processUser(owner.user.id);
      assert.equal(
        await first.achievementBadge.count({
          where: { userId: owner.user.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: owner.user.id } }),
        0,
      );
    });

    it("enforces activation versioning, supported conditions, archive state and idempotent audit", async () => {
      const versioned = await drafts().create(
        authorId,
        achievementInput({ target: 2_147_483_647, rewardPoints: 1 }),
      );
      await drafts().update(versioned.id, authorId, {
        ...achievementInput({ target: 2_147_483_647, rewardPoints: 2 }),
        expectedVersion: 1,
      });
      await assert.rejects(
        drafts().activate(versioned.id, authorId, 1),
        /version conflict/,
      );
      await drafts().activate(versioned.id, authorId, 2);
      const firstActivation =
        await first.loyaltyAchievementDefinition.findUniqueOrThrow({
          where: { id: versioned.id },
        });
      assert.equal(firstActivation.activeVersion, 2);
      assert.equal(firstActivation.activatedById, authorId);
      assert.ok(firstActivation.activatedAt);

      await drafts().activate(versioned.id, authorId, 2);
      const repeatedActivation =
        await first.loyaltyAchievementDefinition.findUniqueOrThrow({
          where: { id: versioned.id },
        });
      assert.equal(
        repeatedActivation.activatedAt?.getTime(),
        firstActivation.activatedAt.getTime(),
      );
      assert.equal(
        repeatedActivation.activatedById,
        firstActivation.activatedById,
      );
      await drafts().archive(versioned.id, 2);

      const archived = await drafts().create(
        authorId,
        achievementInput({ target: 2_147_483_647 }),
      );
      await drafts().archive(archived.id, 1);
      await assert.rejects(
        drafts().activate(archived.id, authorId, 1),
        /cannot be activated/,
      );
    });

    it("awards only at the distinct-coloring threshold and ignores a reupload of the same coloring", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 2,
        rewardPoints: 25,
      });
      const owner = await createOwner(first);
      const firstColoring = await createColoring(first);
      await createWork(first, owner.user.id, firstColoring);
      await createWork(first, owner.user.id, firstColoring, {
        attemptNumber: 2,
      });

      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        1,
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).earnedAt,
        null,
      );

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        0,
      );

      const secondColoring = await createColoring(first);
      await createWork(first, owner.user.id, secondColoring);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
        include: { operation: true },
      });
      assert.equal(award.revisionVersion, 1);
      const publicationFactId = award.publicationFactId;
      assert.ok(publicationFactId);
      const qualifyingFact =
        await first.workshopPublicationFact.findUniqueOrThrow({
          where: { id: publicationFactId },
        });
      assert.ok(
        [firstColoring.coloring.id, secondColoring.coloring.id].includes(
          qualifyingFact.coloringId,
        ),
      );
      assert.equal(
        award.qualifiedAt.getTime(),
        qualifyingFact.qualifiedAt.getTime(),
      );
      assert.equal(award.points, 25);
      assert.equal(award.operation?.kind, "CREDIT");
      assert.equal(award.operation?.requestedPoints, 25n);
      assert.equal(
        award.operation?.operationKey,
        `achievement:${owner.member!.id}:${definition.id}`,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      await drafts().archive(definition.id, 1);
    });

    it("counts five published colorings in one collection separately from two distinct collections", async () => {
      const publishedDefinition = await activateAchievement(first, authorId, {
        conditionKind: "published_coloring_count",
        target: 5,
        rewardPoints: 7,
      });
      const collectionDefinition = await activateAchievement(first, authorId, {
        conditionKind: "distinct_collection_count",
        target: 2,
        rewardPoints: 11,
      });
      const owner = await createOwner(first);
      const firstColoring = await createColoring(first);
      await createWork(first, owner.user.id, firstColoring);
      await createWork(first, owner.user.id, firstColoring, {
        attemptNumber: 2,
      });
      for (let number = 2; number <= 5; number += 1) {
        await createWork(
          first,
          owner.user.id,
          await createColoring(first, {
            collection: firstColoring.collection,
            number,
          }),
        );
      }

      const oneCollectionFacts = await first.workshopPublicationFact.findMany({
        where: { ownerId: owner.user.id },
        select: { collectionId: true, coloringId: true },
      });
      assert.equal(
        (await dashboardCard(owner.user.id, publishedDefinition.id)).progress,
        5,
      );
      assert.equal(
        (await dashboardCard(owner.user.id, collectionDefinition.id)).progress,
        1,
      );
      assert.equal(oneCollectionFacts.length, 6);
      assert.equal(
        new Set(oneCollectionFacts.map(({ collectionId }) => collectionId))
          .size,
        1,
      );
      assert.equal(
        new Set(oneCollectionFacts.map(({ coloringId }) => coloringId)).size,
        5,
      );
      assert.deepEqual(await workRewards().processMember(owner.member!.id), {
        processed: true,
        rewards: 5,
      });
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        5,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: {
            memberId: owner.member!.id,
            definitionId: publishedDefinition.id,
          },
        }),
        1,
      );
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: {
            memberId: owner.member!.id,
            definitionId: collectionDefinition.id,
          },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 132n);

      const secondCollectionColoring = await createColoring(first);
      await createWork(first, owner.user.id, secondCollectionColoring);
      assert.deepEqual(await workRewards().processMember(owner.member!.id), {
        processed: true,
        rewards: 1,
      });
      await qualifyMember(owner.member!.id);
      const concurrent = await Promise.allSettled([
        awards(first).processMember(owner.member!.id),
        awards(second).processMember(owner.member!.id),
      ]);
      assert.ok(concurrent.some(({ status }) => status === "fulfilled"));
      assert.ok(
        concurrent.filter(({ status }) => status === "rejected").length <= 1,
      );
      await qualifyMember(owner.member!.id);
      await awards().processMember(owner.member!.id);

      const collectionAward =
        await first.loyaltyAchievementAward.findUniqueOrThrow({
          where: {
            memberId_definitionId: {
              memberId: owner.member!.id,
              definitionId: collectionDefinition.id,
            },
          },
        });
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: collectionAward.id },
        }),
        1,
      );
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        6,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 168n);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      await drafts().archive(publishedDefinition.id, 1);
      await drafts().archive(collectionDefinition.id, 1);
    });

    it("retains the first-public collection snapshot after a raw coloring reassignment", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "distinct_collection_count",
        target: 2,
        rewardPoints: 13,
      });
      const owner = await createOwner(first);
      const original = await createColoring(first);
      const originalWork = await createWork(first, owner.user.id, original);
      const originalFact =
        await first.workshopPublicationFact.findUniqueOrThrow({
          where: { workId: originalWork.id },
        });
      const reassigned = await createCollection(first);
      await first.workshopCollection.create({
        data: {
          workshopId: originalWork.workshopId,
          collectionId: reassigned.collection.id,
        },
      });

      await first.coloring.update({
        where: { id: original.coloring.id },
        data: { collectionId: reassigned.collection.id },
      });
      assert.equal(
        (
          await first.workshopWork.findUniqueOrThrow({
            where: { id: originalWork.id },
          })
        ).collectionId,
        reassigned.collection.id,
      );
      assert.equal(
        (
          await first.workshopPublicationFact.findUniqueOrThrow({
            where: { id: originalFact.id },
          })
        ).collectionId,
        original.collection.id,
      );

      await createWork(
        first,
        owner.user.id,
        { ...original, collection: reassigned.collection },
        { attemptNumber: 2 },
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        1,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });

      const currentCollectionColoring = await createColoring(first, {
        collection: reassigned.collection,
        number: 2,
      });
      await createWork(first, owner.user.id, currentCollectionColoring);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      assert.equal((await balance(owner.member!.id)).balancePoints, 13n);
      await drafts().archive(definition.id, 1);
    });

    it("rejects a publication fact with a collection snapshot from another collection", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const privateWork = await createWork(first, owner.user.id, source, {
        workshopPublic: false,
      });
      const foreign = await createCollection(first);

      await assert.rejects(
        first.$transaction(async (tx) => {
          await tx.workshop.update({
            where: { id: privateWork.workshopId },
            data: { isPublic: true },
          });
          await tx.$executeRaw`
            INSERT INTO workshop_publication_facts
              (id, work_id, revision_id, owner_id, coloring_id, collection_id)
            VALUES
              (${randomUUID()}, ${privateWork.id}, ${privateWork.revisionId},
               ${owner.user.id}, ${source.coloring.id}, ${foreign.collection.id})
          `;
        }),
      );
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: privateWork.id },
        }),
        0,
      );
      assert.equal(
        (
          await first.workshop.findUniqueOrThrow({
            where: { id: privateWork.workshopId },
          })
        ).isPublic,
        false,
      );
    });

    it("freezes exact album slots and requires every distinct picture before one durable award", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_collection_count",
        target: 1,
        rewardPoints: 31,
      });
      const partialOwner = await createOwner(first);
      const oneOfTwentyFive = await createColoring(first);
      await createWork(first, partialOwner.user.id, oneOfTwentyFive);
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: oneOfTwentyFive.collection.id },
        }),
        0,
      );
      await assert.rejects(
        first.$transaction(async (tx) => {
          await tx.$executeRaw`
            INSERT INTO coloring_collection_manifests
              (collection_id, version, expected_coloring_count)
            VALUES
              (${oneOfTwentyFive.collection.id}, 1, 25)
          `;
          await tx.$executeRaw`
            INSERT INTO coloring_collection_manifest_items
              (collection_id, number, coloring_id, revision_id)
            VALUES
              (${oneOfTwentyFive.collection.id}, 1,
               ${oneOfTwentyFive.coloring.id}, ${oneOfTwentyFive.revision.id})
          `;
        }),
      );
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: oneOfTwentyFive.collection.id },
        }),
        0,
      );
      await qualifyMember(partialOwner.member!.id);
      assert.deepEqual(await awards().processMember(partialOwner.member!.id), {
        processed: true,
        awards: 0,
      });

      const concurrentAlbum = await createCollection(first, {
        expectedColoringCount: 2,
      });
      const concurrentFirstCard = await createColoringCard(
        first,
        concurrentAlbum.collection,
        1,
      );
      const concurrentSecondCard = await createColoringCard(
        first,
        concurrentAlbum.collection,
        2,
      );
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: concurrentAlbum.collection.id },
        }),
        0,
      );
      await Promise.all([
        first.coloringRevision.create({
          data: coloringRevisionData(concurrentFirstCard.id),
        }),
        second.coloringRevision.create({
          data: coloringRevisionData(concurrentSecondCard.id),
        }),
      ]);
      assert.equal(
        (
          await first.coloringCollectionManifest.findUniqueOrThrow({
            where: { collectionId: concurrentAlbum.collection.id },
            include: { items: true },
          })
        ).items.length,
        2,
      );

      const owner = await createOwner(first);
      const album = await createCollection(first, {
        expectedColoringCount: 2,
      });
      const firstPicture = await createColoring(first, {
        collection: album.collection,
        number: 1,
      });
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: album.collection.id },
        }),
        0,
      );
      const secondCard = await createColoringCard(first, album.collection, 2);
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: album.collection.id },
        }),
        0,
      );
      const secondRevision = await first.coloringRevision.create({
        data: coloringRevisionData(secondCard.id),
      });
      await first.coloring.update({
        where: { id: secondCard.id },
        data: {
          status: "PUBLISHED",
          publishedRevisionId: secondRevision.id,
          publishedAt: new Date(),
        },
      });
      const secondPicture = {
        ...album,
        coloring: secondCard,
        revision: secondRevision,
      };
      const frozen = await first.coloringCollectionManifest.findUniqueOrThrow({
        where: { collectionId: album.collection.id },
        include: { items: { orderBy: { number: "asc" } } },
      });
      assert.equal(frozen.expectedColoringCount, 2);
      assert.deepEqual(
        frozen.items.map(({ number, coloringId }) => ({ number, coloringId })),
        [
          { number: 1, coloringId: firstPicture.coloring.id },
          { number: 2, coloringId: secondPicture.coloring.id },
        ],
      );

      await first.coloringCollection.update({
        where: { id: album.collection.id },
        data: { expectedColoringCount: 3 },
      });
      await createColoring(first, {
        collection: album.collection,
        number: 3,
      });
      assert.equal(
        (
          await first.coloringCollectionManifest.findUniqueOrThrow({
            where: { collectionId: album.collection.id },
            include: { items: true },
          })
        ).items.length,
        2,
      );

      const firstWork = await createWork(first, owner.user.id, firstPicture);
      const repeatedWork = await createWork(
        first,
        owner.user.id,
        firstPicture,
        { attemptNumber: 2 },
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        0,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      const firstFact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: firstWork.id },
      });
      await assert.rejects(
        first.achievementBadge.create({
          data: {
            userId: owner.user.id,
            definitionId: definition.id,
            revisionVersion: 1,
            publicationFactId: firstFact.id,
            completionCollectionId: album.collection.id,
            rewardPoints: 31,
            qualifiedAt: firstFact.qualifiedAt,
          },
        }),
      );

      const secondWork = await createWork(first, owner.user.id, secondPicture);
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        1,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
        include: { operation: true, completionManifest: true },
      });
      assert.equal(award.completionCollectionId, album.collection.id);
      assert.equal(award.completionManifest?.version, 1);
      assert.equal(award.operation?.requestedPoints, 31n);
      assert.equal((await balance(owner.member!.id)).balancePoints, 31n);

      await hideWork(first, firstWork.id, firstWork.revisionId);
      await hideWork(first, repeatedWork.id, repeatedWork.revisionId);
      await hideWork(first, secondWork.id, secondWork.revisionId);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 31n);
      await drafts().archive(definition.id, 1);
    });

    it("captures an atomic manifest under immediate constraints and rejects a later same-transaction composition change", async () => {
      const immediateAlbum = await createCollection(first, {
        expectedColoringCount: 2,
      });
      const immediateFirstCard = await createColoringCard(
        first,
        immediateAlbum.collection,
        1,
      );
      const immediateSecondCard = await createColoringCard(
        first,
        immediateAlbum.collection,
        2,
      );
      await first.coloringRevision.create({
        data: coloringRevisionData(immediateFirstCard.id),
      });

      await first.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
        await tx.coloringRevision.create({
          data: coloringRevisionData(immediateSecondCard.id),
        });
      });
      assert.equal(
        (
          await first.coloringCollectionManifest.findUniqueOrThrow({
            where: { collectionId: immediateAlbum.collection.id },
            include: { items: true },
          })
        ).items.length,
        2,
      );

      const changedAlbum = await createCollection(first, {
        expectedColoringCount: 2,
      });
      const changedFirstCard = await createColoringCard(
        first,
        changedAlbum.collection,
        1,
      );
      const changedSecondCard = await createColoringCard(
        first,
        changedAlbum.collection,
        2,
      );
      await first.coloringRevision.create({
        data: coloringRevisionData(changedFirstCard.id),
      });
      const rolledBackRevision = coloringRevisionData(changedSecondCard.id);

      await assert.rejects(
        first.$transaction(async (tx) => {
          await tx.coloringRevision.create({ data: rolledBackRevision });
          await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
          await tx.coloringCollection.update({
            where: { id: changedAlbum.collection.id },
            data: { expectedColoringCount: 3 },
          });
        }),
        /exact complete uploaded source composition/,
      );
      assert.equal(
        await first.coloringCollectionManifest.count({
          where: { collectionId: changedAlbum.collection.id },
        }),
        0,
      );
      assert.equal(
        await first.coloringRevision.count({
          where: { id: rolledBackRevision.id },
        }),
        0,
      );
      assert.equal(
        (
          await first.coloringCollection.findUniqueOrThrow({
            where: { id: changedAlbum.collection.id },
          })
        ).expectedColoringCount,
        2,
      );
    });

    it("awards once after the configured number of independently completed albums", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_collection_count",
        target: 2,
        rewardPoints: 9,
      });
      const owner = await createOwner(first);
      const firstAlbum = await createCollection(first, {
        expectedColoringCount: 1,
      });
      await createWork(
        first,
        owner.user.id,
        await createColoring(first, { collection: firstAlbum.collection }),
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        1,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });

      const secondAlbum = await createCollection(first, {
        expectedColoringCount: 1,
      });
      await createWork(
        first,
        owner.user.id,
        await createColoring(first, { collection: secondAlbum.collection }),
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        2,
      );
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).earnedAt,
        null,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal((await balance(owner.member!.id)).balancePoints, 9n);
      await drafts().archive(definition.id, 1);
    });

    it("records a zero-point completed-album badge without a wallet operation", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_collection_count",
        target: 1,
        rewardPoints: 0,
      });
      const owner = await createOwner(first);
      const album = await createCollection(first, {
        expectedColoringCount: 1,
      });
      await createWork(
        first,
        owner.user.id,
        await createColoring(first, { collection: album.collection }),
      );

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(award.completionCollectionId, album.collection.id);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: award.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      await drafts().archive(definition.id, 1);
    });

    it("excludes unpaid and unfinished orders from completed-order progress", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 3,
      });
      const owner = await createOwner(first);
      const unpaid = await createOrder(owner.user.id, { paid: false });
      const unfinished = await createOrder(owner.user.id, {
        completed: false,
      });
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        0,
      );
      assert.equal((await dashboard(owner.user.id)).tier?.spendKopecks, 0);

      assert.equal(
        await first.orderCompletionFact.count({
          where: { orderId: { in: [unpaid.order.id, unfinished.order.id] } },
        }),
        0,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      await drafts().archive(definition.id, 1);
    });

    it("counts retained completed orders once across quantities, discounts, spending and pre-award returns", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 2,
        rewardPoints: 29,
      });
      const owner = await createOwner(first, { historyState: "READY" });
      await seedBalance(owner.member!.id, 100);

      const fullyReturned = await createOrder(owner.user.id, { quantity: 3 });
      await refundOrder(fullyReturned, authorId, 3);
      const partiallyReturned = await createOrder(owner.user.id, {
        quantity: 3,
        promoKopecks: 100,
        spendMemberId: owner.member!.id,
      });
      await refundOrder(partiallyReturned, authorId, 2);
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        1,
      );

      const facts = await first.orderCompletionFact.findMany({
        where: {
          orderId: {
            in: [fullyReturned.order.id, partiallyReturned.order.id],
          },
        },
        include: { items: true },
      });
      assert.equal(facts.length, 2);
      assert.ok(facts.every(({ totalQuantity }) => totalQuantity === 3));
      assert.ok(facts.every(({ items }) => items.length === 1));
      assert.deepEqual(
        await first.orderCompletionEligibility.findMany({
          where: {
            orderId: {
              in: [fullyReturned.order.id, partiallyReturned.order.id],
            },
          },
          select: { orderId: true, retainedQuantity: true, isEligible: true },
          orderBy: { orderId: "asc" },
        }),
        [
          {
            orderId: fullyReturned.order.id,
            retainedQuantity: 0,
            isEligible: false,
          },
          {
            orderId: partiallyReturned.order.id,
            retainedQuantity: 1,
            isEligible: true,
          },
        ].sort((left, right) => left.orderId.localeCompare(right.orderId)),
      );
      await assert.rejects(
        first.orderCompletionEligibility.update({
          where: { orderId: fullyReturned.order.id },
          data: { retainedQuantity: 1, isEligible: true },
        }),
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });

      const deliveryOnlyReturn = await createOrder(owner.user.id, {
        quantity: 4,
        deliveryKopecks: 500,
      });
      await refundOrder(deliveryOnlyReturn, authorId, 0, 500);
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        2,
      );
      assert.deepEqual(
        await first.orderCompletionEligibility.findUniqueOrThrow({
          where: { orderId: deliveryOnlyReturn.order.id },
          select: { retainedQuantity: true, isEligible: true },
        }),
        { retainedQuantity: 4, isEligible: true },
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
        include: { operation: true },
      });
      assert.equal(award.publicationFactId, null);
      assert.equal(award.completionCollectionId, null);
      assert.ok(
        [partiallyReturned.order.id, deliveryOnlyReturn.order.id].includes(
          award.completionOrderId!,
        ),
      );
      assert.equal(award.operation?.requestedPoints, 29n);
      assert.equal((await balance(owner.member!.id)).balancePoints, 124n);

      await refundOrder(partiallyReturned, authorId, 1);
      await refundOrder(deliveryOnlyReturn, authorId, 4);
      assert.equal(
        (await dashboardCard(owner.user.id, definition.id)).progress,
        2,
      );
      assert.ok((await dashboardCard(owner.user.id, definition.id)).earnedAt);
      assert.equal((await dashboard(owner.user.id)).tier?.spendKopecks, 0);
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 124n);
      await drafts().archive(definition.id, 1);
    });

    it("awards pre-enrollment order history once under concurrent workers and rejects a cross-owner proof", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 17,
      });
      const owner = await createOwner(first, { enrolled: false });
      const historical = await createOrder(owner.user.id);
      const fact = await first.orderCompletionFact.findUniqueOrThrow({
        where: { orderId: historical.order.id },
      });
      const foreign = await createOwner(first);
      await assert.rejects(
        first.achievementBadge.create({
          data: {
            userId: foreign.user.id,
            definitionId: definition.id,
            revisionVersion: 1,
            publicationFactId: null,
            completionOrderId: historical.order.id,
            rewardPoints: 17,
            qualifiedAt: fact.qualifiedAt,
          },
        }),
      );
      await assert.rejects(
        first.orderCompletionFact.update({
          where: { orderId: historical.order.id },
          data: { userId: foreign.user.id },
        }),
      );

      const member = await enroll(first, owner.user.id, "PENDING");
      await qualifyMember(member.id);
      const concurrent = await Promise.allSettled([
        awards(first).processMember(member.id),
        awards(second).processMember(member.id),
      ]);
      assert.ok(concurrent.some(({ status }) => status === "fulfilled"));
      assert.ok(
        concurrent.filter(({ status }) => status === "rejected").length <= 1,
      );
      await qualifyMember(member.id);
      await awards().processMember(member.id);
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: member.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(award.completionOrderId, historical.order.id);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: award.id },
        }),
        1,
      );
      assert.equal((await balance(member.id)).balancePoints, 17n);

      await refundOrder(historical, authorId, 1);
      await qualifyMember(member.id);
      assert.deepEqual(await awards().processMember(member.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: member.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal((await balance(member.id)).balancePoints, 17n);
      await drafts().archive(definition.id, 1);
    });

    it("records a zero-point completed-order badge without a wallet operation", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 0,
      });
      const owner = await createOwner(first);
      const source = await createOrder(owner.user.id);

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(award.completionOrderId, source.order.id);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: award.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      await drafts().archive(definition.id, 1);
    });

    it("allows an enrolled admin to refund their own order during award processing without a lock inversion", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 13,
      });
      const owner = await createOwner(first);
      await first.user.update({
        where: { id: owner.user.id },
        data: { roles: ["ADMIN"] },
      });
      const source = await createOrder(owner.user.id);

      await qualifyMember(owner.member!.id);
      const settled = await Promise.allSettled([
        awards(second).processMember(owner.member!.id),
        refundOrder(source, owner.user.id, 1),
      ]);
      assert.equal(settled[1]?.status, "fulfilled");
      assert.equal(
        (
          await first.orderCompletionEligibility.findUniqueOrThrow({
            where: { orderId: source.order.id },
          })
        ).isEligible,
        false,
      );
      await qualifyMember(owner.member!.id);
      await awards().processMember(owner.member!.id);
      const awardCount = await first.loyaltyAchievementAward.count({
        where: { memberId: owner.member!.id, definitionId: definition.id },
      });
      assert.ok(awardCount === 0 || awardCount === 1);
      assert.equal(
        await first.loyaltyOperation.count({
          where: {
            memberId: owner.member!.id,
            achievementAwardId: { not: null },
          },
        }),
        awardCount,
      );
      assert.equal(
        (await balance(owner.member!.id)).balancePoints,
        awardCount === 1 ? 13n : 0n,
      );
      await drafts().archive(definition.id, 1);
    });

    it("fences a stale badge attempt behind a refund that already holds the order lock", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 37,
      });
      const owner = await createOwner(first);
      const source = await createOrder(owner.user.id);
      let confirmAuthorLock!: () => void;
      let releaseAuthorLock!: () => void;
      const authorLocked = new Promise<void>((resolve) => {
        confirmAuthorLock = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseAuthorLock = resolve;
      });
      const authorBarrier = first.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${authorId} FOR UPDATE`;
        confirmAuthorLock();
        await release;
      });
      await authorLocked;

      const refundAttempt = Promise.allSettled([
        refundOrder(source, authorId, 1),
      ]);
      let settledAwardAttempt:
        | Promise<
            PromiseSettledResult<{ processed: boolean; badges: number }>[]
          >
        | undefined;
      try {
        await waitForBlockedQuery("order_refunds");
        settledAwardAttempt = Promise.allSettled([
          badges(second).processUser(owner.user.id),
        ]);
        await waitForBlockedQuery("SELECT id FROM orders WHERE user_id");
      } finally {
        releaseAuthorLock();
      }

      await authorBarrier;
      const settledRefund = await refundAttempt;
      assert.equal(settledRefund[0]?.status, "fulfilled");
      assert.ok(settledAwardAttempt);
      const firstAwardAttempt = await settledAwardAttempt;
      const awardResult = firstAwardAttempt[0];
      assert.ok(
        awardResult?.status === "fulfilled"
          ? awardResult.value.badges === 0
          : awardResult?.status === "rejected" &&
              isSerializationConflict(awardResult.reason),
        `Unexpected stale badge result: ${inspect(awardResult, { depth: 8 })}`,
      );
      assert.equal(
        (
          await first.orderCompletionEligibility.findUniqueOrThrow({
            where: { orderId: source.order.id },
          })
        ).isEligible,
        false,
      );
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      await drafts().archive(definition.id, 1);
    });

    it("defers an existing qualification while member, history, or owner eligibility is inactive", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 7,
      });
      const owner = await createOwner(first);
      const source = await createColoring(first);
      await createWork(first, owner.user.id, source);

      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { status: "BLOCKED" },
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: false,
        awards: 0,
      });
      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { status: "ACTIVE", historyState: "FAILED" },
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: false,
        awards: 0,
      });
      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { historyState: "PENDING" },
      });
      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "BLOCKED" },
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: false,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        0,
      );

      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "ACTIVE" },
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: owner.member!.id },
          })
        ).historyState,
        "PENDING",
      );

      const ready = await createOwner(first, { historyState: "READY" });
      await createWork(first, ready.user.id, await createColoring(first));
      await qualifyMember(ready.member!.id);
      assert.deepEqual(await awards().processMember(ready.member!.id), {
        processed: true,
        awards: 1,
      });
      await drafts().archive(definition.id, 1);
    });

    it("serializes concurrent workers to one award and one wallet operation", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 11,
      });
      const owner = await createOwner(first);
      await createWork(first, owner.user.id, await createColoring(first));

      await qualifyMember(owner.member!.id);
      const results = await Promise.allSettled([
        awards(first).processMember(owner.member!.id),
        awards(second).processMember(owner.member!.id),
      ]);
      assert.ok(results.some(({ status }) => status === "fulfilled"));
      assert.ok(
        results.filter(({ status }) => status === "rejected").length <= 1,
      );
      await qualifyMember(owner.member!.id);
      await awards().processMember(owner.member!.id);
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: award.id },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 11n);
      assert.equal((await balance(owner.member!.id)).revision, 1n);
      await drafts().archive(definition.id, 1);
    });

    it("records a zero-point badge without creating a wallet ledger entry", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 0,
      });
      const owner = await createOwner(first);
      await createWork(first, owner.user.id, await createColoring(first));

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
      });
      assert.equal(award.points, 0);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { achievementAwardId: award.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      assert.equal((await balance(owner.member!.id)).revision, 0n);
      await drafts().archive(definition.id, 1);
    });

    it("retains an existing award on archive and prevents a not-yet-qualified member from earning later", async () => {
      const retained = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 5,
      });
      const awardedOwner = await createOwner(first);
      await createWork(
        first,
        awardedOwner.user.id,
        await createColoring(first),
      );
      await qualifyMember(awardedOwner.member!.id);
      await awards().processMember(awardedOwner.member!.id);
      await drafts().archive(retained.id, 1);
      const archivedCard = await dashboardCard(
        awardedOwner.user.id,
        retained.id,
      );
      assert.equal(archivedCard.rewardPoints, 5);
      assert.equal(archivedCard.progress, 1);
      assert.ok(archivedCard.earnedAt);
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: {
            memberId: awardedOwner.member!.id,
            definitionId: retained.id,
          },
        }),
        1,
      );
      assert.equal((await balance(awardedOwner.member!.id)).balancePoints, 5n);

      const stopped = await activateAchievement(first, authorId, {
        target: 2,
        rewardPoints: 13,
      });
      const pendingOwner = await createOwner(first);
      await createWork(
        first,
        pendingOwner.user.id,
        await createColoring(first),
      );
      await qualifyMember(pendingOwner.member!.id);
      assert.deepEqual(await awards().processMember(pendingOwner.member!.id), {
        processed: true,
        awards: 0,
      });
      await drafts().archive(stopped.id, 1);
      assert.ok(
        !(await achievements(pendingOwner.user.id)).achievements.some(
          (card) => card.id === stopped.id,
        ),
      );
      await createWork(
        first,
        pendingOwner.user.id,
        await createColoring(first),
      );
      await qualifyMember(pendingOwner.member!.id);
      assert.deepEqual(await awards().processMember(pendingOwner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: {
            memberId: pendingOwner.member!.id,
            definitionId: stopped.id,
          },
        }),
        0,
      );
    });

    it("keeps the active revision fixed across edits and does not re-award after explicit reactivation", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 7,
      });
      const changed = await drafts().update(definition.id, authorId, {
        ...achievementInput({ target: 2, rewardPoints: 99 }),
        expectedVersion: 1,
      });
      assert.equal(changed.version, 2);
      assert.equal(changed.activeVersion, 1);

      const firstOwner = await createOwner(first);
      const beforeAward = await dashboardCard(
        firstOwner.user.id,
        definition.id,
      );
      assert.equal(beforeAward.target, 1, "Draft target must not leak");
      assert.equal(beforeAward.rewardPoints, 7, "Draft reward must not leak");
      await createWork(first, firstOwner.user.id, await createColoring(first));
      await qualifyMember(firstOwner.member!.id);
      await awards().processMember(firstOwner.member!.id);
      const originalAward =
        await first.loyaltyAchievementAward.findUniqueOrThrow({
          where: {
            memberId_definitionId: {
              memberId: firstOwner.member!.id,
              definitionId: definition.id,
            },
          },
        });
      assert.equal(originalAward.revisionVersion, 1);
      assert.equal(originalAward.points, 7);

      await drafts().activate(definition.id, authorId, 2);
      const retainedRevision = await dashboardCard(
        firstOwner.user.id,
        definition.id,
      );
      assert.equal(retainedRevision.target, 1);
      assert.equal(retainedRevision.rewardPoints, 7);
      assert.equal(
        retainedRevision.earnedAt,
        (
          await first.achievementBadge.findUniqueOrThrow({
            where: { id: originalAward.badgeId },
          })
        ).earnedAt.toISOString(),
      );
      await qualifyMember(firstOwner.member!.id);
      assert.deepEqual(await awards().processMember(firstOwner.member!.id), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: {
            memberId: firstOwner.member!.id,
            definitionId: definition.id,
          },
        }),
        1,
      );

      const secondOwner = await createOwner(first);
      const currentRevision = await dashboardCard(
        secondOwner.user.id,
        definition.id,
      );
      assert.equal(currentRevision.target, 2);
      assert.equal(currentRevision.rewardPoints, 99);
      await createWork(first, secondOwner.user.id, await createColoring(first));
      await qualifyMember(secondOwner.member!.id);
      assert.deepEqual(await awards().processMember(secondOwner.member!.id), {
        processed: true,
        awards: 0,
      });
      await createWork(first, secondOwner.user.id, await createColoring(first));
      await qualifyMember(secondOwner.member!.id);
      assert.deepEqual(await awards().processMember(secondOwner.member!.id), {
        processed: true,
        awards: 1,
      });
      const currentAward =
        await first.loyaltyAchievementAward.findUniqueOrThrow({
          where: {
            memberId_definitionId: {
              memberId: secondOwner.member!.id,
              definitionId: definition.id,
            },
          },
        });
      assert.equal(currentAward.revisionVersion, 2);
      assert.equal(currentAward.points, 99);
      await drafts().archive(definition.id, 2);
    });

    it("backfills a pre-enrollment qualification after its works are hidden", async () => {
      const definition = await activateAchievement(first, authorId, {
        conditionKind: "distinct_collection_count",
        target: 2,
        rewardPoints: 17,
      });
      const owner = await createOwner(first, { enrolled: false });
      const firstWork = await createWork(
        first,
        owner.user.id,
        await createColoring(first),
      );
      const secondWork = await createWork(
        first,
        owner.user.id,
        await createColoring(first),
      );
      await hideWork(first, firstWork.id, firstWork.revisionId);
      await hideWork(first, secondWork.id, secondWork.revisionId);
      const member = await enroll(first, owner.user.id, "PENDING");

      // The reused database can contain more than one global worker batch of
      // older eligible members. This scenario verifies this owner's backfill;
      // automatic batch discovery has separate worker tests.
      await qualifyMember(member.id);
      assert.deepEqual(await awards().processMember(member.id), {
        processed: true,
        awards: 1,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: member.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal((await balance(member.id)).balancePoints, 17n);
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: member.id },
          })
        ).historyState,
        "PENDING",
      );
      await drafts().archive(definition.id, 1);
    });

    it("rolls back award and wallet credit atomically and succeeds on retry", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 23,
      });
      const owner = await createOwner(first);
      await createWork(first, owner.user.id, await createColoring(first));
      const failingWallet = new LoyaltyWalletService();
      failingWallet.creditAchievementInTransaction = async (tx, input) => {
        await wallet.creditAchievementInTransaction(tx, input);
        throw new Error("Injected achievement-credit failure");
      };

      await qualifyMember(owner.member!.id);
      await assert.rejects(
        awards(first, failingWallet).processMember(owner.member!.id),
        /Injected achievement-credit failure/,
      );
      assert.equal(
        await first.achievementBadge.count({
          where: { userId: owner.user.id, definitionId: definition.id },
        }),
        1,
      );
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id, definitionId: definition.id },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyOperation.count({
          where: {
            memberId: owner.member!.id,
            achievementAwardId: { not: null },
          },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      const sync = await first.loyaltyAchievementSync.findUniqueOrThrow({
        where: { memberId: owner.member!.id },
      });
      assert.equal(sync.attempts, 1);
      assert.equal(sync.lastError, "achievement_processing_failed");

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id), {
        processed: true,
        awards: 1,
      });
      assert.equal((await balance(owner.member!.id)).balancePoints, 23n);
      await drafts().archive(definition.id, 1);
    });

    it("honors the award batch limit across multiple eligible definitions", async () => {
      const firstDefinition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 2,
      });
      const secondDefinition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 3,
      });
      const owner = await createOwner(first);
      await createWork(first, owner.user.id, await createColoring(first));
      await workRewards().processMember(owner.member!.id);
      await purchaseHistory().processMember(owner.member!.id);

      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id, 1), {
        processed: true,
        awards: 1,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id },
        }),
        1,
      );
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: false,
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id, 1), {
        processed: true,
        awards: 1,
      });
      await qualifyMember(owner.member!.id);
      assert.deepEqual(await awards().processMember(owner.member!.id, 1), {
        processed: true,
        awards: 0,
      });
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { memberId: owner.member!.id },
        }),
        2,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 30n);
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: true,
      });
      await drafts().archive(firstDefinition.id, 1);
      await drafts().archive(secondDefinition.id, 1);
    });

    it("rejects forged cross-member awards, orphan positive awards, generic keys and immutable ledger mutations", async () => {
      const definition = await activateAchievement(first, authorId, {
        target: 1,
        rewardPoints: 19,
      });
      const owner = await createOwner(first);
      const work = await createWork(
        first,
        owner.user.id,
        await createColoring(first),
      );
      const fact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: work.id },
      });
      const foreign = await createOwner(first);
      await badges().processUser(owner.user.id);
      const badge = await first.achievementBadge.findUniqueOrThrow({
        where: {
          userId_definitionId: {
            userId: owner.user.id,
            definitionId: definition.id,
          },
        },
      });

      await assert.rejects(
        first.loyaltyAchievementAward.create({
          data: {
            badgeId: badge.id,
            memberId: foreign.member!.id,
            definitionId: definition.id,
            revisionVersion: 1,
            publicationFactId: fact.id,
            points: 19,
            qualifiedAt: fact.qualifiedAt,
          },
        }),
      );
      await assert.rejects(
        first.loyaltyAchievementAward.create({
          data: {
            badgeId: badge.id,
            memberId: owner.member!.id,
            definitionId: definition.id,
            revisionVersion: 1,
            publicationFactId: fact.id,
            points: 19,
            qualifiedAt: fact.qualifiedAt,
          },
        }),
      );
      assert.equal(
        await first.loyaltyAchievementAward.count({
          where: { definitionId: definition.id },
        }),
        0,
      );

      await assert.rejects(
        first.$transaction((tx) =>
          wallet.creditInTransaction(tx, {
            memberId: owner.member!.id,
            points: 19,
            operationKey: `achievement:${owner.member!.id}:${definition.id}`,
            sourceKey: `achievement:${owner.member!.id}:${definition.id}`,
            rulesVersion: "achievement-v1",
            occurredAt: new Date(),
          }),
        ),
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);

      await qualifyMember(owner.member!.id);
      await awards().processMember(owner.member!.id);
      const award = await first.loyaltyAchievementAward.findUniqueOrThrow({
        where: {
          memberId_definitionId: {
            memberId: owner.member!.id,
            definitionId: definition.id,
          },
        },
      });
      await assert.rejects(
        first.loyaltyAchievementAward.update({
          where: { id: award.id },
          data: { points: 20 },
        }),
      );
      await assert.rejects(
        first.loyaltyOperation.update({
          where: { achievementAwardId: award.id },
          data: { sourceKey: `tampered:${randomUUID()}` },
        }),
      );
      await assert.rejects(
        first.loyaltyAchievementAward.delete({ where: { id: award.id } }),
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 19n);
      await drafts().archive(definition.id, 1);
    });
  },
);

type CreatedColoring = Awaited<ReturnType<typeof createColoring>>;

function achievementInput(
  options: {
    conditionKind?:
      | "published_coloring_count"
      | "distinct_collection_count"
      | "completed_collection_count"
      | "completed_order_count";
    target?: number;
    rewardPoints?: number;
  } = {},
) {
  return {
    title: `Published colorings ${randomUUID()}`,
    description: "Published coloring count fixture",
    imageUrl: null,
    conditionKind:
      options.conditionKind ?? ("published_coloring_count" as const),
    target: options.target ?? 1,
    rewardPoints: options.rewardPoints ?? 25,
    sortOrder: 0,
  };
}

async function activateAchievement(
  client: PrismaClient,
  authorId: string,
  options: {
    conditionKind?:
      | "published_coloring_count"
      | "distinct_collection_count"
      | "completed_collection_count"
      | "completed_order_count";
    target?: number;
    rewardPoints?: number;
  } = {},
) {
  const service = new LoyaltyAchievementDraftsService(
    client as unknown as PrismaService,
  );
  const created = await service.create(authorId, achievementInput(options));
  await service.activate(created.id, authorId, created.version);
  return client.loyaltyAchievementDefinition.findUniqueOrThrow({
    where: { id: created.id },
  });
}

async function createOwner(
  client: PrismaClient,
  options: {
    enrolled?: boolean;
    historyState?: "PENDING" | "READY";
  } = {},
) {
  const user = await client.user.create({ data: { status: "ACTIVE" } });
  const member =
    options.enrolled === false
      ? null
      : await enroll(client, user.id, options.historyState ?? "PENDING");
  return { user, member };
}

async function enroll(
  client: PrismaClient,
  userId: string,
  historyState: "PENDING" | "READY",
) {
  return client.loyaltyMember.create({
    data: {
      userId,
      termsVersion: "loyalty-v1",
      historyState,
      wallet: { create: {} },
    },
  });
}

async function createCollection(
  client: PrismaClient,
  options: { expectedColoringCount?: number } = {},
) {
  const token = id();
  const product = await client.product.create({
    data: {
      id: token,
      slug: `achievement-${token}`,
      title: "Achievement fixture",
      description: "Achievement fixture",
      status: "PUBLISHED",
      price: 1_000,
    },
  });
  const collection = await client.coloringCollection.create({
    data: {
      id: id(),
      productId: product.id,
      slug: `achievement-collection-${token}`,
      title: "Achievement collection",
      description: "Achievement collection",
      expectedColoringCount: options.expectedColoringCount ?? 25,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  return { product, collection };
}

async function createColoring(
  client: PrismaClient,
  options: {
    collection?: { id: string; productId: string };
    number?: number;
  } = {},
) {
  const source = options.collection
    ? {
        collection: await client.coloringCollection.findUniqueOrThrow({
          where: { id: options.collection.id },
        }),
        product: await client.product.findUniqueOrThrow({
          where: { id: options.collection.productId },
        }),
      }
    : await createCollection(client);
  const { collection, product } = source;
  const number = options.number ?? 1;
  const coloring = await createColoringCard(client, collection, number);
  const revision = await client.coloringRevision.create({
    data: coloringRevisionData(coloring.id),
  });
  await client.coloring.update({
    where: { id: coloring.id },
    data: {
      status: "PUBLISHED",
      publishedRevisionId: revision.id,
      publishedAt: new Date(),
    },
  });
  return { product, collection, coloring, revision };
}

async function createColoringCard(
  client: PrismaClient,
  collection: { id: string },
  number: number,
) {
  return client.coloring.create({
    data: {
      id: id(),
      collectionId: collection.id,
      number,
      title: "Achievement coloring",
      position: number,
      status: "DRAFT",
    },
  });
}

async function createWork(
  client: PrismaClient,
  ownerId: string,
  source: CreatedColoring,
  options: { attemptNumber?: number; workshopPublic?: boolean } = {},
) {
  const workshop = await client.workshop.upsert({
    where: { ownerId },
    create: {
      id: id(),
      ownerId,
      handle: id().slice(0, 20),
      isPublic: options.workshopPublic ?? true,
    },
    update:
      options.workshopPublic === undefined
        ? {}
        : { isPublic: options.workshopPublic },
  });
  await client.workshopCollection.upsert({
    where: {
      workshopId_collectionId: {
        workshopId: workshop.id,
        collectionId: source.collection.id,
      },
    },
    create: {
      workshopId: workshop.id,
      collectionId: source.collection.id,
    },
    update: {},
  });
  const work = await client.workshopWork.create({
    data: {
      id: id(),
      publicId: id().slice(0, 24),
      workshopId: workshop.id,
      collectionId: source.collection.id,
      coloringId: source.coloring.id,
      attemptNumber: options.attemptNumber ?? 1,
    },
  });
  const revisionId = id();
  await createWorkshopRevision(client, {
    id: revisionId,
    workId: work.id,
    coloringId: source.coloring.id,
    officialRevisionId: source.revision.id,
  });
  await client.workshopWork.update({
    where: { id: work.id },
    data: {
      currentRevisionId: revisionId,
      publishedRevisionId: revisionId,
      isPublicationEnabled: true,
      publishedAt: new Date(),
    },
  });
  return { ...work, revisionId };
}

async function createWorkshopRevision(
  client: PrismaClient,
  input: {
    id: string;
    workId: string;
    coloringId: string;
    officialRevisionId: string;
  },
) {
  const now = new Date();
  return client.workshopWorkRevision.create({
    data: {
      id: input.id,
      workId: input.workId,
      coloringId: input.coloringId,
      sequence: 1,
      officialRevisionId: input.officialRevisionId,
      status: "APPROVED",
      publicationConsent: true,
      publicationConsentAt: now,
      cropRotation: 0,
      cropZoom: 1,
      cropX: 0,
      cropY: 0,
      sourceMime: "image/jpeg",
      sourceChecksum: "1".repeat(64),
      normalizedStorageKey: `${input.workId}/${input.id}/normalized-${"2".repeat(64)}.webp`,
      normalizedChecksum: "2".repeat(64),
      normalizedByteSize: 10,
      normalizedWidth: 800,
      normalizedHeight: 1_000,
      webStorageKey: `${input.workId}/${input.id}/web-${"3".repeat(64)}.webp`,
      webChecksum: "3".repeat(64),
      webByteSize: 10,
      webWidth: 800,
      webHeight: 1_000,
      thumbStorageKey: `${input.workId}/${input.id}/thumb-${"4".repeat(64)}.webp`,
      thumbChecksum: "4".repeat(64),
      thumbByteSize: 10,
      thumbWidth: 320,
      thumbHeight: 400,
      submittedAt: now,
      moderatedAt: now,
    },
  });
}

async function hideWork(
  client: PrismaClient,
  workId: string,
  revisionId: string,
) {
  await client.$transaction(async (tx) => {
    await tx.workshopWork.update({
      where: { id: workId },
      data: {
        isPublicationEnabled: false,
        isIndexable: false,
        publishedAt: null,
        publishedRevisionId: null,
        deletedAt: new Date(),
      },
    });
    await tx.workshopWorkRevision.update({
      where: { id: revisionId },
      data: { status: "HIDDEN", moderatedAt: new Date() },
    });
  });
}

function coloringRevisionData(
  coloringId: string,
): Prisma.ColoringRevisionUncheckedCreateInput {
  const revisionId = id();
  return {
    id: revisionId,
    coloringId,
    version: 1,
    paletteLabel: "Achievement palette",
    paletteVersion: "achievement-v1",
    usedColorCount: 1,
    width: 800,
    height: 1_000,
    derivativeProfile: "webp-preview-v3",
    colorSpace: "srgb",
    outlineSourceMime: "image/png",
    outlineSourceChecksum: "5".repeat(64),
    outlineStorageKey: `${coloringId}/${revisionId}/outline-${"6".repeat(64)}.webp`,
    outlineByteSize: 10,
    outlineChecksum: "6".repeat(64),
    outlineAlt: "Outline",
    coloredSourceMime: "image/png",
    coloredSourceChecksum: "7".repeat(64),
    coloredStorageKey: `${coloringId}/${revisionId}/colored-${"8".repeat(64)}.webp`,
    coloredByteSize: 10,
    coloredChecksum: "8".repeat(64),
    coloredAlt: "Colored",
  };
}

function id() {
  return randomUUID().replaceAll("-", "");
}

function isSerializationConflict(reason: unknown) {
  if (typeof reason !== "object" || reason === null) return false;
  const error = reason as {
    code?: unknown;
    meta?: {
      code?: unknown;
      driverAdapterError?: { cause?: { originalCode?: unknown } };
    };
  };
  return (
    error.code === "P2034" ||
    (error.code === "P2010" &&
      (error.meta?.code === "40001" ||
        error.meta?.driverAdapterError?.cause?.originalCode === "40001"))
  );
}
