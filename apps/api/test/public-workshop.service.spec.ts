import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrismaService } from "../src/prisma/prisma.service";
import { ColoringStatus, type Prisma } from "../src/generated/prisma/client";
import type { WorkshopStorageService } from "../src/workshops/workshop-storage.service";
import { PublicWorkshopService } from "../src/workshops/public-workshop.service";

const checksum = "a".repeat(64);

describe("PublicWorkshopService original comparison", () => {
  it("uses the ready published original and preserves the historical palette snapshot", async () => {
    const work = createWork();
    const service = createService(work);
    const result = await withApiUrl(() => service.getWork("public-work"));

    assert.equal(
      result.official.coloredUrl,
      `https://api.artmate.ru/colorings/forest/01/variants/assets/original/colored/${checksum}/content`,
    );
    assert.deepEqual(result.official.palette, {
      label: "Historical palette",
      version: "2025-01",
      colors: [
        {
          symbolPosition: 1,
          symbol: "1",
          colorNumber: 39,
          pantone: "2337U",
          hex: "#123456",
          markerNumber: "488",
        },
      ],
    });
    assert.deepEqual(result.submission.materials, [
      { position: 0, type: "MARKER", brand: "Brand", line: "Line" },
    ]);
  });

  for (const [name, mutate] of [
    [
      "draft",
      (work: ReturnType<typeof createWork>) =>
        Object.assign(work.coloring.artwork.original, {
          status: ColoringStatus.DRAFT,
        }),
    ],
    [
      "incomplete",
      (work: ReturnType<typeof createWork>) =>
        (work.coloring.artwork.original.cardChecksum = ""),
    ],
    [
      "incomplete contour",
      (work: ReturnType<typeof createWork>) =>
        (work.coloring.artwork.outlineStorageKey = ""),
    ],
    [
      "oversized contour",
      (work: ReturnType<typeof createWork>) =>
        (work.coloring.artwork.width = 4097),
    ],
  ] as const) {
    it(`keeps the historical comparison asset when the original is ${name}`, async () => {
      const work = createWork();
      mutate(work);
      const result = await withApiUrl(() =>
        createService(work).getWork("public-work"),
      );
      assert.equal(
        result.official.coloredUrl,
        "https://api.artmate.ru/colorings/forest/01/assets/historical-revision/colored/content",
      );
    });
  }
});

describe("PublicWorkshopService gallery", () => {
  it("applies multiple albums and picture number before pagination, preserving public eligibility", async () => {
    let query: Prisma.WorkshopWorkFindManyArgs | undefined;
    const service = new PublicWorkshopService(
      {
        $queryRaw: async () => [],
        workshopWork: {
          findMany: async (args: Prisma.WorkshopWorkFindManyArgs) => {
            query = args;
            return [];
          },
        },
      } as unknown as PrismaService,
      {} as WorkshopStorageService,
    );
    const albums = ["cifrovaya-raskraska-kotiki-2", "flowers"];
    await service.getGalleryWorks(undefined, albums, 17);
    const conditions = query!.where!.AND as Prisma.WorkshopWorkWhereInput[];
    assert.equal(conditions[0]!.isPublicationEnabled, true);
    assert.deepEqual(conditions[0]!.publishedRevision, {
      is: { status: "APPROVED" },
    });
    assert.deepEqual(conditions[1], {
      coloring: { is: { collection: { is: { slug: { in: albums } } } } },
    });
    assert.deepEqual(conditions[2], { coloring: { is: { number: 17 } } });
    assert.equal(query!.take, 61);
    await assert.rejects(service.getGalleryWorks(undefined, ["bad/slug"]), {
      message: "Invalid gallery filter",
    });
    await assert.rejects(service.getGalleryWorks(undefined, [], 0), {
      message: "Invalid gallery filter",
    });
    await assert.rejects(service.getGalleryWorks(undefined, [], 100), {
      message: "Invalid gallery filter",
    });
    await assert.rejects(service.getGalleryWorks(undefined, [], 1.5), {
      message: "Invalid gallery filter",
    });
  });

  it("builds album and picture choices from public works without author metadata", async () => {
    let query: Prisma.WorkshopWorkFindManyArgs | undefined;
    const rows = [
      {
        coloring: { number: 17, collection: { slug: "cats", title: "Котики" } },
      },
      {
        coloring: { number: 8, collection: { slug: "cats", title: "Котики" } },
      },
      {
        coloring: { number: 8, collection: { slug: "cats", title: "Котики" } },
      },
      {
        coloring: {
          number: 3,
          collection: { slug: "flowers", title: "Цветы" },
        },
      },
    ];
    const service = new PublicWorkshopService(
      {
        $queryRaw: async () => [],
        workshopWork: {
          findMany: async (args: Prisma.WorkshopWorkFindManyArgs) => {
            query = args;
            return rows;
          },
        },
      } as unknown as PrismaService,
      {} as WorkshopStorageService,
    );
    const filters = await service.getGalleryFilters();
    assert.deepEqual(filters, {
      collections: [
        { slug: "cats", title: "Котики", numbers: [8, 17] },
        { slug: "flowers", title: "Цветы", numbers: [3] },
      ],
    });
    assert.equal(query!.where!.deletedAt, null);
    assert.equal(query!.where!.isPublicationEnabled, true);
    assert.deepEqual(query!.where!.publishedRevision, {
      is: { status: "APPROVED" },
    });
    assert.equal("include" in query!, false);
    assert.equal("workshop" in query!.select!, false);
  });

  it("paginates across collections using the published date and a stable tie-breaker", async () => {
    const publishedAt = new Date("2026-10-30T12:00:00.000Z");
    const works = Array.from({ length: 61 }, (_, index) => ({
      ...createWork(),
      id: (1000 - index).toString(16).padStart(32, "0"),
      publicId: (1000 - index).toString(16).padStart(24, "0"),
      publishedAt,
    }));
    works[1]!.coloring.collection.slug = "another-collection";
    let rows = works;
    const calls: Prisma.WorkshopWorkFindManyArgs[] = [];
    const service = new PublicWorkshopService(
      {
        $queryRaw: async () => [],
        workshopWork: {
          findMany: async (args: Prisma.WorkshopWorkFindManyArgs) => {
            calls.push(args);
            return rows;
          },
        },
      } as unknown as PrismaService,
      {} as WorkshopStorageService,
    );
    const first = await service.getGalleryWorks();
    assert.equal(first.works.length, 60);
    assert.equal(
      first.works[1]!.source === "workshop"
        ? first.works[1]!.official.collection.slug
        : undefined,
      "another-collection",
    );
    assert.equal(
      first.nextCursor,
      `${publishedAt.toISOString()}_workshop_${works[59]!.id}`,
    );
    assert.equal(calls[0]!.take, 61);
    assert.deepEqual(calls[0]!.orderBy, [
      { publishedAt: "desc" },
      { id: "desc" },
    ]);
    const conditions = calls[0]!.where!.AND as Prisma.WorkshopWorkWhereInput[];
    assert.equal(conditions.length, 1);
    assert.equal(conditions[0]!.deletedAt, null);
    assert.equal(conditions[0]!.isPublicationEnabled, true);
    assert.deepEqual(conditions[0]!.publishedRevision, {
      is: { status: "APPROVED" },
    });
    assert.deepEqual(conditions[0]!.workshop, {
      is: {
        isPublic: true,
        owner: { is: { status: "ACTIVE", deletedAt: null } },
      },
    });
    assert.equal("publicationConsent" in first.works[0]!.submission, false);
    rows = works.slice(60);
    const second = await service.getGalleryWorks(first.nextCursor!);
    assert.equal(second.works.length, 1);
    assert.equal(second.works[0]!.publicId, works[60]!.publicId);
    assert.equal(second.nextCursor, null);
    assert.deepEqual(
      (calls[1]!.where!.AND as Prisma.WorkshopWorkWhereInput[])[1],
      {
        OR: [
          { publishedAt: { lt: publishedAt } },
          { publishedAt, id: { lt: works[59]!.id } },
        ],
      },
    );
    rows = works.slice(0, 60);
    assert.equal((await service.getGalleryWorks()).nextCursor, null);
  });

  it("rejects malformed cursors before querying public works", async () => {
    const service = new PublicWorkshopService(
      {
        $queryRaw: async () => [],
        workshopWork: {
          findMany: async () => {
            throw new Error("Must not query for invalid cursor");
          },
        },
      } as unknown as PrismaService,
      {} as WorkshopStorageService,
    );
    for (const cursor of [
      "",
      "invalid",
      `2026-02-30T00:00:00.000Z_${"a".repeat(32)}`,
      `2026-10-30T00:00:00.000Z_${"a".repeat(24)}`,
    ]) {
      await assert.rejects(service.getGalleryWorks(cursor), {
        message: "Invalid works cursor",
      });
    }
  });

  it("merges workshop and contest sources before limiting the page", async () => {
    const publishedAt = new Date("2026-11-01T12:00:00Z");
    const identity = (value: number) => value.toString(16).padStart(32, "0");
    const publicIdentity = (value: number) =>
      value.toString(16).padStart(24, "0");
    let workshopRows = Array.from({ length: 32 }, (_, index) => ({
      ...createWork(),
      id: identity(index * 2 + 1),
      publicId: publicIdentity(index * 2 + 1),
      publishedAt,
    })).reverse();
    let contestRows = Array.from({ length: 32 }, (_, index) => ({
      id: identity(index * 2 + 2),
      publicId: publicIdentity(index * 2 + 2),
      publishedAt,
      user: { name: "Участник конкурса" },
      contest: { slug: "winter", title: "Зима" },
      revisions: [
        {
          caption: "Праздничная фотография",
          number: null,
          product: {
            slug: "album",
            title: "Альбом",
            category: null,
            coloringCollection: null,
          },
        },
      ],
    })).reverse();
    const service = new PublicWorkshopService(
      {
        workshopWork: { findMany: async () => workshopRows },
        contestEntry: { findMany: async () => contestRows },
        $queryRaw: async () => contestRows.map((row) => ({ id: row.id })),
      } as unknown as PrismaService,
      {} as WorkshopStorageService,
    );
    const first = await service.getGalleryWorks();
    assert.equal(first.works.length, 60);
    assert.equal(first.works[0]!.source, "contest");
    assert.equal(first.works[1]!.source, "workshop");
    assert.equal("official" in first.works[0]!, false);
    assert.equal(
      first.nextCursor,
      `${publishedAt.toISOString()}_workshop_${identity(5)}`,
    );
    workshopRows = workshopRows.filter((row) => row.id < identity(5));
    contestRows = contestRows.filter((row) => row.id < identity(5));
    const last = await service.getGalleryWorks(first.nextCursor!);
    assert.equal(last.nextCursor, null);
    const ids = [...first.works, ...last.works].map((row) => row.publicId);
    assert.deepEqual(
      ids,
      Array.from({ length: 64 }, (_, index) => publicIdentity(64 - index)),
    );
  });
});

function createService(work: ReturnType<typeof createWork>) {
  return new PublicWorkshopService(
    {
      workshopWork: { findFirst: async () => work },
    } as unknown as PrismaService,
    {} as WorkshopStorageService,
  );
}

function createWork() {
  return {
    id: "work-id",
    publicId: "public-work",
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    workshop: { handle: "artist", owner: { name: "Автор", image: null } },
    coloring: {
      number: 1,
      title: "Лесная картина",
      collection: {
        slug: "forest",
        title: "Лес",
        product: { slug: "album", title: "Альбом", category: null },
      },
      artwork: {
        width: 1200,
        height: 800,
        derivativeProfile: "webp-preview-v3",
        colorSpace: "srgb",
        outlineStorageKey: "public/outline.webp",
        outlineChecksum: "e".repeat(64),
        outlineByteSize: 1_000,
        outlineSourceChecksum: "f".repeat(64),
        outlineSourceMime: "image/png",
        outlineAlt: "Контур лесной картины",
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        original: {
          imageStorageKey: "original.webp",
          imageChecksum: checksum,
          imageByteSize: 1000,
          sourceChecksum: "b".repeat(64),
          sourceMime: "image/png",
          imageAlt: "Оригинал",
          cardStorageKey: "original-card.webp",
          cardChecksum: "c".repeat(64),
          cardByteSize: 300,
          cardWidth: 400,
          cardHeight: 300,
          status: ColoringStatus.PUBLISHED,
          publishedAt: new Date("2026-09-01T00:00:00.000Z"),
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
          colors: [{ symbolPosition: 1, hex: "#123456" }],
        },
      },
    },
    publishedRevision: {
      id: "published-work-revision",
      caption: null,
      materials: [
        { position: 0, toolType: "MARKER", brand: "Brand", line: "Line" },
      ],
      symbolMappings: [],
      officialRevision: {
        id: "historical-revision",
        version: 1,
        paletteLabel: "Historical palette",
        paletteVersion: "2025-01",
        paletteColors: [
          {
            symbolPosition: 1,
            colorNumber: 39,
            pantone: "2337U",
            hex: "#123456",
            markerNumber: "488",
          },
        ],
      },
    },
  };
}

async function withApiUrl<T>(callback: () => Promise<T>) {
  const previous = process.env.API_PUBLIC_URL;
  process.env.API_PUBLIC_URL = "https://api.artmate.ru/";
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.API_PUBLIC_URL;
    else process.env.API_PUBLIC_URL = previous;
  }
}
