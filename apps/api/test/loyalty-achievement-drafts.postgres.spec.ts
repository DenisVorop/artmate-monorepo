import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { LoyaltyAchievementDraftsService } from "../src/loyalty/achievement-drafts.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated local database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;
const draft = {
  title: "Draft achievement",
  description: "Configuration only",
  imageUrl: null,
  conditionKind: "published_coloring_count" as const,
  target: 1,
  rewardPoints: 0,
  sortOrder: 0,
};

describe(
  "versioned achievement drafts in PostgreSQL",
  {
    skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set",
  },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    let authorId: string;
    const service = (client = first) =>
      new LoyaltyAchievementDraftsService(client as unknown as PrismaService);

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

    it("creates an inert draft and preserves the prior revision when configuration changes", async () => {
      const created = await service().create(authorId, {
        ...draft,
        imageUrl:
          "http://localhost:3002/uploads/loyalty-achievements/example.webp",
      });
      assert.equal(created.status, "draft");
      assert.equal(created.version, 1);
      assert.equal(
        created.imageUrl,
        "http://localhost:3002/uploads/loyalty-achievements/example.webp",
      );
      const changed = await service().update(created.id, authorId, {
        ...draft,
        title: "Edited title",
        target: 12,
        rewardPoints: 345,
        expectedVersion: 1,
      });
      assert.equal(changed.id, created.id);
      assert.equal(changed.version, 2);
      assert.equal(changed.rewardPoints, 345);
      const revisions = await first.loyaltyAchievementRevision.findMany({
        where: { definitionId: created.id },
        orderBy: { version: "asc" },
      });
      assert.equal(revisions.length, 2);
      assert.equal(revisions[0]!.title, draft.title);
      assert.equal(revisions[0]!.rewardPoints, 0);
      assert.equal(revisions[1]!.createdById, authorId);
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: authorId } }),
        0,
      );
      assert.ok(
        (await service().list()).some(
          (item) => item.id === created.id && item.version === 2,
        ),
      );
    });

    it("allows one concurrent edit and rejects stale edits and archive requests", async () => {
      const created = await service().create(authorId, draft);
      const results = await Promise.allSettled([
        service(first).update(created.id, authorId, {
          ...draft,
          title: "A",
          expectedVersion: 1,
        }),
        service(second).update(created.id, authorId, {
          ...draft,
          title: "B",
          expectedVersion: 1,
        }),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.match(String(rejected.reason), /version conflict/);
      assert.equal(
        await first.loyaltyAchievementRevision.count({
          where: { definitionId: created.id },
        }),
        2,
      );
      await assert.rejects(
        service().archive(created.id, 1),
        /version conflict/,
      );
      const archived = await service().archive(created.id, 2);
      assert.equal(archived.version, 2);
      assert.equal(archived.status, "archived");
      assert.deepEqual(await service().archive(created.id, 2), archived);
      await assert.rejects(
        service().update(created.id, authorId, {
          ...draft,
          expectedVersion: 2,
        }),
        /cannot be edited/,
      );
    });

    it("serializes edit versus archive without losing either accepted state", async () => {
      const created = await service().create(authorId, draft);
      const results = await Promise.allSettled([
        service(first).update(created.id, authorId, {
          ...draft,
          title: "Changed",
          expectedVersion: 1,
        }),
        service(second).archive(created.id, 1),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const saved = await first.loyaltyAchievementDefinition.findUniqueOrThrow({
        where: { id: created.id },
      });
      assert.ok(
        saved.archivedAt
          ? saved.currentVersion === 1
          : saved.currentVersion === 2,
      );
    });

    it("enforces committed current revision, immutable history, forward versions and soft archive in the database", async () => {
      await assert.rejects(
        first.loyaltyAchievementDefinition.create({
          data: { id: randomUUID(), currentVersion: 1 },
        }),
      );
      const created = await service().create(authorId, draft);
      await service().update(created.id, authorId, {
        ...draft,
        expectedVersion: 1,
      });
      const revisionKey = {
        definitionId_version: { definitionId: created.id, version: 1 },
      };
      await assert.rejects(
        first.loyaltyAchievementRevision.update({
          where: revisionKey,
          data: { rewardPoints: 999 },
        }),
        /immutable/,
      );
      await assert.rejects(
        first.loyaltyAchievementRevision.delete({ where: revisionKey }),
        /immutable/,
      );
      await assert.rejects(
        first.loyaltyAchievementDefinition.delete({
          where: { id: created.id },
        }),
        /cannot be deleted/,
      );
      await assert.rejects(
        first.loyaltyAchievementDefinition.update({
          where: { id: created.id },
          data: { currentVersion: 1 },
        }),
        /advance by one/,
      );
      await assert.rejects(
        first.loyaltyAchievementDefinition.update({
          where: { id: created.id },
          data: { currentVersion: 3 },
        }),
      );
      await service().archive(created.id, 2);
      await assert.rejects(
        first.loyaltyAchievementDefinition.update({
          where: { id: created.id },
          data: { archivedAt: null },
        }),
        /immutable/,
      );
      assert.equal(
        await first.loyaltyAchievementRevision.count({
          where: { definitionId: created.id },
        }),
        2,
      );
      await assert.rejects(service().archive(randomUUID(), 1), /not found/);
    });
  },
);
