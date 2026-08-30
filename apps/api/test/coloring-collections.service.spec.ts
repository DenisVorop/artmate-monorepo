import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import {
  ColoringCollectionStatus,
  ColoringRevisionReviewDecision,
  ColoringStatus,
  ProductStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ColoringCollectionsService } from "../src/colorings/coloring-collections.service";
import { ColoringsService } from "../src/colorings/colorings.service";
import {
  ColoringCollectionDTO,
  CreateColoringCollectionRequestDTO,
  PublicColoringCollectionDTO,
  PublicColoringCollectionSummaryDTO,
  UpdateColoringCollectionRequestDTO,
} from "../src/colorings/dto";
import { PublicColoringCollectionsService } from "../src/colorings/public-coloring-collections.service";
import { PublicColoringsService } from "../src/colorings/public-colorings.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";

describe("ColoringCollectionsService", () => {
  it("creates one draft collection for an existing product and maps counts", async () => {
    const stored = createAdminCollection();
    const writes: unknown[] = [];
    const tx = {
      product: {
        findUnique: async () => ({ id: stored.productId }),
      },
      coloringCollection: {
        create: async ({ data }: { data: unknown }) => {
          writes.push(data);
          return { id: stored.id };
        },
        findUnique: async () => stored,
      },
    };
    const service = new ColoringCollectionsService({
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    } as unknown as PrismaService);

    const result = await service.createCollection({
      productId: " product-1 ",
      slug: " mysterious-forest ",
      title: " Загадочный лес ",
      description: " 25 сюжетов ",
      position: 3,
      expectedColoringCount: 25,
    });

    assert.deepEqual(writes, [
      {
        productId: "product-1",
        slug: "mysterious-forest",
        title: "Загадочный лес",
        description: "25 сюжетов",
        position: 3,
        expectedColoringCount: 25,
        status: ColoringCollectionStatus.DRAFT,
      },
    ]);
    assert.deepEqual(result, expectedAdminCollection());
    assert.deepEqual(
      validateSync(plainToInstance(ColoringCollectionDTO, result)),
      [],
    );
  });

  it("uses client updatedAt as a real compare-and-swap token", async () => {
    const stored = createAdminCollection();
    let updateCalled = false;
    const tx = {
      coloringCollection: {
        findUnique: async () => ({
          id: stored.id,
          status: stored.status,
          updatedAt: stored.updatedAt,
        }),
        updateMany: async () => {
          updateCalled = true;
          return { count: 1 };
        },
      },
    };
    const service = new ColoringCollectionsService({
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    } as unknown as PrismaService);

    await assert.rejects(
      service.updateCollection(stored.id, {
        title: "Новое название",
        updatedAt: "2026-08-29T11:59:59.000Z",
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message === "Coloring collection changed concurrently",
    );
    assert.equal(updateCalled, false);
  });

  it("rejects lowering expected count below the highest assigned number", async () => {
    const stored = createAdminCollection();
    let updateCalled = false;
    let lockCalled = false;
    const tx = {
      $queryRaw: async () => {
        lockCalled = true;
        return [{ id: stored.id }];
      },
      coloring: {
        findFirst: async () => ({ number: 12 }),
      },
      coloringCollection: {
        findUnique: async () => ({
          id: stored.id,
          status: stored.status,
          updatedAt: stored.updatedAt,
        }),
        updateMany: async () => {
          updateCalled = true;
          return { count: 1 };
        },
      },
    };
    const service = new ColoringCollectionsService({
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    } as unknown as PrismaService);

    await assert.rejects(
      service.updateCollection(stored.id, {
        expectedColoringCount: 11,
        updatedAt: stored.updatedAt.toISOString(),
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Expected coloring count cannot be lower than an assigned coloring number",
    );
    assert.equal(lockCalled, true);
    assert.equal(updateCalled, false);
  });

  it("rejects expected counts above 99 in create and update DTOs", () => {
    const createDto = plainToInstance(CreateColoringCollectionRequestDTO, {
        productId: "product-1",
        slug: "mysterious-forest",
        title: "Загадочный лес",
        position: 0,
        expectedColoringCount: 100,
    });
    const updateDto = plainToInstance(UpdateColoringCollectionRequestDTO, {
      expectedColoringCount: 100,
      updatedAt: "2026-08-29T12:00:00.000Z",
    });

    for (const dto of [createDto, updateDto]) {
      assert.equal(
        validateSync(dto).some(
          (error) => error.property === "expectedColoringCount",
        ),
        true,
      );
    }
  });

  it("publishes only with a published product, complete cover and ready coloring", async () => {
    const stored = createAdminCollection({
      status: ColoringCollectionStatus.PUBLISHED,
      publishedAt: new Date("2026-08-29T13:00:00.000Z"),
      updatedAt: new Date("2026-08-29T13:00:00.000Z"),
    });
    const draft = createAdminCollection();
    const calls: unknown[] = [];
    const tx = {
      coloringCollection: {
        findUnique: async ({ include }: { include?: unknown }) =>
          include
            ? stored
            : {
                id: draft.id,
                status: draft.status,
                updatedAt: draft.updatedAt,
                coverUrl: draft.coverUrl,
                coverAlt: draft.coverAlt,
                coverWidth: draft.coverWidth,
                coverHeight: draft.coverHeight,
                product: { status: ProductStatus.PUBLISHED },
              },
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
      },
      coloring: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [{ description: "Готовый сюжет" }];
        },
      },
    };
    const service = new ColoringCollectionsService({
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    } as unknown as PrismaService);

    const result = await service.publishCollection(draft.id);

    assert.equal(result.status, "published");
    assert.equal(calls.length, 2);
    assert.deepEqual(
      (calls[0] as { where: Record<string, unknown> }).where,
      {
        collectionId: draft.id,
        status: ColoringStatus.PUBLISHED,
        publishedRevisionId: { not: null },
        publishedAt: { not: null },
        description: { not: null },
        themes: { some: {} },
        publishedRevision: {
          is: {
            firstPublishedAt: { not: null },
            review: {
              is: {
                decision: ColoringRevisionReviewDecision.APPROVED,
              },
            },
          },
        },
      },
    );
  });

  for (const [name, change, message] of [
    [
      "draft product",
      (value: PublishFixture) => void (value.product.status = ProductStatus.DRAFT),
      "Coloring collection product must be published first",
    ],
    [
      "missing cover",
      (value: PublishFixture) => void (value.coverUrl = null),
      "Coloring collection cover must be uploaded before publishing",
    ],
  ] as const) {
    it(`rejects publish for ${name}`, async () => {
      const fixture = createPublishFixture();
      change(fixture);
      const tx = {
        coloringCollection: { findUnique: async () => fixture },
      };
      const service = new ColoringCollectionsService({
        $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
          callback(tx),
      } as unknown as PrismaService);

      await assert.rejects(
        service.publishCollection("collection-1"),
        (error: unknown) =>
          error instanceof ConflictException && error.message === message,
      );
    });
  }
});

describe("ColoringsService collection ownership", () => {
  it("rejects create in an archived collection", async () => {
    let createCalled = false;
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 25,
          id: "collection-1",
          status: "archived" as const,
        },
      ],
      coloring: {
        create: async () => {
          createCalled = true;
          return { id: "coloring-1" };
        },
      },
    };
    const service = new ColoringsService({
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    } as unknown as PrismaService);

    await assert.rejects(
      service.createColoring({
        collectionId: "collection-1",
        title: "Архивная картина",
        position: 0,
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Archived coloring collection cannot receive colorings",
    );
    assert.equal(createCalled, false);
  });
});

describe("PublicColoringCollectionsService", () => {
  it("returns bounded summaries and a deterministic 25-card-ready detail", async () => {
    const fixture = createPublicCollection();
    const calls: unknown[] = [];
    const prisma = {
      coloringCollection: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [fixture];
        },
        findFirst: async (args: unknown) => {
          calls.push(args);
          return fixture;
        },
      },
    };
    const service = new PublicColoringCollectionsService(
      prisma as unknown as PrismaService,
    );

    const [summaries, detail] = await withApiPublicUrl(
      "https://api.artmate.ru/",
      () =>
        Promise.all([
          service.getCollections(),
          service.getCollection("mysterious-forest"),
        ]),
    );

    assert.equal(calls.length, 2);
    assert.ok(summaries[0]);
    assert.deepEqual(summaries, [expectedPublicSummary()]);
    assert.deepEqual(detail, {
      ...expectedPublicSummary(),
      colorings: [
        {
          id: "coloring-1",
          number: 1,
          title: "Лесной дракон",
          position: 0,
          publishedRevisionId: "revision-1",
          card: {
            url: `https://api.artmate.ru/colorings/mysterious-forest/01/assets/revision-1/card/content?v=${"c".repeat(64)}`,
            alt: "Лесной дракон в цвете",
            width: 480,
            height: 320,
          },
        },
      ],
    });
    assert.deepEqual(
      validateSync(
        plainToInstance(PublicColoringCollectionSummaryDTO, summaries[0]),
      ),
      [],
    );
    assert.deepEqual(
      validateSync(plainToInstance(PublicColoringCollectionDTO, detail)),
      [],
    );
    assertNoPrivateFields(detail);
  });

  it("uses full colored dimensions for a legacy revision without card fields", async () => {
    const fixture = createPublicCollection();
    const coloring = fixture.colorings[0];
    assert.ok(coloring);
    Object.assign(coloring.publishedRevision, {
      cardStorageKey: null,
      cardByteSize: null,
      cardChecksum: null,
      cardWidth: null,
      cardHeight: null,
    });
    const service = new PublicColoringCollectionsService({
      coloringCollection: { findFirst: async () => fixture },
    } as unknown as PrismaService);

    const result = await service.getCollection(fixture.slug);

    assert.deepEqual(result.colorings[0]?.card, {
      url: `http://localhost:3002/colorings/mysterious-forest/01/assets/revision-1/card/content?v=${"b".repeat(64)}`,
      alt: "Лесной дракон в цвете",
      width: 1200,
      height: 800,
    });
  });

  for (const [name, fixture] of [
    ["missing collection", null],
    ["blank cover alt", createPublicCollection({ coverAlt: "   " })],
    ["blank coloring description", createPublicCollection({ coloringDescription: "   " })],
  ] as const) {
    it(`returns uniform 404 for ${name}`, async () => {
      const service = new PublicColoringCollectionsService({
        coloringCollection: { findFirst: async () => fixture },
      } as unknown as PrismaService);

      await assert.rejects(
        service.getCollection("mysterious-forest"),
        (error: unknown) =>
          error instanceof NotFoundException &&
          error.message === "Coloring collection not found",
      );
    });
  }
});

describe("PublicColoringsService card descriptor", () => {
  it("serves the generated card and falls back to colored for a legacy revision", async () => {
    let record = createRevisionAsset();
    const prisma = {
      coloringRevision: { findFirst: async () => record },
    };
    const service = new PublicColoringsService(
      prisma as unknown as PrismaService,
      {} as ColoringStorageService,
    );

    assert.deepEqual(
      await service.getAssetDescriptor(
        "mysterious-forest",
        1,
        "revision-1",
        "card",
      ),
      {
        key: "public/card.webp",
        checksum: "c".repeat(64),
        byteSize: 1_000,
        width: 480,
        height: 320,
      },
    );

    record = {
      ...record,
      cardStorageKey: null,
      cardByteSize: null,
      cardChecksum: null,
      cardWidth: null,
      cardHeight: null,
    };
    assert.deepEqual(
      await service.getAssetDescriptor(
        "mysterious-forest",
        1,
        "revision-1",
        "card",
      ),
      {
        key: "public/colored.webp",
        checksum: "b".repeat(64),
        byteSize: 5_000,
        width: 1200,
        height: 800,
      },
    );
  });
});

type PublishFixture = ReturnType<typeof createPublishFixture>;

function createPublishFixture() {
  return {
    id: "collection-1",
    status: ColoringCollectionStatus.DRAFT,
    updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    coverUrl: "https://cdn.artmate.ru/collections/forest.webp" as string | null,
    coverAlt: "Загадочный лес" as string | null,
    coverWidth: 1200 as number | null,
    coverHeight: 800 as number | null,
    product: {
      status: ProductStatus.PUBLISHED as
        | typeof ProductStatus.DRAFT
        | typeof ProductStatus.PUBLISHED
        | typeof ProductStatus.ARCHIVED,
    },
  };
}

function createAdminCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: "collection-1",
    productId: "product-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    description: "25 сюжетов",
    position: 3,
    expectedColoringCount: 25,
    status: ColoringCollectionStatus.DRAFT,
    coverUrl: "https://cdn.artmate.ru/collections/forest.webp",
    coverAlt: "Загадочный лес",
    coverWidth: 1200,
    coverHeight: 800,
    publishedAt: null,
    createdAt: new Date("2026-08-29T12:00:00.000Z"),
    updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    product: {
      id: "product-1",
      slug: "album-1",
      title: "Альбом 1",
      status: ProductStatus.PUBLISHED,
    },
    colorings: [
      { status: ColoringStatus.PUBLISHED },
      { status: ColoringStatus.DRAFT },
    ],
    ...overrides,
  };
}

function expectedAdminCollection() {
  return {
    id: "collection-1",
    productId: "product-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    description: "25 сюжетов",
    position: 3,
    status: "draft",
    expectedColoringCount: 25,
    cover: {
      url: "https://cdn.artmate.ru/collections/forest.webp",
      alt: "Загадочный лес",
      width: 1200,
      height: 800,
    },
    coloringCount: 2,
    publishedColoringCount: 1,
    product: {
      id: "product-1",
      slug: "album-1",
      title: "Альбом 1",
      status: "published",
    },
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function createPublicCollection(
  overrides: { coverAlt?: string; coloringDescription?: string } = {},
) {
  return {
    id: "collection-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    description: "25 сюжетов",
    expectedColoringCount: 25,
    coverUrl: "https://cdn.artmate.ru/collections/forest.webp",
    coverAlt: overrides.coverAlt ?? "Обложка Загадочного леса",
    coverWidth: 1200,
    coverHeight: 800,
    publishedAt: new Date("2026-08-29T12:00:00.000Z"),
    updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    product: {
      id: "product-1",
      slug: "album-1",
      title: "Альбом 1",
      updatedAt: new Date("2026-08-29T11:00:00.000Z"),
      category: {
        id: "category-1",
        slug: "coloring-books",
        title: "Раскраски",
        updatedAt: new Date("2026-08-29T10:00:00.000Z"),
      },
    },
    colorings: [
      {
        id: "coloring-1",
        number: 1,
        title: "Лесной дракон",
        description: overrides.coloringDescription ?? "Сюжет с драконом",
        position: 0,
        publishedRevisionId: "revision-1",
        publishedAt: new Date("2026-08-29T11:30:00.000Z"),
        updatedAt: new Date("2026-08-29T11:30:00.000Z"),
        themes: [
          { tag: { updatedAt: new Date("2026-08-29T10:30:00.000Z") } },
        ],
        publishedRevision: {
          id: "revision-1",
          firstPublishedAt: new Date("2026-08-29T11:00:00.000Z"),
          coloredStorageKey: "public/colored.webp",
          coloredByteSize: 5_000,
          coloredChecksum: "b".repeat(64),
          coloredAlt: "Лесной дракон в цвете",
          width: 1200,
          height: 800,
          cardStorageKey: "public/card.webp",
          cardByteSize: 1_000,
          cardChecksum: "c".repeat(64),
          cardWidth: 480,
          cardHeight: 320,
        },
      },
    ],
  };
}

function expectedPublicSummary() {
  return {
    id: "collection-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    description: "25 сюжетов",
    coloringCount: 1,
    expectedColoringCount: 25,
    cover: {
      url: "https://cdn.artmate.ru/collections/forest.webp",
      alt: "Обложка Загадочного леса",
      width: 1200,
      height: 800,
    },
    product: {
      id: "product-1",
      slug: "album-1",
      title: "Альбом 1",
      category: {
        id: "category-1",
        slug: "coloring-books",
        title: "Раскраски",
      },
    },
    lastModified: "2026-08-29T12:00:00.000Z",
  };
}

function createRevisionAsset() {
  return {
    width: 1200,
    height: 800,
    coloredStorageKey: "public/colored.webp",
    coloredByteSize: 5_000,
    coloredChecksum: "b".repeat(64),
    cardStorageKey: "public/card.webp" as string | null,
    cardByteSize: 1_000 as number | null,
    cardChecksum: "c".repeat(64) as string | null,
    cardWidth: 480 as number | null,
    cardHeight: 320 as number | null,
  };
}

async function withApiPublicUrl<T>(url: string, callback: () => Promise<T>) {
  const previous = process.env.API_PUBLIC_URL;
  process.env.API_PUBLIC_URL = url;

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.API_PUBLIC_URL;
    } else {
      process.env.API_PUBLIC_URL = previous;
    }
  }
}

function assertNoPrivateFields(value: unknown) {
  const json = JSON.stringify(value);

  for (const forbidden of ["StorageKey", "Checksum", "ByteSize", "source"]) {
    assert.equal(json.includes(forbidden), false, forbidden);
  }
}
