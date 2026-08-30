import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import {
  ColoringCollectionStatus,
  ColoringRevisionReviewDecision,
  ColoringStatus,
  Prisma,
  ProductStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { ColoringMediaService } from "../src/colorings/coloring-media.service";
import { ColoringRevisionsService } from "../src/colorings/coloring-revisions.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";

type RevisionsApi = {
  createRevision(
    coloringId: string,
    input: RevisionInput,
    files: RevisionFiles,
    adminId: string,
  ): Promise<Record<string, unknown>>;
  getRevisions(coloringId: string): Promise<Array<Record<string, unknown>>>;
  getRevisionAsset(
    coloringId: string,
    revisionId: string,
    kind: "outline" | "colored",
  ): Promise<Buffer>;
  reviewRevision(
    coloringId: string,
    revisionId: string,
    input: { decision: "approved" | "rejected"; comment?: string },
    adminId: string,
  ): Promise<Record<string, unknown>>;
  publishRevision(
    coloringId: string,
    revisionId: string,
    adminId: string,
  ): Promise<Record<string, unknown>>;
};

type RevisionInput = {
  markerColorIds: string[];
  outlineAlt: string;
  coloredAlt: string;
};

type RevisionFiles = {
  outline?: Array<{
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }>;
  colored?: Array<{
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }>;
};

describe("ColoringRevisionsService", () => {
  it("creates one revision with an atomically allocated sequence", async () => {
    const stored = createStoredRevision({ version: 3, review: null });
    const writes: Array<Record<string, unknown>> = [];
    const storageWrites: unknown[] = [];
    const tx = {
      coloring: {
        update: async (args: Record<string, unknown>) => {
          assert.deepEqual(args, {
            where: { id: "coloring-1" },
            data: { revisionSequence: { increment: 1 } },
            select: { revisionSequence: true },
          });
          return { revisionSequence: 3 };
        },
      },
      coloringRevision: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          return { id: stored.id };
        },
        findUnique: async () => stored,
      },
    };
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const media = {
      processPair: async () => processedPair(),
    };
    const storage = {
      writePrivatePair: async (entries: unknown[]) => {
        storageWrites.push(entries);
        return [
          { key: "outline", created: true },
          { key: "colored", created: true },
          { key: "card", created: true },
        ];
      },
      cleanupPrivate: async () => undefined,
    };
    const service = createService(prisma, media, storage);

    const result = await service.createRevision(
      "coloring-1",
      revisionInput(),
      revisionFiles(),
      "admin-1",
    );

    assert.equal(storageWrites.length, 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.version, 3);
    assert.equal(writes[0]?.createdById, "admin-1");
    assert.equal(writes[0]?.paletteLabel, "Artmate 168");
    assert.equal(writes[0]?.paletteVersion, "2026-08");
    assert.equal(writes[0]?.derivativeProfile, "webp-preview-v3");
    assert.equal(writes[0]?.usedColorCount, 2);
    assert.deepEqual(writes[0]?.paletteColors, {
      create: [
        {
          markerColorId: "marker-color-039",
          symbolPosition: 1,
          colorNumber: 39,
          pantone: "2337U",
          hex: "#FFB7AE",
          markerNumber: "488",
        },
        {
          markerColorId: "marker-color-157",
          symbolPosition: 2,
          colorNumber: 157,
          pantone: "169U",
          hex: "#FFB7AE",
          markerNumber: "168",
        },
      ],
    });
    assert.equal(result.status, "review_required");
    assert.doesNotMatch(JSON.stringify(result), /storageKey|private\//i);
  });

  it("cleans private derivatives when the revision transaction fails", async () => {
    const cleaned: string[][] = [];
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      coloringRevision: { findUnique: async () => null },
      $transaction: async () => {
        throw new Error("database unavailable");
      },
    };
    const media = { processPair: async () => processedPair() };
    const storage = {
      writePrivatePair: async (entries: Array<{ key: string }>) =>
        entries.map(({ key }) => ({ key, created: true })),
      cleanupPrivate: async (keys: string[]) => {
        cleaned.push(keys);
      },
    };
    const service = createService(prisma, media, storage);

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        revisionInput(),
        revisionFiles(),
        "admin-1",
      ),
      /database unavailable/,
    );
    assert.equal(cleaned.length, 1);
    assert.equal(cleaned[0]?.length, 3);
  });

  it("keeps private files when a failed create response committed the revision", async () => {
    let cleaned = false;
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      coloringRevision: {
        findUnique: async (args: {
          where: { coloringId_id: { coloringId: string; id: string } };
        }) => {
          assert.equal(args.where.coloringId_id.coloringId, "coloring-1");
          assert.match(args.where.coloringId_id.id, /^[0-9a-f]{32}$/);

          return createCommittedRevision(args.where.coloringId_id.id);
        },
      },
      $transaction: async () => {
        throw new Error("connection lost after commit");
      },
    };
    const media = { processPair: async () => processedPair() };
    const storage = {
      writePrivatePair: async (entries: Array<{ key: string }>) =>
        entries.map(({ key }) => ({ key, created: true })),
      cleanupPrivate: async () => {
        cleaned = true;
      },
    };
    const service = createService(prisma, media, storage);

    const result = await service.createRevision(
      "coloring-1",
      revisionInput(),
      revisionFiles(),
      "admin-1",
    );

    assert.equal(result.status, "review_required");
    assert.equal(cleaned, false);
  });

  it("rejects an ambiguous create reconciled to unexpected media identity", async () => {
    let cleaned = false;
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      coloringRevision: {
        findUnique: async (args: {
          where: { coloringId_id: { coloringId: string; id: string } };
        }) =>
          createCommittedRevision(args.where.coloringId_id.id, {
            outlineChecksum: "e".repeat(64),
          }),
      },
      $transaction: async () => {
        throw new Error("connection lost after create");
      },
    };
    const media = { processPair: async () => processedPair() };
    const storage = {
      writePrivatePair: async (entries: Array<{ key: string }>) =>
        entries.map(({ key }) => ({ key, created: true })),
      cleanupPrivate: async () => {
        cleaned = true;
      },
    };
    const service = createService(prisma, media, storage);

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        revisionInput(),
        revisionFiles(),
        "admin-1",
      ),
      /connection lost after create/,
    );
    assert.equal(cleaned, true);
  });

  it("keeps private files when a failed create commit cannot be resolved", async () => {
    let cleaned = false;
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      coloringRevision: {
        findUnique: async () => {
          throw new Error("database still unavailable");
        },
      },
      $transaction: async () => {
        throw new Error("create outcome unknown");
      },
    };
    const media = { processPair: async () => processedPair() };
    const storage = {
      writePrivatePair: async (entries: Array<{ key: string }>) =>
        entries.map(({ key }) => ({ key, created: true })),
      cleanupPrivate: async () => {
        cleaned = true;
      },
    };
    const service = createService(prisma, media, storage);

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        revisionInput(),
        revisionFiles(),
        "admin-1",
      ),
      /create outcome unknown/,
    );
    assert.equal(cleaned, false);
  });

  it("requires exactly one file for each side of the pair", async () => {
    const service = createService({}, {}, {});

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        revisionInput(),
        { outline: revisionFiles().outline },
        "admin-1",
      ),
      BadRequestException,
    );
  });

  it("rejects palettes longer than 19 before database and media work", async () => {
    let parentRead = false;
    let mediaCalled = false;
    const service = createService(
      {
        coloring: {
          findUnique: async () => {
            parentRead = true;
            return createRevisionParent();
          },
        },
      },
      {
        processPair: async () => {
          mediaCalled = true;
          return processedPair();
        },
      },
      {},
    );

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        {
          ...revisionInput(),
          markerColorIds: Array.from(
            { length: 20 },
            (_, index) => `marker-color-${String(index + 1).padStart(3, "0")}`,
          ),
        },
        revisionFiles(),
        "admin-1",
      ),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message ===
          "Marker palette must contain 1 to 19 unique marker color IDs",
    );
    assert.equal(parentRead, true);
    assert.equal(mediaCalled, false);
  });

  it("rejects unknown marker colors before media and storage work", async () => {
    let mediaCalled = false;
    let storageCalled = false;
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      markerColor: { findMany: async () => [markerColors()[0]] },
    };
    const media = {
      processPair: async () => {
        mediaCalled = true;
        return processedPair();
      },
    };
    const storage = {
      writePrivatePair: async () => {
        storageCalled = true;
        return [];
      },
    };
    const service = createService(prisma, media, storage);

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        {
          ...revisionInput(),
          markerColorIds: ["marker-color-104", "marker-color-999"],
        },
        revisionFiles(),
        "admin-1",
      ),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === "Marker palette contains unknown colors",
    );
    assert.equal(mediaCalled, false);
    assert.equal(storageCalled, false);
  });

  it("maps ordered palette symbols and keeps legacy revisions readable", async () => {
    const paletteRevision = createStoredRevision({
      paletteColors: [
        createStoredPaletteColor(9, "marker-color-009"),
        createStoredPaletteColor(10, "marker-color-010"),
        createStoredPaletteColor(19, "marker-color-019"),
      ],
    });
    const legacyRevision = createStoredRevision({ version: 0 });

    delete (legacyRevision as { paletteColors?: unknown }).paletteColors;

    const prisma = {
      coloring: { findUnique: async () => ({ id: "coloring-1" }) },
      coloringRevision: {
        findMany: async (args: {
          include: { paletteColors: { orderBy: unknown } };
        }) => {
          assert.deepEqual(args.include.paletteColors.orderBy, {
            symbolPosition: "asc",
          });
          return [paletteRevision, legacyRevision];
        },
      },
    };
    const service = createService(prisma, {}, {});

    const revisions = await service.getRevisions("coloring-1");

    assert.deepEqual(
      (revisions[0]?.paletteColors as Array<{ symbol: string }>).map(
        ({ symbol }) => symbol,
      ),
      ["9", "A", "J"],
    );
    assert.deepEqual(revisions[1]?.paletteColors, []);
  });

  for (const lifecycleCase of [
    {
      name: "archived coloring",
      parent: createRevisionParent({ coloringStatus: ColoringStatus.ARCHIVED }),
      message: "Archived coloring cannot receive revisions",
    },
    {
      name: "archived collection",
      parent: createRevisionParent({
        collectionStatus: ColoringCollectionStatus.ARCHIVED,
      }),
      message: "Archived coloring collection cannot receive revisions",
    },
  ]) {
    it(`rejects create for ${lifecycleCase.name} before media or storage work`, async () => {
      let mediaCalled = false;
      let storageCalled = false;
      let transactionCalled = false;
      const prisma = {
        coloring: { findUnique: async () => lifecycleCase.parent },
        $transaction: async () => {
          transactionCalled = true;
        },
      };
      const media = {
        processPair: async () => {
          mediaCalled = true;
          return processedPair();
        },
      };
      const storage = {
        writePrivatePair: async () => {
          storageCalled = true;
          return [];
        },
      };
      const service = createService(prisma, media, storage);

      await assert.rejects(
        service.createRevision(
          "coloring-1",
          revisionInput(),
          revisionFiles(),
          "admin-1",
        ),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.message === lifecycleCase.message,
      );
      assert.equal(mediaCalled, false);
      assert.equal(storageCalled, false);
      assert.equal(transactionCalled, false);
    });
  }

  it("does not create a DB row after a storage failure", async () => {
    let transactionCalled = false;
    const prisma = {
      coloring: { findUnique: async () => createRevisionParent() },
      $transaction: async () => {
        transactionCalled = true;
      },
    };
    const media = { processPair: async () => processedPair() };
    const storage = {
      writePrivatePair: async () => {
        throw new Error("storage unavailable");
      },
    };
    const service = createService(prisma, media, storage);

    await assert.rejects(
      service.createRevision(
        "coloring-1",
        revisionInput(),
        revisionFiles(),
        "admin-1",
      ),
      /storage unavailable/,
    );
    assert.equal(transactionCalled, false);
  });

  it("checks nested ownership before reading a protected asset", async () => {
    let storageRead = false;
    const prisma = {
      coloringRevision: { findUnique: async () => null },
    };
    const storage = {
      readProtected: async () => {
        storageRead = true;
        return Buffer.alloc(0);
      },
    };
    const service = createService(prisma, {}, storage);

    await assert.rejects(
      service.getRevisionAsset("coloring-1", "b".repeat(32), "outline"),
      NotFoundException,
    );
    assert.equal(storageRead, false);
  });

  it("records a one-shot review and maps duplicate review races to 409", async () => {
    const revision = createStoredRevision();
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      coloringRevisionReview: {
        create: async () => {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "7.8.0",
          });
        },
      },
    };
    const service = createService(prisma, {}, {});

    await assert.rejects(
      service.reviewRevision(
        "coloring-1",
        revision.id,
        { decision: "approved" },
        "admin-1",
      ),
      ConflictException,
    );
  });

  it("records a successful review with reviewer provenance", async () => {
    const initial = createStoredRevision({ review: null });
    const reviewed = createStoredRevision();
    const writes: unknown[] = [];
    let reads = 0;
    const prisma = {
      coloringRevision: {
        findUnique: async () => {
          reads += 1;
          return reads === 1 ? initial : reviewed;
        },
      },
      coloringRevisionReview: {
        create: async (args: unknown) => {
          writes.push(args);
        },
      },
    };
    const service = createService(prisma, {}, {});

    const result = await service.reviewRevision(
      "coloring-1",
      initial.id,
      { decision: "approved", comment: " Looks good " },
      "admin-2",
    );

    assert.deepEqual(writes, [
      {
        data: {
          revisionId: initial.id,
          decision: ColoringRevisionReviewDecision.APPROVED,
          comment: "Looks good",
          reviewedById: "admin-2",
        },
      },
    ]);
    assert.equal(result.status, "approved");
  });

  for (const lifecycleCase of [
    {
      name: "archived coloring",
      coloring: {
        ...createStoredRevision().coloring,
        status: ColoringStatus.ARCHIVED,
      },
      message: "Archived coloring cannot receive revisions",
    },
    {
      name: "archived collection",
      coloring: {
        ...createStoredRevision().coloring,
        collection: {
          ...createStoredRevision().coloring.collection,
          status: ColoringCollectionStatus.ARCHIVED,
        },
      },
      message: "Archived coloring collection cannot receive revisions",
    },
  ]) {
    it(`rejects review for ${lifecycleCase.name} before writing a decision`, async () => {
      const revision = createStoredRevision({
        review: null,
        coloring: lifecycleCase.coloring,
      });
      let reviewCreated = false;
      const prisma = {
        coloringRevision: { findUnique: async () => revision },
        coloringRevisionReview: {
          create: async () => {
            reviewCreated = true;
          },
        },
      };
      const service = createService(prisma, {}, {});

      await assert.rejects(
        service.reviewRevision(
          "coloring-1",
          revision.id,
          { decision: "approved" },
          "admin-1",
        ),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.message === lifecycleCase.message,
      );
      assert.equal(reviewCreated, false);
    });
  }

  it("rejects publish readiness before materializing files", async () => {
    let materialized = false;
    const revision = createStoredRevision({ review: null });
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
    };
    const storage = {
      materializePublicPair: async () => {
        materialized = true;
        return [];
      },
    };
    const service = createService(prisma, {}, storage);

    await assert.rejects(
      service.publishRevision("coloring-1", revision.id, "admin-1"),
      BadRequestException,
    );
    assert.equal(materialized, false);
  });

  for (const readinessCase of [
    {
      name: "archived coloring",
      revision: () =>
        createStoredRevision({
          coloring: {
            ...createStoredRevision().coloring,
            status: ColoringStatus.ARCHIVED,
          },
        }),
    },
    {
      name: "blank description",
      revision: () =>
        createStoredRevision({
          coloring: {
            ...createStoredRevision().coloring,
            description: "   ",
          },
        }),
    },
    {
      name: "missing theme",
      revision: () =>
        createStoredRevision({
          coloring: {
            ...createStoredRevision().coloring,
            themes: [],
          },
        }),
    },
    {
      name: "archived collection",
      revision: () =>
        createStoredRevision({
          coloring: {
            ...createStoredRevision().coloring,
            collection: {
              ...createStoredRevision().coloring.collection,
              status: ColoringCollectionStatus.ARCHIVED,
            },
          },
        }),
    },
    {
      name: "draft parent product",
      revision: () =>
        createStoredRevision({
          coloring: {
            ...createStoredRevision().coloring,
            collection: {
              ...createStoredRevision().coloring.collection,
              product: { status: ProductStatus.DRAFT },
            },
          },
        }),
    },
  ]) {
    it(`rejects publish readiness for ${readinessCase.name}`, async () => {
      let transactionCalled = false;
      const revision = readinessCase.revision();
      const prisma = {
        coloringRevision: { findUnique: async () => revision },
        $transaction: async () => {
          transactionCalled = true;
        },
      };
      const service = createService(prisma, {}, {});

      await assert.rejects(
        service.publishRevision("coloring-1", revision.id, "admin-1"),
        BadRequestException,
      );
      assert.equal(transactionCalled, false);
    });
  }

  it("publishes an approved revision with row serialization and CAS", async () => {
    const revision = createStoredRevision();
    const published = createStoredRevision({
      coloring: {
        ...revision.coloring,
        publishedRevisionId: revision.id,
      },
    });
    const calls: string[] = [];
    let coloringUpdate: Record<string, unknown> | undefined;
    let revisionUpdate: Record<string, unknown> | undefined;
    let transactionOptions: unknown;
    let materializedEntries: unknown;
    let privateCleanupKeys: unknown;
    const tx = {
      $queryRaw: async (query: { strings: readonly string[] }) => {
        calls.push("lock");
        assert.match(query.strings.join(""), /JOIN "products"/);
        return [{ id: "coloring-1" }];
      },
      coloringRevision: {
        findUnique: async () => {
          calls.push("readiness");
          return calls.includes("update") ? published : revision;
        },
        updateMany: async (args: Record<string, unknown>) => {
          calls.push("stamp");
          revisionUpdate = args;
          return { count: 1 };
        },
      },
      coloring: {
        updateMany: async (args: Record<string, unknown>) => {
          calls.push("update");
          coloringUpdate = args;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(
        callback: (client: typeof tx) => Promise<T>,
        options: unknown,
      ) => {
        transactionOptions = options;
        return callback(tx);
      },
    };
    const storage = {
      materializePublicPair: async (entries: unknown) => {
        calls.push("materialize");
        materializedEntries = entries;
        return [
          { key: revision.outlineStorageKey, created: true },
          { key: revision.coloredStorageKey, created: true },
          { key: revision.cardStorageKey, created: true },
        ];
      },
      cleanupPrivate: async (keys: unknown) => {
        calls.push("private-cleanup");
        privateCleanupKeys = keys;
      },
      cleanupPublic: async () => {
        calls.push("public-cleanup");
      },
    };
    const service = createService(prisma, {}, storage);

    const result = await service.publishRevision(
      "coloring-1",
      revision.id,
      "admin-1",
    );

    assert.equal(result.status, "published");
    const outline = result.outline as { publicUrl?: string };
    const colored = result.colored as { publicUrl?: string };
    assert.equal(
      outline.publicUrl,
      `http://localhost:3002/colorings/mysterious-forest/01/assets/${revision.id}/outline/content`,
    );
    assert.equal(
      colored.publicUrl,
      `http://localhost:3002/colorings/mysterious-forest/01/assets/${revision.id}/colored/content`,
    );
    assert.deepEqual(transactionOptions, { timeout: 60_000 });
    assert.deepEqual(materializedEntries, [
      {
        key: revision.outlineStorageKey,
        checksum: revision.outlineChecksum,
        width: revision.width,
        height: revision.height,
      },
      {
        key: revision.coloredStorageKey,
        checksum: revision.coloredChecksum,
        width: revision.width,
        height: revision.height,
      },
      {
        key: revision.cardStorageKey,
        checksum: revision.cardChecksum,
        width: revision.cardWidth,
        height: revision.cardHeight,
      },
    ]);
    assert.deepEqual(privateCleanupKeys, [
      revision.outlineStorageKey,
      revision.coloredStorageKey,
      revision.cardStorageKey,
    ]);
    assert.deepEqual(revisionUpdate?.where, {
      coloringId: "coloring-1",
      id: revision.id,
      firstPublishedAt: null,
    });
    assert.equal(
      (revisionUpdate?.data as { firstPublishedAt?: unknown }).firstPublishedAt,
      (coloringUpdate?.data as { publishedAt?: unknown }).publishedAt,
    );
    assert.deepEqual(calls, [
      "lock",
      "readiness",
      "materialize",
      "stamp",
      "update",
      "readiness",
      "private-cleanup",
    ]);
  });

  it("verifies public files when publishing the current revision again", async () => {
    let materialized = false;
    let revisionUpdated = false;
    const revision = createStoredRevision();
    revision.coloring.publishedRevisionId = revision.id;
    revision.coloring.publishedAt = new Date("2026-08-28T10:00:00.000Z");
    revision.firstPublishedAt = new Date("2026-08-28T10:00:00.000Z");
    const tx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => revision,
        updateMany: async () => {
          revisionUpdated = true;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const storage = {
      materializePublicPair: async () => {
        materialized = true;
        return [];
      },
      cleanupPrivate: async () => undefined,
    };
    const service = createService(prisma, {}, storage);

    const result = await service.publishRevision(
      "coloring-1",
      revision.id,
      "admin-1",
    );

    assert.equal(result.status, "published");
    assert.equal(materialized, true);
    assert.equal(revisionUpdated, false);
  });

  it("repairs a legacy current publication without resetting its timestamp", async () => {
    const publishedAt = new Date("2026-08-28T09:30:00.000Z");
    const revision = createStoredRevision();
    const repaired = createStoredRevision({ firstPublishedAt: publishedAt });
    revision.coloring.publishedRevisionId = revision.id;
    revision.coloring.publishedAt = publishedAt;
    repaired.coloring.publishedRevisionId = revision.id;
    repaired.coloring.publishedAt = publishedAt;
    const updates: unknown[] = [];
    let reads = 0;
    const tx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => {
          reads += 1;
          return reads === 1 ? revision : repaired;
        },
        updateMany: async (args: unknown) => {
          updates.push(args);
          return { count: 1 };
        },
      },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const storage = {
      materializePublicPair: async () => [],
      cleanupPrivate: async () => undefined,
    };
    const service = createService(prisma, {}, storage);

    const result = await service.publishRevision(
      "coloring-1",
      revision.id,
      "admin-1",
    );

    assert.equal(result.status, "published");
    assert.deepEqual(updates, [
      {
        where: {
          coloringId: "coloring-1",
          id: revision.id,
          firstPublishedAt: null,
        },
        data: { firstPublishedAt: publishedAt },
      },
    ]);
  });

  it("rejects a stale different publish after acquiring the row lock", async () => {
    const preflight = createStoredRevision();
    const stale = createStoredRevision({
      coloring: {
        ...preflight.coloring,
        updatedAt: new Date("2026-08-28T10:00:01.000Z"),
        publishedRevisionId: "b".repeat(32),
      },
    });
    let materialized = false;
    const tx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: { findUnique: async () => stale },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => preflight },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const storage = {
      materializePublicPair: async () => {
        materialized = true;
        return [];
      },
      cleanupPublic: async () => undefined,
    };
    const service = createService(prisma, {}, storage);

    await assert.rejects(
      service.publishRevision("coloring-1", preflight.id, "admin-1"),
      ConflictException,
    );
    assert.equal(materialized, false);
  });

  it("cleans newly materialized public files when the DB switch fails", async () => {
    const revision = createStoredRevision();
    const cleaned: unknown[] = [];
    const publicationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => revision,
        updateMany: async () => ({ count: 1 }),
      },
      coloring: {
        updateMany: async () => {
          throw new Error("switch failed");
        },
      },
    };
    const reconciliationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: { findUnique: async () => revision },
    };
    let transactions = 0;
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(callback: (client: never) => Promise<T>) => {
        transactions += 1;
        return callback(
          (transactions === 1 ? publicationTx : reconciliationTx) as never,
        );
      },
    };
    const storage = {
      materializePublicPair: async () => [
        { key: revision.outlineStorageKey, created: true },
        { key: revision.coloredStorageKey, created: false },
      ],
      cleanupPublic: async (files: unknown) => {
        cleaned.push(files);
      },
    };
    const service = createService(prisma, {}, storage);

    await assert.rejects(
      service.publishRevision("coloring-1", revision.id, "admin-1"),
      /switch failed/,
    );
    assert.equal(cleaned.length, 1);
    assert.equal(transactions, 2);
  });

  it("keeps public files when a failed transaction response committed the pointer", async () => {
    const revision = createStoredRevision();
    const committed = createStoredRevision({
      firstPublishedAt: new Date("2026-08-28T10:00:00.000Z"),
      coloring: {
        ...revision.coloring,
        publishedRevisionId: revision.id,
      },
    });
    let reads = 0;
    let publicCleanupCalled = false;
    const reconciliationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: { findUnique: async () => committed },
    };
    let publicationReads = 0;
    const publicationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => {
          publicationReads += 1;
          return publicationReads === 1 ? revision : committed;
        },
        updateMany: async () => ({ count: 1 }),
      },
      coloring: { updateMany: async () => ({ count: 1 }) },
    };
    let transactions = 0;
    const prisma = {
      coloringRevision: {
        findUnique: async () => revision,
      },
      $transaction: async <T>(callback: (client: never) => Promise<T>) => {
        transactions += 1;

        if (transactions === 1) {
          await callback(publicationTx as never);
          throw new Error("connection lost after commit");
        }

        reads += 1;
        return callback(reconciliationTx as never);
      },
    };
    const storage = {
      materializePublicPair: async () => [
        { key: revision.outlineStorageKey, created: true },
        { key: revision.coloredStorageKey, created: true },
      ],
      cleanupPrivate: async () => undefined,
      cleanupPublic: async () => {
        publicCleanupCalled = true;
      },
    };
    const service = createService(prisma, {}, storage);

    const result = await service.publishRevision(
      "coloring-1",
      revision.id,
      "admin-1",
    );

    assert.equal(result.status, "published");
    assert.equal(publicCleanupCalled, false);
    assert.equal(reads, 1);
  });

  it("serializes failed-publication cleanup with a concurrent publish", async () => {
    const revision = createStoredRevision();
    const published = createStoredRevision({
      firstPublishedAt: new Date("2026-08-28T10:00:00.000Z"),
      coloring: {
        ...revision.coloring,
        publishedRevisionId: revision.id,
      },
    });
    let transactions = 0;
    let cleanupCalled = false;
    const reconciliationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: { findUnique: async () => published },
    };
    let publicationReads = 0;
    const publicationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => {
          publicationReads += 1;
          return publicationReads === 1 ? revision : published;
        },
        updateMany: async () => ({ count: 1 }),
      },
      coloring: { updateMany: async () => ({ count: 1 }) },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(callback: (client: never) => Promise<T>) => {
        transactions += 1;

        if (transactions === 1) {
          await callback(publicationTx as never);
          throw new Error("publication outcome unknown");
        }

        return callback(reconciliationTx as never);
      },
    };
    const storage = {
      materializePublicPair: async () => [
        { key: revision.outlineStorageKey, created: true },
        { key: revision.coloredStorageKey, created: true },
      ],
      cleanupPrivate: async () => undefined,
      cleanupPublic: async () => {
        cleanupCalled = true;
      },
    };
    const service = createService(prisma, {}, storage);

    const result = await service.publishRevision(
      "coloring-1",
      revision.id,
      "admin-1",
    );

    assert.equal(result.status, "published");
    assert.equal(cleanupCalled, false);
    assert.equal(transactions, 2);
  });

  it("preserves an already published historical revision after an ambiguous commit", async () => {
    const revision = createStoredRevision();
    const historical = createStoredRevision({
      firstPublishedAt: new Date("2026-08-28T10:00:00.000Z"),
      coloring: {
        ...revision.coloring,
        status: ColoringStatus.PUBLISHED,
        publishedRevisionId: "b".repeat(32),
        publishedAt: new Date("2026-08-28T10:00:01.000Z"),
      },
    });
    let transactions = 0;
    let cleanupCalled = false;
    const publicationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: {
        findUnique: async () => revision,
        updateMany: async () => ({ count: 1 }),
      },
      coloring: { updateMany: async () => ({ count: 1 }) },
    };
    const reconciliationTx = {
      $queryRaw: async () => [{ id: "coloring-1" }],
      coloringRevision: { findUnique: async () => historical },
    };
    const prisma = {
      coloringRevision: { findUnique: async () => revision },
      $transaction: async <T>(callback: (client: never) => Promise<T>) => {
        transactions += 1;

        if (transactions === 1) {
          await callback(publicationTx as never);
          throw new Error("publication outcome unknown");
        }

        return callback(reconciliationTx as never);
      },
    };
    const storage = {
      materializePublicPair: async () => [
        { key: revision.outlineStorageKey, created: true },
        { key: revision.coloredStorageKey, created: true },
      ],
      cleanupPublic: async () => {
        cleanupCalled = true;
      },
    };
    const service = createService(prisma, {}, storage);

    await assert.rejects(
      service.publishRevision("coloring-1", revision.id, "admin-1"),
      /publication outcome unknown/,
    );
    assert.equal(cleanupCalled, false);
    assert.equal(transactions, 2);
  });
});

function createService(
  prisma: object,
  media: object,
  storage: object,
): RevisionsApi {
  const prismaWithMarkerColors = {
    markerColor: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        markerColors().filter(({ id }) => args.where.id.in.includes(id)),
    },
    ...prisma,
  };

  return new ColoringRevisionsService(
    prismaWithMarkerColors as unknown as PrismaService,
    media as ColoringMediaService,
    storage as ColoringStorageService,
  ) as unknown as RevisionsApi;
}

function revisionInput(): RevisionInput {
  return {
    markerColorIds: ["marker-color-039", "marker-color-157"],
    outlineAlt: "Контур",
    coloredAlt: "Цветная версия",
  };
}

function markerColors() {
  return [
    {
      id: "marker-color-039",
      colorNumber: 39,
      pantone: "2337U",
      hex: "#FFB7AE",
      markerNumber: "488",
    },
    {
      id: "marker-color-157",
      colorNumber: 157,
      pantone: "169U",
      hex: "#FFB7AE",
      markerNumber: "168",
    },
  ];
}

function createStoredPaletteColor(
  symbolPosition: number,
  markerColorId: string,
) {
  return {
    revisionId: "a".repeat(32),
    markerColorId,
    symbolPosition,
    colorNumber: symbolPosition,
    pantone: "Test U",
    hex: "#ABCDEF",
    markerNumber: String(symbolPosition).padStart(3, "0"),
  };
}

function revisionFiles(): RevisionFiles {
  return {
    outline: [
      {
        buffer: Buffer.from("outline"),
        mimetype: "image/png",
        originalname: "o.png",
        size: 7,
      },
    ],
    colored: [
      {
        buffer: Buffer.from("colored"),
        mimetype: "image/png",
        originalname: "c.png",
        size: 7,
      },
    ],
  };
}

function createRevisionParent({
  coloringStatus = ColoringStatus.DRAFT,
  collectionStatus = ColoringCollectionStatus.DRAFT,
}: {
  coloringStatus?: ColoringStatus;
  collectionStatus?: ColoringCollectionStatus;
} = {}) {
  return {
    id: "coloring-1",
    status: coloringStatus,
    collection: { status: collectionStatus },
  };
}

function processedPair() {
  return {
    width: 1200,
    height: 1600,
    outline: {
      buffer: Buffer.from("safe-outline"),
      sourceMime: "image/png" as const,
      sourceChecksum: "a".repeat(64),
      checksum: "b".repeat(64),
      byteSize: 1024,
      width: 1200,
      height: 1600,
    },
    colored: {
      buffer: Buffer.from("safe-colored"),
      sourceMime: "image/webp" as const,
      sourceChecksum: "c".repeat(64),
      checksum: "d".repeat(64),
      byteSize: 2048,
      width: 1200,
      height: 1600,
    },
    card: {
      buffer: Buffer.from("safe-card"),
      sourceMime: "image/webp" as const,
      sourceChecksum: "c".repeat(64),
      checksum: "f".repeat(64),
      byteSize: 512,
      width: 480,
      height: 640,
    },
  };
}

function createStoredRevision(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-08-28T10:00:00.000Z");
  const id = "a".repeat(32);
  const base = {
    id,
    coloringId: "coloring-1",
    version: 1,
    paletteLabel: "Artmate 168",
    paletteVersion: "2026-08",
    usedColorCount: 12,
    paletteColors: [
      {
        revisionId: id,
        markerColorId: "marker-color-104",
        symbolPosition: 1,
        colorNumber: 104,
        pantone: "11-0601TCX",
        hex: "#F4F9FF",
        markerNumber: "006",
      },
    ],
    width: 1200,
    height: 1600,
    derivativeProfile: "webp-preview-v1",
    colorSpace: "srgb",
    outlineSourceMime: "image/png",
    outlineSourceChecksum: "a".repeat(64),
    outlineStorageKey: `coloring-1/${id}/outline-${"b".repeat(64)}.webp`,
    outlineByteSize: 1024,
    outlineChecksum: "b".repeat(64),
    outlineAlt: "Контур",
    coloredSourceMime: "image/webp",
    coloredSourceChecksum: "c".repeat(64),
    coloredStorageKey: `coloring-1/${id}/colored-${"d".repeat(64)}.webp`,
    coloredByteSize: 2048,
    coloredChecksum: "d".repeat(64),
    coloredAlt: "Цветная версия",
    cardStorageKey: `coloring-1/${id}/card-${"f".repeat(64)}.webp`,
    cardByteSize: 512,
    cardChecksum: "f".repeat(64),
    cardWidth: 480,
    cardHeight: 640,
    firstPublishedAt: null as Date | null,
    createdById: "admin-1",
    createdAt: now,
    review: {
      revisionId: id,
      decision: ColoringRevisionReviewDecision.APPROVED,
      comment: null,
      reviewedById: "admin-1",
      reviewedAt: now,
    },
    coloring: {
      id: "coloring-1",
      number: 1,
      description: "Description",
      status: ColoringStatus.DRAFT,
      updatedAt: now,
      publishedRevisionId: null as string | null,
      publishedAt: null as Date | null,
      collection: {
        slug: "mysterious-forest",
        status: ColoringCollectionStatus.DRAFT,
        product: { status: ProductStatus.PUBLISHED },
      },
      themes: [{ coloringId: "coloring-1", tagId: "theme-1" }],
    },
  };

  return {
    ...base,
    ...overrides,
    coloring:
      "coloring" in overrides
        ? (overrides.coloring as typeof base.coloring)
        : base.coloring,
  };
}

function createCommittedRevision(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return createStoredRevision({
    id,
    review: null,
    outlineStorageKey: `coloring-1/${id}/outline-${"b".repeat(64)}.webp`,
    coloredStorageKey: `coloring-1/${id}/colored-${"d".repeat(64)}.webp`,
    cardStorageKey: `coloring-1/${id}/card-${"f".repeat(64)}.webp`,
    ...overrides,
  });
}
