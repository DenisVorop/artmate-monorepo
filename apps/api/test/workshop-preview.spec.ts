import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { WorkshopCollectionSource } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";
import type { WorkshopAssetDeletionQueueService } from "../src/workshops/workshop-asset-deletion-queue.service";
import type { WorkshopMediaService } from "../src/workshops/workshop-media.service";
import type { WorkshopStorageService } from "../src/workshops/workshop-storage.service";
import { WorkshopService } from "../src/workshops/workshop.service";

describe("WorkshopService dashboard preview", () => {
  it("returns at most four summaries with user-scoped paid/work SQL and performs no writes", async () => {
    let statement: { sql: string; values: unknown[] } | undefined;
    const rows = Array.from({ length: 4 }, (_, index) => ({
      id: `collection-${index}`,
      slug: `collection-${index}`,
      title: `Collection ${index}`,
      productId: `product-${index}`,
      expectedColoringCount: 25,
      coverUrl: "https://example.test/cover.webp",
      coverAlt: "Обложка",
      coverWidth: 300,
      coverHeight: 400,
      source: index === 0 ? null : "manual",
      membershipAddedAt: null,
      paidAt: new Date("2026-09-01T00:00:00.000Z"),
      hasPaidOrder: true,
      workCount: BigInt(index),
    }));
    const prisma = {
      $queryRaw: async (query: { sql: string; values: unknown[] }) => {
        statement = query;
        return rows;
      },
      workshop: { findUnique: async () => assert.fail("preview must not create/read workshop") },
      workshopCollection: {
        create: async () => assert.fail("preview must not write memberships"),
        createMany: async () => assert.fail("preview must not sync memberships"),
      },
      orderItem: { findMany: async () => assert.fail("preview must use bounded SQL") },
    };
    const result = await createService(prisma).getPreview("user-123");

    assert.equal(result.collections.length, 4);
    assert.equal(result.collections[0]?.source, "PURCHASE");
    assert.equal(result.collections[1]?.source, "MANUAL");
    assert.equal(result.collections[0]?.hasPaidOrder, true);
    assert.equal(result.collections[0]?.addedAt, "2026-09-01T00:00:00.000Z");
    assert.equal(result.collections[3]?.workCount, 3);
    assert.match(statement?.sql ?? "", /LIMIT 4/);
    assert.match(statement?.sql ?? "", /works\."deleted_at" IS NULL/);
    assert.match(statement?.sql ?? "", /o\."status" = 'paid'/);
    assert.match(statement?.sql ?? "", /o\."payment_status" = 'paid'/);
    assert.deepEqual(statement?.values, ["user-123", "user-123"]);
  });

  it("lazily adds a paid collection when its detail is opened", async () => {
    const workshop = { id: "workshop-1" };
    const collection = { id: "collection-1", productId: "product-1" };
    const membership = {
      source: WorkshopCollectionSource.PURCHASE,
      addedAt: new Date("2026-09-01T00:00:00.000Z"),
      collection: {
        id: collection.id,
        slug: "paid-collection",
        title: "Paid collection",
        productId: collection.productId,
        expectedColoringCount: 25,
        coverUrl: "https://example.test/cover.webp",
        coverAlt: "Обложка",
        coverWidth: 300,
        coverHeight: 400,
        description: "",
        colorings: [],
      },
      works: [],
      _count: { works: 0 },
    };
    let membershipReads = 0;
    let upsertData: unknown;
    let workshopCreated = 0;
    const prisma = {
      workshopCollection: {
        findFirst: async () => (++membershipReads === 1 ? null : membership),
        upsert: async (input: unknown) => { upsertData = input; },
      },
      coloringCollection: { findFirst: async () => collection },
      orderItem: {
        findFirst: async () => ({ orderId: "paid-order" }),
        findMany: async () => [{ productId: collection.productId }],
      },
      workshop: {
        findUnique: async () => null,
        create: async () => { workshopCreated += 1; return workshop; },
      },
    };

    const result = await createService(prisma).getCollection("user-123", "paid-collection");

    assert.equal(workshopCreated, 1);
    assert.equal(membershipReads, 2);
    assert.equal(result.source, "PURCHASE");
    assert.equal(result.hasPaidOrder, true);
    assert.equal((upsertData as { create: { source: string } }).create.source, "PURCHASE");
  });

  it("does not create workshop membership for an unpaid collection", async () => {
    let writes = 0;
    const prisma = {
      workshopCollection: {
        findFirst: async () => null,
        upsert: async () => { writes += 1; },
      },
      coloringCollection: {
        findFirst: async () => ({ id: "collection-1", productId: "product-1" }),
      },
      orderItem: { findFirst: async () => null },
      workshop: { findUnique: async () => null, create: async () => { writes += 1; } },
    };

    await assert.rejects(
      createService(prisma).getCollection("user-123", "unpaid-collection"),
      NotFoundException,
    );
    assert.equal(writes, 0);
  });
});

function createService(prisma: object) {
  return new WorkshopService(
    prisma as PrismaService,
    {} as WorkshopMediaService,
    {} as WorkshopStorageService,
    {} as ColoringStorageService,
    {} as WorkshopAssetDeletionQueueService,
  );
}
