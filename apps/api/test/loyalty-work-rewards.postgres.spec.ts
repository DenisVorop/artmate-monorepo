import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { LoyaltyHistoryFinalizationService } from "../src/loyalty/history-finalization.service";
import { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import { LoyaltyPurchaseHistoryService } from "../src/loyalty/purchase-history.service";
import { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import { LoyaltyWorkRewardService } from "../src/loyalty/work-reward.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated local database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "loyalty public-work rewards in PostgreSQL",
  { skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set" },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
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
    });

    after(async () => {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
    });

    const service = (client = first, walletService = wallet) =>
      new LoyaltyWorkRewardService(
        client as unknown as PrismaService,
        walletService,
      );
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

    it("awards 25 points once to both pending and ready active members without an order or payment", async () => {
      for (const historyState of ["PENDING", "READY"] as const) {
        const owner = await createOwner(first, { historyState });
        const source = await createColoring(first);
        const work = await createWork(first, owner.user.id, source);

        const fact = await first.workshopPublicationFact.findUniqueOrThrow({
          where: { workId: work.id },
        });
        // A reused integration database may have more than one batch of older
        // eligible members. This assertion concerns this member's reward.
        assert.deepEqual(await service().processMember(owner.member!.id), {
          processed: true,
          rewards: 1,
        });
        const reward = await first.loyaltyWorkReward.findUniqueOrThrow({
          where: {
            memberId_coloringId: {
              memberId: owner.member!.id,
              coloringId: source.coloring.id,
            },
          },
          include: { operation: true },
        });
        assert.equal(reward.publicationFactId, fact.id);
        assert.equal(reward.points, 25);
        assert.equal(reward.rulesVersion, "work-v1");
        assert.equal(reward.occurredAt.getTime(), fact.qualifiedAt.getTime());
        assert.equal(reward.operation?.kind, "CREDIT");
        assert.equal(reward.operation?.requestedPoints, 25n);
        assert.equal(reward.operation?.balanceDelta, 25n);
        assert.equal(
          reward.operation?.operationKey,
          `coloring:${owner.member!.id}:${source.coloring.id}`,
        );
        assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
        assert.deepEqual(await service().processMember(owner.member!.id), {
          processed: true,
          rewards: 0,
        });
      }
    });

    it("requires explicit enrollment but later awards an already captured fact even after the work is hidden", async () => {
      const owner = await createOwner(first, { enrolled: false });
      const source = await createColoring(first);
      const work = await createWork(first, owner.user.id, source);
      const fact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: work.id },
      });

      assert.equal(
        await first.loyaltyMember.count({ where: { userId: owner.user.id } }),
        0,
      );
      await service().processDueMembers();
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { publicationFactId: fact.id },
        }),
        0,
      );

      await hideWork(first, work.id, work.revisionId);
      const member = await enroll(first, owner.user.id, "PENDING");
      assert.deepEqual(await service().processMember(member.id), {
        processed: true,
        rewards: 1,
      });
      assert.equal((await balance(member.id)).balancePoints, 25n);
      assert.equal(
        (
          await first.loyaltyWorkReward.findUniqueOrThrow({
            where: {
              memberId_coloringId: {
                memberId: member.id,
                coloringId: source.coloring.id,
              },
            },
          })
        ).publicationFactId,
        fact.id,
      );
      assert.equal(
        await first.workshopPublicationFact.count({ where: { id: fact.id } }),
        1,
      );
    });

    it("defers an existing fact while the member, history or current owner is blocked and awards once after reactivation", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const work = await createWork(first, owner.user.id, source);
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        1,
      );

      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { status: "BLOCKED" },
      });
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: false,
        rewards: 0,
      });

      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { status: "ACTIVE", historyState: "FAILED" },
      });
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: false,
        rewards: 0,
      });

      await first.loyaltyMember.update({
        where: { id: owner.member!.id },
        data: { historyState: "PENDING" },
      });
      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "BLOCKED" },
      });
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: false,
        rewards: 0,
      });
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);

      await first.user.update({
        where: { id: owner.user.id },
        data: { status: "ACTIVE" },
      });
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 1,
      });
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
    });

    it("keeps history pending until every batched public-work reward is credited", async () => {
      const owner = await createOwner(first);
      const firstSource = await createColoring(first);
      const secondSource = await createColoring(first);
      await createWork(first, owner.user.id, firstSource);
      await createWork(first, owner.user.id, secondSource);
      await purchaseHistory().processMember(owner.member!.id);

      assert.deepEqual(await service().processMember(owner.member!.id, 1), {
        processed: true,
        rewards: 1,
      });
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        1,
      );
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: false,
      });
      assert.deepEqual(await service().processMember(owner.member!.id, 1), {
        processed: true,
        rewards: 1,
      });
      assert.deepEqual(await service().processMember(owner.member!.id, 1), {
        processed: true,
        rewards: 0,
      });
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        2,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 50n);
      assert.deepEqual(await finalizer().processMember(owner.member!.id), {
        processed: true,
        ready: true,
      });
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: owner.member!.id },
          })
        ).historyState,
        "READY",
      );
    });

    it("excludes private and pending works until every public-source condition becomes true", async () => {
      const privateOwner = await createOwner(first);
      const privateSource = await createColoring(first);
      const privateWork = await createWork(
        first,
        privateOwner.user.id,
        privateSource,
        { workshopPublic: false },
      );
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: privateWork.id },
        }),
        0,
      );

      await first.workshop.update({
        where: { ownerId: privateOwner.user.id },
        data: { isPublic: true },
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: privateWork.id },
        }),
        1,
      );

      const pendingOwner = await createOwner(first);
      const pendingSource = await createColoring(first);
      const pendingWork = await createWork(
        first,
        pendingOwner.user.id,
        pendingSource,
        { revisionStatus: "PENDING" },
      );
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: pendingWork.id },
        }),
        0,
      );

      await first.workshopWorkRevision.update({
        where: { id: pendingWork.revisionId },
        data: {
          status: "APPROVED",
          moderatedAt: new Date(),
        },
      });
      await first.workshopWork.update({
        where: { id: pendingWork.id },
        data: {
          publishedRevisionId: pendingWork.revisionId,
          publishedAt: new Date(),
        },
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: pendingWork.id },
        }),
        1,
      );
      await service().processMember(privateOwner.member!.id);
      await service().processMember(pendingOwner.member!.id);

      const hiddenOwner = await createOwner(first);
      const hiddenSource = await createColoring(first);
      const neverPublic = await createWork(
        first,
        hiddenOwner.user.id,
        hiddenSource,
        { revisionStatus: "PENDING" },
      );
      await hideWork(first, neverPublic.id, neverPublic.revisionId);
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: neverPublic.id },
        }),
        0,
      );
      assert.deepEqual(await service().processMember(hiddenOwner.member!.id), {
        processed: true,
        rewards: 0,
      });
    });

    it("keeps owner and official catalog visibility gates aligned with the public workshop query", async () => {
      for (const gate of [
        "OWNER_BLOCKED",
        "OWNER_DELETED",
        "COLLECTION_DRAFT",
        "COLORING_DRAFT",
      ] as const) {
        const owner = await createOwner(first);
        if (gate === "OWNER_BLOCKED") {
          await first.user.update({
            where: { id: owner.user.id },
            data: { status: "BLOCKED" },
          });
        } else if (gate === "OWNER_DELETED") {
          await first.user.update({
            where: { id: owner.user.id },
            data: { deletedAt: new Date() },
          });
        }
        const source = await createColoring(first, {
          collectionStatus: gate === "COLLECTION_DRAFT" ? "DRAFT" : "PUBLISHED",
          coloringStatus: gate === "COLORING_DRAFT" ? "DRAFT" : "PUBLISHED",
        });
        const work = await createWork(first, owner.user.id, source);
        assert.equal(
          await first.workshopPublicationFact.count({
            where: { workId: work.id },
          }),
          0,
          gate,
        );

        if (gate === "OWNER_BLOCKED") {
          await first.user.update({
            where: { id: owner.user.id },
            data: { status: "ACTIVE" },
          });
        } else if (gate === "OWNER_DELETED") {
          await first.user.update({
            where: { id: owner.user.id },
            data: { deletedAt: null },
          });
        } else if (gate === "COLLECTION_DRAFT") {
          await first.coloringCollection.update({
            where: { id: source.collection.id },
            data: { status: "PUBLISHED", publishedAt: new Date() },
          });
        } else {
          await first.coloring.update({
            where: { id: source.coloring.id },
            data: {
              status: "PUBLISHED",
              publishedRevisionId: source.revision.id,
              publishedAt: new Date(),
            },
          });
        }

        assert.equal(
          await first.workshopPublicationFact.count({
            where: { workId: work.id },
          }),
          1,
          gate,
        );
        assert.deepEqual(await service().processMember(owner.member!.id), {
          processed: true,
          rewards: 1,
        });
      }
    });

    it("captures the first public revision and does not award again after a revision switch or reupload", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const original = await createWork(first, owner.user.id, source);
      const firstFact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: original.id },
      });
      assert.equal(firstFact.revisionId, original.revisionId);

      const secondRevisionId = id();
      await createWorkshopRevision(first, {
        id: secondRevisionId,
        workId: original.id,
        coloringId: source.coloring.id,
        officialRevisionId: source.revision.id,
        sequence: 2,
        status: "APPROVED",
      });
      await first.workshopWork.update({
        where: { id: original.id },
        data: {
          currentRevisionId: secondRevisionId,
          publishedRevisionId: secondRevisionId,
          publishedAt: new Date(),
        },
      });
      const unchanged = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: original.id },
      });
      assert.equal(unchanged.id, firstFact.id);
      assert.equal(unchanged.revisionId, original.revisionId);
      assert.equal(
        unchanged.qualifiedAt.getTime(),
        firstFact.qualifiedAt.getTime(),
      );

      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 1,
      });
      const reupload = await createWork(first, owner.user.id, source, {
        attemptNumber: 2,
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: reupload.id },
        }),
        1,
      );
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 0,
      });
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: {
            memberId: owner.member!.id,
            coloringId: source.coloring.id,
          },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
    });

    it("captures one fact when separate concurrent transactions open the final work and workshop gates", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const work = await createWork(first, owner.user.id, source, {
        workshopPublic: false,
      });
      await first.workshopWork.update({
        where: { id: work.id },
        data: { isPublicationEnabled: false, publishedAt: null },
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        0,
      );

      await Promise.all([
        first.$transaction((tx) =>
          tx.workshopWork.update({
            where: { id: work.id },
            data: { isPublicationEnabled: true, publishedAt: new Date() },
          }),
        ),
        second.$transaction((tx) =>
          tx.workshop.update({
            where: { id: work.workshopId },
            data: { isPublic: true },
          }),
        ),
      ]);

      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        1,
      );
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 1,
      });
    });

    it("rejects a fact exposed early by immediate constraints when the committed workshop is private", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const work = await createWork(first, owner.user.id, source, {
        workshopPublic: false,
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        0,
      );

      await assert.rejects(
        first.$transaction(async (tx) => {
          await tx.workshop.update({
            where: { id: work.workshopId },
            data: { isPublic: true },
          });
          await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
          await tx.workshop.update({
            where: { id: work.workshopId },
            data: { isPublic: false },
          });
        }),
      );
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        0,
      );

      await first.$transaction(async (tx) => {
        await tx.workshop.update({
          where: { id: work.workshopId },
          data: { isPublic: true },
        });
        await tx.workshop.update({
          where: { id: work.workshopId },
          data: { isPublic: false },
        });
      });
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        0,
      );
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 0,
      });
    });

    it("captures eligibility when the product is published and retains the fact and award after hide/delete", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first, { productStatus: "DRAFT" });
      const work = await createWork(first, owner.user.id, source);
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: work.id },
        }),
        0,
      );

      await first.product.update({
        where: { id: source.product.id },
        data: { status: "PUBLISHED" },
      });
      const fact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: work.id },
      });
      await service().processMember(owner.member!.id);
      await hideWork(first, work.id, work.revisionId);

      assert.equal(
        await first.workshopPublicationFact.count({ where: { id: fact.id } }),
        1,
      );
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id, coloringId: source.coloring.id },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 0,
      });
    });

    it("serializes concurrent clients and creates one reward, operation and balance change", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      await createWork(first, owner.user.id, source);

      const results = await Promise.allSettled([
        service(first).processMember(owner.member!.id),
        service(second).processMember(owner.member!.id),
      ]);
      assert.ok(results.some(({ status }) => status === "fulfilled"));
      assert.ok(
        results.filter(({ status }) => status === "rejected").length <= 1,
      );
      await service().processMember(owner.member!.id);
      const reward = await first.loyaltyWorkReward.findUniqueOrThrow({
        where: {
          memberId_coloringId: {
            memberId: owner.member!.id,
            coloringId: source.coloring.id,
          },
        },
      });
      assert.equal(
        await first.loyaltyOperation.count({
          where: { workRewardId: reward.id },
        }),
        1,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
      assert.equal((await balance(owner.member!.id)).revision, 1n);
    });

    it("rolls back a reward and wallet credit together, records retry state, then succeeds", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      await createWork(first, owner.user.id, source);
      const failingWallet = new LoyaltyWalletService();
      failingWallet.creditWorkInTransaction = async (tx, input) => {
        await wallet.creditWorkInTransaction(tx, input);
        throw new Error("Injected work-credit failure");
      };

      await assert.rejects(
        service(first, failingWallet).processMember(owner.member!.id),
        /Injected work-credit failure/,
      );
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        0,
      );
      assert.equal(
        await first.loyaltyOperation.count({
          where: { memberId: owner.member!.id },
        }),
        0,
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);
      const sync = await first.loyaltyWorkRewardSync.findUniqueOrThrow({
        where: { memberId: owner.member!.id },
      });
      assert.equal(sync.attempts, 1);
      assert.equal(sync.lastError, "work_reward_processing_failed");
      assert.ok(sync.nextAttemptAt.getTime() > Date.now());

      assert.deepEqual(await service().processMember(owner.member!.id), {
        processed: true,
        rewards: 1,
      });
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
    });

    it("rejects SQL source forgery, fact mutation and fact deletion", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const privateWork = await createWork(first, owner.user.id, source, {
        workshopPublic: false,
      });

      await assert.rejects(
        first.$transaction(async (tx) => {
          await tx.$executeRaw`
            INSERT INTO workshop_publication_facts
              (id, work_id, revision_id, owner_id, coloring_id, collection_id,
               qualified_at)
            VALUES
              (${randomUUID()}, ${privateWork.id}, ${privateWork.revisionId},
               ${owner.user.id}, ${source.coloring.id}, ${source.collection.id},
               clock_timestamp())
          `;
        }),
      );
      assert.equal(
        await first.workshopPublicationFact.count({
          where: { workId: privateWork.id },
        }),
        0,
      );

      await first.workshop.update({
        where: { ownerId: owner.user.id },
        data: { isPublic: true },
      });
      const fact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: privateWork.id },
      });
      await assert.rejects(
        first.workshopPublicationFact.update({
          where: { id: fact.id },
          data: { qualifiedAt: new Date(0) },
        }),
      );
      await assert.rejects(
        first.workshopPublicationFact.delete({ where: { id: fact.id } }),
      );
      await service().processMember(owner.member!.id);
    });

    it("rejects orphan rewards, generic coloring credits and tampering with an awarded 25-point source", async () => {
      const owner = await createOwner(first);
      const source = await createColoring(first);
      const work = await createWork(first, owner.user.id, source);
      const fact = await first.workshopPublicationFact.findUniqueOrThrow({
        where: { workId: work.id },
      });

      await assert.rejects(
        first.loyaltyWorkReward.create({
          data: {
            memberId: owner.member!.id,
            coloringId: source.coloring.id,
            publicationFactId: fact.id,
            points: 25,
            rulesVersion: "work-v1",
            occurredAt: fact.qualifiedAt,
          },
        }),
      );
      assert.equal(
        await first.loyaltyWorkReward.count({
          where: { memberId: owner.member!.id },
        }),
        0,
      );

      await assert.rejects(
        first.$transaction((tx) =>
          wallet.creditInTransaction(tx, {
            memberId: owner.member!.id,
            points: 25,
            operationKey: `coloring:${owner.member!.id}:${source.coloring.id}`,
            sourceKey: `coloring:${owner.member!.id}:${source.coloring.id}`,
            rulesVersion: "work-v1",
            occurredAt: fact.qualifiedAt,
          }),
        ),
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 0n);

      await service().processMember(owner.member!.id);
      const reward = await first.loyaltyWorkReward.findUniqueOrThrow({
        where: {
          memberId_coloringId: {
            memberId: owner.member!.id,
            coloringId: source.coloring.id,
          },
        },
      });
      await assert.rejects(
        first.loyaltyWorkReward.update({
          where: { id: reward.id },
          data: { points: 50 },
        }),
      );
      await assert.rejects(
        first.loyaltyOperation.update({
          where: { workRewardId: reward.id },
          data: { operationKey: `tampered:${randomUUID()}` },
        }),
      );
      await assert.rejects(
        first.loyaltyWorkReward.delete({ where: { id: reward.id } }),
      );
      assert.equal((await balance(owner.member!.id)).balancePoints, 25n);
    });
  },
);

type CreatedColoring = Awaited<ReturnType<typeof createColoring>>;

async function createOwner(
  client: PrismaClient,
  options: {
    enrolled?: boolean;
    historyState?: "PENDING" | "READY";
    memberStatus?: "ACTIVE" | "BLOCKED";
    userStatus?: "ACTIVE" | "BLOCKED";
  } = {},
) {
  const user = await client.user.create({
    data: { status: options.userStatus ?? "ACTIVE" },
  });
  const member =
    options.enrolled === false
      ? null
      : await enroll(
          client,
          user.id,
          options.historyState ?? "PENDING",
          options.memberStatus,
        );
  return { user, member };
}

async function enroll(
  client: PrismaClient,
  userId: string,
  historyState: "PENDING" | "READY",
  status: "ACTIVE" | "BLOCKED" = "ACTIVE",
) {
  return client.loyaltyMember.create({
    data: {
      userId,
      termsVersion: "loyalty-v1",
      historyState,
      status,
      wallet: { create: {} },
    },
  });
}

async function createColoring(
  client: PrismaClient,
  options: {
    productStatus?: "DRAFT" | "PUBLISHED";
    collectionStatus?: "DRAFT" | "PUBLISHED";
    coloringStatus?: "DRAFT" | "PUBLISHED";
  } = {},
) {
  const token = id();
  const product = await client.product.create({
    data: {
      id: token,
      slug: `work-reward-${token}`,
      title: "Work reward fixture",
      description: "Work reward fixture",
      status: options.productStatus ?? "PUBLISHED",
      price: 1_000,
    },
  });
  const collection = await client.coloringCollection.create({
    data: {
      id: id(),
      productId: product.id,
      slug: `work-reward-collection-${token}`,
      title: "Work reward collection",
      description: "Work reward collection",
      status: options.collectionStatus ?? "PUBLISHED",
      publishedAt: options.collectionStatus === "DRAFT" ? null : new Date(),
    },
  });
  const coloring = await client.coloring.create({
    data: {
      id: id(),
      collectionId: collection.id,
      number: 1,
      title: "Work reward coloring",
      position: 1,
      status: "DRAFT",
    },
  });
  const revision = await client.coloringRevision.create({
    data: coloringRevisionData(coloring.id),
  });
  if (options.coloringStatus !== "DRAFT") {
    await client.coloring.update({
      where: { id: coloring.id },
      data: {
        status: "PUBLISHED",
        publishedRevisionId: revision.id,
        publishedAt: new Date(),
      },
    });
  }
  return { product, collection, coloring, revision };
}

async function createWork(
  client: PrismaClient,
  ownerId: string,
  source: CreatedColoring,
  options: {
    attemptNumber?: number;
    revisionStatus?: "PENDING" | "APPROVED";
    workshopPublic?: boolean;
  } = {},
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
  const revisionStatus = options.revisionStatus ?? "APPROVED";
  const revisionId = id();
  await createWorkshopRevision(client, {
    id: revisionId,
    workId: work.id,
    coloringId: source.coloring.id,
    officialRevisionId: source.revision.id,
    sequence: 1,
    status: revisionStatus,
  });
  await client.workshopWork.update({
    where: { id: work.id },
    data: {
      currentRevisionId: revisionId,
      publishedRevisionId: revisionStatus === "APPROVED" ? revisionId : null,
      isPublicationEnabled: true,
      publishedAt: revisionStatus === "APPROVED" ? new Date() : null,
    },
  });
  return { ...work, revisionId, workshopId: workshop.id };
}

async function createWorkshopRevision(
  client: PrismaClient,
  input: {
    id: string;
    workId: string;
    coloringId: string;
    officialRevisionId: string;
    sequence: number;
    status: "PENDING" | "APPROVED";
  },
) {
  const now = new Date();
  return client.workshopWorkRevision.create({
    data: {
      id: input.id,
      workId: input.workId,
      coloringId: input.coloringId,
      sequence: input.sequence,
      officialRevisionId: input.officialRevisionId,
      status: input.status,
      publicationConsent: true,
      publicationConsentAt: now,
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
      moderatedAt: input.status === "APPROVED" ? now : null,
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
    paletteLabel: "Work reward palette",
    paletteVersion: "work-reward-v1",
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
