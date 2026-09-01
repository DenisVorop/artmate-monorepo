import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";
import {
  WorkshopModerationDecision,
  WorkshopRevisionStatus,
  WorkshopToolType,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PublicWorkshopService } from "../src/workshops/public-workshop.service";
import type {
  ProcessedWorkshopPhoto,
  WorkshopMediaService,
} from "../src/workshops/workshop-media.service";
import { WorkshopModerationService } from "../src/workshops/workshop-moderation.service";
import type { WorkshopStorageService } from "../src/workshops/workshop-storage.service";
import { WorkshopService } from "../src/workshops/workshop.service";

describe("WorkshopService", () => {
  it("closes atomically and reopening does not restore work publication flags", async () => {
    const workshop = {
      id: "a".repeat(32),
      ownerId: "user-1",
      handle: "0123456789abcdefabcd",
      isPublic: true,
      isIndexable: false,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-01T10:00:00Z"),
    };
    const workUpdates: unknown[] = [];
    const tx = {
      $queryRaw: async () => [{ id: workshop.id }],
      workshop: {
        findUnique: async () => ({ isPublic: workshop.isPublic }),
        update: async ({
          data,
        }: {
          data: { isPublic: boolean; isIndexable?: boolean };
        }) => {
          workshop.isPublic = data.isPublic;
          if (data.isIndexable !== undefined) {
            workshop.isIndexable = data.isIndexable;
          }
        },
      },
      workshopWork: {
        updateMany: async (args: unknown) => {
          workUpdates.push(args);
          return { count: 2 };
        },
      },
    };
    const prisma = {
      workshop: { findUnique: async () => workshop },
      workshopCollection: { findMany: async () => [] },
      orderItem: { findMany: async () => [] },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = createWorkshopService(prisma);

    const closed = await service.updateVisibility("user-1", {
      isPublic: false,
    });
    const reopened = await service.updateVisibility("user-1", {
      isPublic: true,
    });

    assert.equal(closed.isPublic, false);
    assert.equal(reopened.isPublic, true);
    assert.deepEqual(workUpdates[0], {
      where: { workshopId: workshop.id },
      data: {
        isPublicationEnabled: false,
        isIndexable: false,
        publishedAt: null,
      },
    });
    const reopenUpdate = workUpdates[1] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    assert.deepEqual(reopenUpdate.where, {
      workshopId: workshop.id,
      deletedAt: null,
      isPublicationEnabled: true,
      publishedRevision: { is: { status: WorkshopRevisionStatus.APPROVED } },
    });
    assert.ok(reopenUpdate.data.publishedAt instanceof Date);
    assert.equal("isPublicationEnabled" in reopenUpdate.data, false);
  });

  it("returns uniform 404 for a foreign owner revision before storage", async () => {
    let storageRead = false;
    const service = createWorkshopService(
      { workshopWorkRevision: { findFirst: async () => null } },
      {},
      {
        read: async () => {
          storageRead = true;
          return Buffer.alloc(0);
        },
      },
    );

    await assert.rejects(
      service.getOwnerAsset("user-1", "b".repeat(32), "web"),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === "Workshop resource not found",
    );
    assert.equal(storageRead, false);
  });

  it("hard rejects an exact official source checksum before workshop storage", async () => {
    let stored = false;
    const officialChecksum = "1".repeat(64);
    const tool = customTool();
    const prisma = {
      workshopCollection: {
        findFirst: async () => ({
          workshopId: "a".repeat(32),
          collectionId: "collection-1",
        }),
      },
      coloring: {
        findUnique: async () => ({
          id: "coloring-1",
          publishedRevision: {
            id: "official-revision-1",
            width: 800,
            height: 1000,
            coloredSourceChecksum: officialChecksum,
            coloredStorageKey: "coloring-1/revision/colored.webp",
            coloredChecksum: "2".repeat(64),
            cardChecksum: "3".repeat(64),
          },
        }),
      },
      workshopWork: { findFirst: async () => null },
      workshopTool: { findMany: async () => [tool] },
      markerColor: { findMany: async () => [] },
    };
    const media = {
      processPhoto: async () => ({ sourceChecksum: officialChecksum }),
    };
    const storage = {
      writeAssets: async () => {
        stored = true;
        return [];
      },
    };
    const coloringStorage = {
      readProtected: async () => Buffer.from("official"),
    };
    const service = createWorkshopService(
      prisma,
      media,
      storage,
      coloringStorage,
    );

    await assert.rejects(
      service.createRevision(
        "user-1",
        "forest",
        1,
        {
          intent: "DRAFT",
          crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
          materials: [{ toolId: tool.id }],
          symbolMappings: [],
        },
        {
          buffer: Buffer.from("copy"),
          size: 4,
          mimetype: "image/jpeg",
          originalname: "x.jpg",
        },
      ),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === "Official colored image cannot be uploaded",
    );
    assert.equal(stored, false);
  });

  it("keeps the old publication and official revision for a metadata-only update", async () => {
    const current = revisionRecord({
      id: "c".repeat(32),
      status: WorkshopRevisionStatus.APPROVED,
    });
    const oldPublished = revisionRecord({
      id: "d".repeat(32),
      status: WorkshopRevisionStatus.APPROVED,
    });
    const tool = customTool();
    const revisionCreates: Array<{ data: Record<string, unknown> }> = [];
    const workUpdates: Array<{ data: Record<string, unknown> }> = [];
    const work = {
      id: "b".repeat(32),
      publicId: "0123456789abcdef01234567",
      workshopId: "a".repeat(32),
      collectionId: "collection-1",
      coloringId: "coloring-1",
      attemptNumber: 1,
      revisionSequence: 1,
      currentRevisionId: current.id,
      publishedRevisionId: oldPublished.id,
      isPublicationEnabled: true,
      isIndexable: false,
      publishedAt: new Date("2026-09-01T10:00:00Z"),
      deletedAt: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-01T10:00:00Z"),
      currentRevision: current,
      publishedRevision: oldPublished,
    };
    const tx = {
      $queryRaw: async () => [{ id: work.id }],
      workshopWork: {
        findFirst: async () => work,
        update: async (args: { data: Record<string, unknown> }) => {
          workUpdates.push(args);
          if ("revisionSequence" in args.data) {
            return { revisionSequence: 2 };
          }
          return work;
        },
        findUnique: async () => work,
      },
      workshopWorkRevision: {
        create: async (args: { data: Record<string, unknown> }) => {
          revisionCreates.push(args);
        },
      },
      workshopModerationEvent: { create: async () => ({}) },
    };
    const prisma = {
      workshopCollection: {
        findFirst: async () => ({
          workshopId: work.workshopId,
          collectionId: work.collectionId,
        }),
      },
      coloring: {
        findUnique: async () => ({
          id: work.coloringId,
          publishedRevision: {
            id: "official-revision-2",
            width: 800,
            height: 1000,
            coloredSourceChecksum: "1".repeat(64),
            coloredStorageKey: "official",
            coloredChecksum: "2".repeat(64),
            cardChecksum: "3".repeat(64),
          },
        }),
      },
      workshopWork: { findFirst: async () => work },
      workshopTool: { findMany: async () => [tool] },
      markerColor: { findMany: async () => [] },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = createWorkshopService(prisma);

    await service.createRevision(
      "user-1",
      "forest",
      1,
      {
        intent: "SUBMIT",
        crop: { rotation: 90, zoom: 2, x: 1, y: 1 },
        materials: [{ toolId: tool.id }],
        symbolMappings: [],
      },
      undefined,
    );

    assert.equal(
      revisionCreates[0]?.data.status,
      WorkshopRevisionStatus.PENDING,
    );
    assert.equal(revisionCreates[0]?.data.cropRotation, current.cropRotation);
    assert.equal(
      revisionCreates[0]?.data.officialRevisionId,
      current.officialRevisionId,
    );
    assert.deepEqual(workUpdates[1]?.data, {
      currentRevisionId: revisionCreates[0]?.data.id,
      isPublicationEnabled: true,
    });
    assert.equal("publishedRevisionId" in (workUpdates[1]?.data ?? {}), false);
    assert.equal(work.publishedRevisionId, oldPublished.id);
  });

  it("unpublishes and soft deletes only an owned active work", async () => {
    const work = {
      id: "b".repeat(32),
      publicId: "0123456789abcdef01234567",
      attemptNumber: 1,
      isPublicationEnabled: true,
      isIndexable: false,
      publishedAt: new Date("2026-09-01T10:00:00Z"),
      deletedAt: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      currentRevision: null,
      publishedRevision: null,
    };
    const updates: unknown[] = [];
    const tx = {
      $queryRaw: async () => [{ id: work.id }],
      workshopWork: {
        findFirst: async () => ({
          ...work,
          workshop: { isPublic: true },
          publishedRevision: null,
        }),
        update: async (args: { data: { isPublicationEnabled: boolean } }) => ({
          ...work,
          isPublicationEnabled: args.data.isPublicationEnabled,
        }),
      },
    };
    const prisma = {
      workshopWork: {
        findFirst: async () => work,
        update: async (args: unknown) => {
          updates.push(args);
          return work;
        },
      },
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = createWorkshopService(prisma);

    const unpublished = await service.unpublish("user-1", work.id);
    await service.deleteWork("user-1", work.id);

    assert.equal(unpublished.isPublicationEnabled, false);
    const deletion = updates[0] as {
      where: { id: string };
      data: {
        deletedAt: unknown;
        isPublicationEnabled: boolean;
        isIndexable: boolean;
        publishedAt: null;
      };
    };
    assert.deepEqual(deletion.where, { id: work.id });
    assert.equal(deletion.data.isPublicationEnabled, false);
    assert.equal(deletion.data.isIndexable, false);
    assert.equal(deletion.data.publishedAt, null);
    assert.ok(deletion.data.deletedAt instanceof Date);
  });

  it("allocates the next attempt under a membership lock and rejects a parallel active attempt", async () => {
    const workshopId = "a".repeat(32);
    const collectionId = "collection-1";
    const coloringId = "coloring-1";
    const created: Array<{ data: Record<string, unknown> }> = [];
    let lockSql = "";
    const tx = {
      $queryRaw: async (query: { sql: string }) => {
        lockSql = query.sql;
        return [{ workshopId }];
      },
      workshopWork: {
        findFirst: async (args: { orderBy?: unknown }) =>
          args.orderBy ? { attemptNumber: 1 } : null,
        create: async (args: { data: Record<string, unknown> }) => {
          created.push(args);
          return args.data;
        },
      },
    };
    const service = createWorkshopService({});
    const internals = service as unknown as {
      createNextWorkAttempt(
        client: object,
        input: {
          id: string;
          publicId: string;
          workshopId: string;
          collectionId: string;
          coloringId: string;
        },
      ): Promise<unknown>;
    };
    const input = {
      id: "b".repeat(32),
      publicId: "0123456789abcdef01234567",
      workshopId,
      collectionId,
      coloringId,
    };

    await internals.createNextWorkAttempt(tx, input);

    assert.match(lockSql, /FROM "workshop_collections"[\s\S]*FOR UPDATE/);
    assert.deepEqual(created[0]?.data, { ...input, attemptNumber: 2 });

    let parallelCreateCalled = false;
    const parallelTx = {
      $queryRaw: async () => [{ workshopId }],
      workshopWork: {
        findFirst: async () => ({ id: "c".repeat(32) }),
        create: async () => {
          parallelCreateCalled = true;
        },
      },
    };

    await assert.rejects(
      internals.createNextWorkAttempt(parallelTx, { ...input, id: "d".repeat(32) }),
      ConflictException,
    );
    assert.equal(parallelCreateCalled, false);
  });

  it("derives Artmate marker snapshots and preserves custom marker data on the server", async () => {
    const artmate = customTool({
      id: "1".repeat(32),
      type: WorkshopToolType.ARTMATE_168,
      brand: "Artmate",
      line: "168",
    });
    const custom = customTool({
      id: "2".repeat(32),
      brand: "Copic",
      line: "Sketch",
    });
    const officialColor = {
      id: "marker-color-027",
      colorNumber: 27,
      pantone: "5595C",
      hex: "#BFCEC2",
      markerNumber: "027",
    };
    const service = createWorkshopService({
      workshopTool: { findMany: async () => [custom, artmate] },
      markerColor: { findMany: async () => [officialColor] },
    });
    type MaterialSnapshot = {
      position: number;
      toolId: string;
      toolType: WorkshopToolType;
      brand: string;
      line: string;
    };
    const internals = service as unknown as {
      getMaterialSnapshots(
        userId: string,
        inputs: Array<{ toolId: string }>,
      ): Promise<MaterialSnapshot[]>;
      getMappingSnapshots(
        inputs: Array<{
          symbol: string;
          materialPosition: number;
          markerNumber: string;
          officialMarkerColorId?: string;
        }>,
        materials: MaterialSnapshot[],
      ): Promise<unknown[]>;
    };

    const materials = await internals.getMaterialSnapshots("user-1", [
      { toolId: artmate.id },
      { toolId: custom.id },
    ]);
    const mappings = await internals.getMappingSnapshots(
      [
        {
          symbol: "1",
          materialPosition: 1,
          markerNumber: "999",
          officialMarkerColorId: officialColor.id,
        },
        { symbol: "2", materialPosition: 2, markerNumber: "C5" },
      ],
      materials,
    );

    assert.deepEqual(materials, [
      {
        position: 1,
        toolId: artmate.id,
        toolType: WorkshopToolType.ARTMATE_168,
        brand: "Artmate",
        line: "168",
      },
      {
        position: 2,
        toolId: custom.id,
        toolType: WorkshopToolType.CUSTOM,
        brand: "Copic",
        line: "Sketch",
      },
    ]);
    assert.deepEqual(mappings, [
      {
        symbol: "1",
        materialPosition: 1,
        markerNumber: "027",
        officialMarkerColorId: officialColor.id,
        officialColorNumber: 27,
        officialPantone: "5595C",
        officialHex: "#BFCEC2",
        officialMarkerNumber: "027",
      },
      {
        symbol: "2",
        materialPosition: 2,
        markerNumber: "C5",
        officialMarkerColorId: null,
        officialColorNumber: null,
        officialPantone: null,
        officialHex: null,
        officialMarkerNumber: null,
      },
    ]);
  });

  it("reserves the Artmate 168 identity for the official catalog", async () => {
    let createCalls = 0;
    const service = createWorkshopService({
      workshopTool: {
        create: async () => {
          createCalls += 1;
          return customTool();
        },
      },
    });

    await assert.rejects(
      service.createTool("user-1", {
        type: "CUSTOM",
        brand: "artmate",
        line: "168",
      }),
      BadRequestException,
    );
    assert.equal(createCalls, 0);
  });

  it("preserves uploaded assets when commit reconciliation cannot read the revision", async () => {
    const transactionError = new Error("connection lost after commit");
    const tool = customTool();
    const processed = processedPhoto();
    let cleanupCalls = 0;
    const prisma = {
      workshopCollection: {
        findFirst: async () => ({
          workshopId: "a".repeat(32),
          collectionId: "collection-1",
        }),
      },
      coloring: {
        findUnique: async () => ({
          id: "coloring-1",
          publishedRevision: {
            id: "official-revision-1",
            width: 800,
            height: 1000,
            coloredSourceChecksum: "1".repeat(64),
            coloredStorageKey: "coloring-1/revision/colored.webp",
            coloredChecksum: "2".repeat(64),
            cardChecksum: "3".repeat(64),
          },
        }),
      },
      workshopWork: { findFirst: async () => null },
      workshopTool: { findMany: async () => [tool] },
      markerColor: { findMany: async () => [] },
      workshopWorkRevision: {
        findUnique: async () => {
          throw new Error("reconciliation unavailable");
        },
      },
      $transaction: async () => {
        throw transactionError;
      },
    };
    const storage = {
      writeAssets: async (entries: Array<{ key: string }>) =>
        entries.map(({ key }) => ({ key, created: true })),
      cleanup: async () => {
        cleanupCalls += 1;
      },
    };
    const service = createWorkshopService(
      prisma,
      { processPhoto: async () => processed },
      storage,
      { readProtected: async () => Buffer.from("official") },
    );

    await assert.rejects(
      service.createRevision(
        "user-1",
        "forest",
        1,
        {
          intent: "DRAFT",
          crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
          materials: [{ toolId: tool.id }],
          symbolMappings: [],
        },
        {
          buffer: Buffer.from("photo"),
          size: 5,
          mimetype: "image/jpeg",
          originalname: "x.jpg",
        },
      ),
      (error: unknown) => error === transactionError,
    );
    assert.equal(cleanupCalls, 0);
  });
});

describe("PublicWorkshopService", () => {
  it("rejects a stale report revision before creating a revision-scoped report", async () => {
    const publishedRevisionId = "d".repeat(32);
    let created = false;
    const prisma = {
      workshopWork: {
        findFirst: async () => ({
          id: "b".repeat(32),
          publishedRevision: { id: publishedRevisionId },
        }),
      },
      workshopWorkReport: {
        create: async () => {
          created = true;
          return {
            status: "OPEN",
            createdAt: new Date("2026-09-01T10:00:00Z"),
          };
        },
      },
    };
    const service = new PublicWorkshopService(
      prisma as unknown as PrismaService,
      {} as WorkshopStorageService,
    );

    await assert.rejects(
      service.report("public-work", "reporter-1", {
        revisionId: "e".repeat(32),
        reason: "SPAM",
      }),
      ConflictException,
    );
    assert.equal(created, false);
  });

  it("does not expose advertising consent in a public work payload", async () => {
    const prisma = {
      workshopWork: {
        findFirst: async () => ({
          id: "b".repeat(32),
          publicId: "public-work",
          publishedAt: new Date("2026-09-01T10:00:00Z"),
          workshop: {
            handle: "0123456789abcdefabcd",
            owner: { name: "Author", image: null },
          },
          coloring: {
            number: 1,
            title: "Forest",
            collection: {
              slug: "forest",
              title: "Forest",
              product: {
                slug: "forest-album",
                title: "Forest album",
                category: null,
              },
            },
          },
          publishedRevision: {
            id: "d".repeat(32),
            caption: "My work",
            advertisingConsent: true,
            materials: [],
            symbolMappings: [],
            officialRevision: {
              id: "official-revision-1",
              paletteLabel: "Artmate 168",
              paletteVersion: "1",
              paletteColors: [],
            },
          },
        }),
      },
    };
    const service = new PublicWorkshopService(
      prisma as unknown as PrismaService,
      {} as WorkshopStorageService,
    );

    const response = await service.getWork("public-work");

    assert.equal("advertisingConsent" in response.submission, false);
  });
});

describe("WorkshopModerationService", () => {
  it("marks only the exact published revision in moderation list and detail", async () => {
    const stale = moderationRevision({
      id: "c".repeat(32),
      publishedRevisionId: "d".repeat(32),
    });
    const published = moderationRevision({
      id: "d".repeat(32),
      publishedRevisionId: "d".repeat(32),
    });
    let listWhere: unknown;
    const prisma = {
      workshopWorkRevision: {
        findMany: async (args: { where: unknown }) => {
          listWhere = args.where;
          return [stale, published];
        },
        findFirst: async () => published,
      },
    };
    const service = new WorkshopModerationService(
      prisma as unknown as PrismaService,
      {} as WorkshopStorageService,
      {} as ColoringStorageService,
    );

    const list = await service.list("APPROVED");
    const detail = await service.get(published.id);

    assert.deepEqual(listWhere, {
      status: WorkshopRevisionStatus.APPROVED,
      work: { is: { deletedAt: null } },
    });
    assert.equal(list[0]?.isPublishedRevision, false);
    assert.equal(list[1]?.isPublishedRevision, true);
    assert.equal("decisionHistory" in list[0]!, false);
    assert.equal(detail.isPublishedRevision, true);
  });

  it("returns chronological work-scoped moderation history with revision ids", async () => {
    const revisionId = "d".repeat(32);
    const previousRevisionId = "c".repeat(32);
    const revision = moderationRevision({
      id: revisionId,
      publishedRevisionId: revisionId,
      moderationEvents: [
        {
          id: "2".repeat(32),
          revisionId,
          decision: WorkshopModerationDecision.APPROVED,
          reason: null,
          actor: { id: "admin-1", name: "Admin" },
          createdAt: new Date("2026-09-01T11:00:00Z"),
        },
        {
          id: "1".repeat(32),
          revisionId: previousRevisionId,
          decision: WorkshopModerationDecision.CHANGES_REQUESTED,
          reason: "Adjust the crop",
          actor: { id: "admin-2", name: "Reviewer" },
          createdAt: new Date("2026-09-01T10:00:00Z"),
        },
      ],
    });
    const prisma = {
      workshopWorkRevision: { findFirst: async () => revision },
    };
    const service = new WorkshopModerationService(
      prisma as unknown as PrismaService,
      {} as WorkshopStorageService,
      {} as ColoringStorageService,
    );

    const detail = await service.get(revisionId);

    assert.deepEqual(detail.decisionHistory, [
      {
        id: "1".repeat(32),
        revisionId: previousRevisionId,
        decision: WorkshopModerationDecision.CHANGES_REQUESTED,
        reason: "Adjust the crop",
        actor: { id: "admin-2", name: "Reviewer" },
        createdAt: "2026-09-01T10:00:00.000Z",
      },
      {
        id: "2".repeat(32),
        revisionId,
        decision: WorkshopModerationDecision.APPROVED,
        reason: undefined,
        actor: { id: "admin-1", name: "Admin" },
        createdAt: "2026-09-01T11:00:00.000Z",
      },
    ]);
  });

  it("returns 404 for deleted-work moderation detail and admin assets", async () => {
    const revisionId = "d".repeat(32);
    const lookups: unknown[] = [];
    let storageRead = false;
    let officialRead = false;
    const prisma = {
      workshopWorkRevision: {
        findFirst: async (args: { where: unknown }) => {
          lookups.push(args.where);
          return null;
        },
      },
    };
    const service = new WorkshopModerationService(
      prisma as unknown as PrismaService,
      {
        read: async () => {
          storageRead = true;
        },
      } as unknown as WorkshopStorageService,
      {
        readProtected: async () => {
          officialRead = true;
        },
      } as unknown as ColoringStorageService,
    );

    await assert.rejects(service.get(revisionId), NotFoundException);
    await assert.rejects(service.getAsset(revisionId, "web"), NotFoundException);
    await assert.rejects(service.getAsset(revisionId, "official"), NotFoundException);

    assert.deepEqual(lookups, [
      { id: revisionId, work: { is: { deletedAt: null } } },
      { id: revisionId, work: { is: { deletedAt: null } } },
      { id: revisionId, work: { is: { deletedAt: null } } },
    ]);
    assert.equal(storageRead, false);
    assert.equal(officialRead, false);
  });

  it("returns 404 when a work is soft deleted before moderation decision", async () => {
    const revision = pendingRevision();
    revision.work.deletedAt = new Date("2026-09-01T11:00:00Z");
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const service = createModerationService(
      moderationTx(revision, updates, events),
    );

    await assert.rejects(
      service.decide(revision.id, "admin-1", { decision: "APPROVE" }),
      NotFoundException,
    );
    assert.deepEqual(updates, []);
    assert.deepEqual(events, []);
  });

  it("approval binds the exact pending revision and atomically switches the pointer", async () => {
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const revision = pendingRevision();
    const tx = moderationTx(revision, updates, events);
    const service = createModerationService(tx);

    await service.decide(revision.id, "admin-1", { decision: "APPROVE" });

    assert.deepEqual(updates[0], {
      where: { id: revision.workId },
      data: { publishedRevisionId: revision.id, publishedAt: null },
    });
    assert.equal(
      (events[0] as { data: { decision: WorkshopModerationDecision } }).data
        .decision,
      WorkshopModerationDecision.APPROVED,
    );
  });

  it("request changes requires a reason and preserves an older publication", async () => {
    const revision = pendingRevision();
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const tx = moderationTx(revision, updates, events);
    const service = createModerationService(tx);

    await assert.rejects(
      service.decide(revision.id, "admin-1", { decision: "REQUEST_CHANGES" }),
      BadRequestException,
    );
    await service.decide(revision.id, "admin-1", {
      decision: "REQUEST_CHANGES",
      reason: "Please adjust the crop",
    });

    assert.equal(updates.length, 0);
    assert.equal(
      (events[0] as { data: { decision: WorkshopModerationDecision } }).data
        .decision,
      WorkshopModerationDecision.CHANGES_REQUESTED,
    );
  });

  it("rejects approval when the pending revision is no longer current", async () => {
    const revision = pendingRevision();
    revision.work.currentRevisionId = "e".repeat(32);
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const service = createModerationService(
      moderationTx(revision, updates, events),
    );

    await assert.rejects(
      service.decide(revision.id, "admin-1", { decision: "APPROVE" }),
      ConflictException,
    );
    assert.deepEqual(updates, []);
    assert.deepEqual(events, []);
  });

  it("hide clears publication only for the exact published revision", async () => {
    const revision = pendingRevision({
      status: WorkshopRevisionStatus.APPROVED,
    });
    revision.work.publishedRevisionId = revision.id;
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const tx = moderationTx(revision, updates, events);
    const service = createModerationService(tx);

    await service.decide(revision.id, "admin-1", {
      decision: "HIDE",
      reason: "Policy violation",
    });

    assert.deepEqual(updates[0], {
      where: { id: revision.workId },
      data: {
        publishedRevisionId: null,
        isPublicationEnabled: false,
        isIndexable: false,
        publishedAt: null,
      },
    });
  });

  it("rejects hiding an approved revision which is no longer published", async () => {
    const revision = pendingRevision({
      status: WorkshopRevisionStatus.APPROVED,
    });
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const service = createModerationService(
      moderationTx(revision, updates, events),
    );

    await assert.rejects(
      service.decide(revision.id, "admin-1", {
        decision: "HIDE",
        reason: "Policy violation",
      }),
      ConflictException,
    );
    assert.deepEqual(updates, []);
    assert.deepEqual(events, []);
  });
});

function createWorkshopService(
  prisma: object,
  media: object = {},
  storage: object = {},
  coloringStorage: object = {},
) {
  return new WorkshopService(
    prisma as PrismaService,
    media as WorkshopMediaService,
    storage as WorkshopStorageService,
    coloringStorage as ColoringStorageService,
  );
}

function pendingRevision(overrides: Record<string, unknown> = {}) {
  const revisionId = "d".repeat(32);
  const workId = "b".repeat(32);
  const base = {
    id: revisionId,
    workId,
    status: WorkshopRevisionStatus.PENDING,
    work: {
      id: workId,
      currentRevisionId: revisionId,
      publishedRevisionId: "c".repeat(32),
      isPublicationEnabled: false,
      deletedAt: null as Date | null,
      workshop: { isPublic: true },
    },
  };
  return { ...base, ...overrides };
}

function moderationRevision({
  id,
  publishedRevisionId,
  moderationEvents = [],
}: {
  id: string;
  publishedRevisionId: string | null;
  moderationEvents?: Array<{
    id: string;
    revisionId: string;
    decision: WorkshopModerationDecision;
    reason: string | null;
    actor: { id: string; name: string | null };
    createdAt: Date;
  }>;
}) {
  return revisionRecord({
    id,
    workId: "b".repeat(32),
    status: WorkshopRevisionStatus.APPROVED,
    submittedAt: new Date("2026-09-01T09:30:00Z"),
    work: {
      id: "b".repeat(32),
      publishedRevisionId,
      deletedAt: null,
      moderationEvents,
      workshop: {
        handle: "0123456789abcdefabcd",
        owner: { id: "user-1", name: "Author", image: null },
      },
      coloring: {
        id: "coloring-1",
        number: 1,
        title: "Forest",
        collection: { id: "collection-1", slug: "forest", title: "Forest" },
      },
    },
    officialRevision: {
      id: "official-revision-1",
      version: 1,
      paletteLabel: "Artmate 168",
      paletteVersion: "1",
      paletteColors: [],
    },
  });
}

function moderationTx(
  revision: ReturnType<typeof pendingRevision>,
  workUpdates: unknown[],
  events: unknown[],
) {
  return {
    $queryRaw: async () => [{ id: revision.id }],
    workshopWorkRevision: {
      findUnique: async () => revision,
      updateMany: async () => ({ count: 1 }),
    },
    workshopWork: {
      findUnique: async () => revision.work,
      update: async (args: unknown) => {
        workUpdates.push(args);
      },
    },
    workshopModerationEvent: {
      create: async (args: unknown) => {
        events.push(args);
      },
    },
  };
}

function createModerationService(tx: ReturnType<typeof moderationTx>) {
  const prisma = {
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
      callback(tx),
  };
  const service = new WorkshopModerationService(
    prisma as unknown as PrismaService,
    {} as WorkshopStorageService,
    {} as ColoringStorageService,
  );
  service.get = async () => ({}) as never;
  return service;
}

function revisionRecord(overrides: Record<string, unknown> = {}) {
  const id = "c".repeat(32);
  const checksum = "1".repeat(64);
  return {
    id,
    workId: "b".repeat(32),
    coloringId: "coloring-1",
    sequence: 1,
    officialRevisionId: "official-revision-1",
    status: WorkshopRevisionStatus.DRAFT,
    caption: null,
    advertisingConsent: false,
    cropRotation: 0,
    cropZoom: 1,
    cropX: 0,
    cropY: 0,
    sourceMime: "image/jpeg",
    sourceChecksum: "2".repeat(64),
    perceptualHash: null,
    normalizedStorageKey: `${"b".repeat(32)}/${id}/normalized-${checksum}.webp`,
    normalizedChecksum: checksum,
    normalizedByteSize: 100,
    normalizedWidth: 800,
    normalizedHeight: 1000,
    webStorageKey: `${"b".repeat(32)}/${id}/web-${checksum}.webp`,
    webChecksum: checksum,
    webByteSize: 100,
    webWidth: 800,
    webHeight: 1000,
    thumbStorageKey: `${"b".repeat(32)}/${id}/thumb-${checksum}.webp`,
    thumbChecksum: checksum,
    thumbByteSize: 100,
    thumbWidth: 320,
    thumbHeight: 400,
    suspectedOfficialCopy: false,
    submittedAt: null,
    moderatedAt: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    materials: [],
    symbolMappings: [],
    moderationEvents: [],
    ...overrides,
  };
}

function customTool(overrides: Record<string, unknown> = {}) {
  return {
    id: "e".repeat(32),
    userId: "user-1",
    type: WorkshopToolType.CUSTOM,
    brand: "Copic",
    line: "Sketch",
    ...overrides,
  };
}

function processedPhoto(): ProcessedWorkshopPhoto {
  const asset = (checksum: string, width: number, height: number) => ({
    buffer: Buffer.from(checksum),
    checksum,
    byteSize: checksum.length,
    width,
    height,
  });

  return {
    sourceMime: "image/jpeg",
    sourceChecksum: "4".repeat(64),
    perceptualHash: "5".repeat(16),
    suspectedOfficialCopy: false,
    normalized: asset("6".repeat(64), 800, 1000),
    web: asset("7".repeat(64), 800, 1000),
    thumb: asset("8".repeat(64), 320, 400),
  };
}
