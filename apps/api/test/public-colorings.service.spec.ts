import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import {
  ColoringCollectionStatus,
  ColoringRevisionReviewDecision,
  ColoringStatus,
  ProductStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";
import {
  PublicColoringDTO,
  PublicColoringManifestItemDTO,
} from "../src/colorings/dto";
import { PublicColoringsService } from "../src/colorings/public-colorings.service";

const publicWhere = {
  status: ColoringStatus.PUBLISHED,
  publishedRevisionId: { not: null },
  publishedAt: { not: null },
  description: { not: null },
  collection: {
    is: {
      status: ColoringCollectionStatus.PUBLISHED,
      publishedAt: { not: null },
      coverUrl: { not: null },
      coverAlt: { not: null },
      coverWidth: { not: null },
      coverHeight: { not: null },
      product: { is: { status: ProductStatus.PUBLISHED } },
    },
  },
  themes: { some: {} },
  publishedRevision: {
    is: {
      firstPublishedAt: { not: null },
      review: {
        is: { decision: ColoringRevisionReviewDecision.APPROVED },
      },
    },
  },
};

const detailSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  publishedRevisionId: true,
  publishedAt: true,
  collection: {
    select: {
      id: true,
      slug: true,
      title: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: {
            select: { id: true, slug: true, title: true },
          },
        },
      },
    },
  },
  themes: {
    select: {
      tag: { select: { id: true, slug: true, title: true } },
    },
  },
  publishedRevision: {
    select: {
      id: true,
      firstPublishedAt: true,
      paletteLabel: true,
      paletteVersion: true,
      usedColorCount: true,
      paletteColors: {
        select: {
          symbolPosition: true,
          colorNumber: true,
          pantone: true,
          hex: true,
          markerNumber: true,
        },
        orderBy: { symbolPosition: "asc" },
      },
      width: true,
      height: true,
      outlineAlt: true,
      coloredAlt: true,
    },
  },
};

const manifestSelect = {
  number: true,
  description: true,
  updatedAt: true,
  collection: {
    select: {
      slug: true,
      updatedAt: true,
      product: {
        select: {
          updatedAt: true,
          category: { select: { updatedAt: true } },
        },
      },
    },
  },
  themes: {
    select: { tag: { select: { updatedAt: true } } },
  },
};

describe("PublicColoringsService", () => {
  it("returns only the bounded public detail with deterministic themes and category", async () => {
    const fixture = createColoring();
    const calls: unknown[] = [];
    const service = createService({
      findFirst: async (args) => {
        calls.push(args);
        return fixture;
      },
    });

    const result = await withApiPublicUrl("https://api.artmate.ru/", () =>
      service.getColoring("mysterious-forest", 1),
    );

    assert.deepEqual(calls, [
      {
        where: {
          AND: [
            publicWhere,
            {
              number: 1,
              collection: { is: { slug: "mysterious-forest" } },
            },
          ],
        },
        select: detailSelect,
      },
    ]);
    assert.deepEqual(result, {
      id: "coloring-1",
      number: 1,
      title: "Лесные друзья",
      description: "Сюжет с лесными животными",
      publishedRevisionId: "revision-current",
      publishedAt: "2026-08-29T10:00:00.000Z",
      firstPublishedAt: "2026-08-29T09:00:00.000Z",
      themes: [
        { id: "theme-animals", slug: "animals", title: "Животные" },
        { id: "theme-forest", slug: "forest", title: "Лес" },
      ],
      collection: {
        id: "collection-1",
        slug: "mysterious-forest",
        title: "Загадочный лес",
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
      },
      palette: {
        label: "Artmate 168",
        version: "2026-08",
        usedColorCount: 12,
        colors: [
          {
            symbolPosition: 1,
            symbol: "1",
            colorNumber: 39,
            pantone: "2337U",
            hex: "#FFB7AE",
            markerNumber: "488",
          },
          {
            symbolPosition: 19,
            symbol: "J",
            colorNumber: 157,
            pantone: "169U",
            hex: "#FFB7AE",
            markerNumber: "168",
          },
        ],
      },
      width: 1200,
      height: 800,
      outline: {
        url: "https://api.artmate.ru/colorings/mysterious-forest/01/assets/revision-current/outline/content",
        alt: "Контур лесных друзей",
      },
      colored: {
        url: "https://api.artmate.ru/colorings/mysterious-forest/01/assets/revision-current/colored/content",
        alt: "Лесные друзья в цвете",
      },
    });
    assert.deepEqual(
      validateSync(plainToInstance(PublicColoringDTO, result)),
      [],
    );
    assertNoPrivateFields(result);
  });

  it("omits category instead of exposing an empty object", async () => {
    const fixture = createColoring();
    fixture.collection.product.category = null;
    const service = createService({ findFirst: async () => fixture });

    const result = await service.getColoring(
      fixture.collection.slug,
      fixture.number,
    );

    assert.deepEqual(result.collection, {
      id: "collection-1",
      slug: "mysterious-forest",
      title: "Загадочный лес",
      product: {
        id: "product-1",
        slug: "album-1",
        title: "Альбом 1",
      },
    });
  });

  it("validates native and maximum public dimensions without exposing originals", async () => {
    const fixture = createColoring();
    const service = createService({ findFirst: async () => fixture });

    for (const [width, height] of [
      [2450, 3436],
      [4096, 4096],
    ] as const) {
      fixture.publishedRevision.width = width;
      fixture.publishedRevision.height = height;
      const result = await service.getColoring(
        fixture.collection.slug,
        fixture.number,
      );

      assert.equal(result.width, width);
      assert.equal(result.height, height);
      assert.deepEqual(
        validateSync(plainToInstance(PublicColoringDTO, result)),
        [],
      );
      assertNoPrivateFields(result);

      for (const dimensions of [
        { width: 4097 },
        { height: 4097 },
        { width: 0 },
      ]) {
        const dto = plainToInstance(PublicColoringDTO, {
          ...result,
          ...dimensions,
        });
        assert.ok(
          validateSync(dto).some(
            (error) =>
              error.property === "width" || error.property === "height",
          ),
        );
      }
    }
  });

  it("returns an empty palette assignment list for legacy revisions", async () => {
    const fixture = createColoring();
    fixture.publishedRevision.paletteColors = [];
    const service = createService({ findFirst: async () => fixture });

    const result = await service.getColoring(
      fixture.collection.slug,
      fixture.number,
    );

    assert.deepEqual(result.palette.colors, []);
    assert.deepEqual(
      validateSync(plainToInstance(PublicColoringDTO, result)),
      [],
    );
  });

  for (const [name, mutate] of [
    ["missing coloring", () => null],
    [
      "draft coloring",
      (value: StoredColoring) => void (value.status = ColoringStatus.DRAFT),
    ],
    [
      "archived coloring",
      (value: StoredColoring) => void (value.status = ColoringStatus.ARCHIVED),
    ],
    [
      "draft product",
      (value: StoredColoring) =>
        void (value.collection.product.status = ProductStatus.DRAFT),
    ],
    [
      "missing current pointer",
      (value: StoredColoring) => void (value.publishedRevisionId = null),
    ],
    [
      "non-current revision",
      (value: StoredColoring) =>
        void (value.publishedRevisionId = "another-revision"),
    ],
    [
      "missing published timestamp",
      (value: StoredColoring) => void (value.publishedAt = null),
    ],
    [
      "never-published revision",
      (value: StoredColoring) =>
        void (value.publishedRevision.firstPublishedAt = null),
    ],
    [
      "unapproved revision",
      (value: StoredColoring) =>
        void (value.publishedRevision.review.decision =
          ColoringRevisionReviewDecision.REJECTED),
    ],
    [
      "missing description",
      (value: StoredColoring) => void (value.description = null),
    ],
    [
      "blank description",
      (value: StoredColoring) => void (value.description = "   \n"),
    ],
    ["missing theme", (value: StoredColoring) => void (value.themes = [])],
  ] as const) {
    it(`returns the same 404 for ${name}`, async () => {
      const fixture = createColoring();
      const mutated = mutate(fixture);
      const candidate = mutated === null ? null : fixture;
      const service = createService({
        findFirst: async (args) => {
          assert.deepEqual(args, {
            where: {
              AND: [
                publicWhere,
                {
                  number: fixture.number,
                  collection: { is: { slug: fixture.collection.slug } },
                },
              ],
            },
            select: detailSelect,
          });
          return candidate && matchesDatabasePublicPredicate(candidate)
            ? candidate
            : null;
        },
      });

      await assert.rejects(
        service.getColoring(fixture.collection.slug, fixture.number),
        (error: unknown) =>
          error instanceof NotFoundException &&
          error.message === "Coloring not found",
      );
    });
  }

  it("returns a deterministic manifest using the detail predicate and maximum related update", async () => {
    const eligible = createColoring();
    eligible.updatedAt = new Date("2026-08-29T11:00:00.000Z");
    eligible.collection.updatedAt = new Date("2026-08-29T11:30:00.000Z");
    eligible.collection.product.updatedAt = new Date(
      "2026-08-29T12:00:00.000Z",
    );
    eligible.collection.product.category!.updatedAt = new Date(
      "2026-08-29T13:00:00.000Z",
    );
    eligible.themes[0]!.tag.updatedAt = new Date("2026-08-29T14:00:00.000Z");
    const blank = createColoring();
    blank.description = "   ";
    const calls: unknown[] = [];
    const service = createService({
      findMany: async (args) => {
        calls.push(args);
        return [blank, eligible];
      },
    });

    const result = await service.getManifest();

    assert.deepEqual(calls, [
      {
        where: publicWhere,
        select: manifestSelect,
        orderBy: [{ collection: { slug: "asc" } }, { number: "asc" }],
      },
    ]);
    assert.deepEqual(result, [
      {
        collectionSlug: "mysterious-forest",
        number: 1,
        lastModified: "2026-08-29T14:00:00.000Z",
      },
    ]);
    assert.deepEqual(
      validateSync(plainToInstance(PublicColoringManifestItemDTO, result[0])),
      [],
    );
  });

  it("resolves and reads a historically published revision without checking current pointer or statuses", async () => {
    const asset = Buffer.from("public-webp");
    const readCalls: unknown[] = [];
    const prismaCalls: unknown[] = [];
    const service = createService(
      {
        findRevision: async (args) => {
          prismaCalls.push(args);
          return {
            width: 1200,
            height: 800,
            outlineStorageKey: "coloring-1/revision-old/outline-secret.webp",
            outlineByteSize: 321,
            outlineChecksum: "a".repeat(64),
          };
        },
      },
      {
        readPublic: async (key, expected) => {
          readCalls.push({ key, expected });
          return asset;
        },
      },
    );

    const descriptor = await service.getAssetDescriptor(
      "mysterious-forest",
      1,
      "revision-old",
      "outline",
    );

    assert.deepEqual(prismaCalls, [
      {
        where: {
          id: "revision-old",
          firstPublishedAt: { not: null },
          coloring: {
            is: {
              number: 1,
              collection: { is: { slug: "mysterious-forest" } },
            },
          },
        },
        select: {
          width: true,
          height: true,
          outlineStorageKey: true,
          outlineByteSize: true,
          outlineChecksum: true,
        },
      },
    ]);
    assert.deepEqual(descriptor, {
      key: "coloring-1/revision-old/outline-secret.webp",
      checksum: "a".repeat(64),
      byteSize: 321,
      width: 1200,
      height: 800,
    });
    assert.deepEqual(readCalls, []);

    const result = await service.readAsset(descriptor);

    assert.deepEqual(readCalls, [
      {
        key: "coloring-1/revision-old/outline-secret.webp",
        expected: { checksum: "a".repeat(64), width: 1200, height: 800 },
      },
    ]);
    assert.deepEqual(result, asset);
  });

  it("returns the uniform 404 when the historical asset is not eligible", async () => {
    const service = createService({ findRevision: async () => null });

    await assert.rejects(
      service.getAssetDescriptor(
        "mysterious-forest",
        1,
        "revision-never-published",
        "colored",
      ),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === "Coloring not found",
    );
  });

  it("reads the colored historical asset through the same bounded predicate", async () => {
    const asset = Buffer.from("colored-public-webp");
    const prismaCalls: unknown[] = [];
    const readCalls: unknown[] = [];
    const service = createService(
      {
        findRevision: async (args) => {
          prismaCalls.push(args);
          return {
            width: 1200,
            height: 800,
            coloredStorageKey: "coloring-1/revision-old/colored-secret.webp",
            coloredByteSize: 654,
            coloredChecksum: "b".repeat(64),
          };
        },
      },
      {
        readPublic: async (key, expected) => {
          readCalls.push({ key, expected });
          return asset;
        },
      },
    );

    const descriptor = await service.getAssetDescriptor(
      "mysterious-forest",
      1,
      "revision-old",
      "colored",
    );

    assert.deepEqual(prismaCalls, [
      {
        where: {
          id: "revision-old",
          firstPublishedAt: { not: null },
          coloring: {
            is: {
              number: 1,
              collection: { is: { slug: "mysterious-forest" } },
            },
          },
        },
        select: {
          width: true,
          height: true,
          coloredStorageKey: true,
          coloredByteSize: true,
          coloredChecksum: true,
          cardStorageKey: true,
          cardByteSize: true,
          cardChecksum: true,
          cardWidth: true,
          cardHeight: true,
        },
      },
    ]);
    assert.deepEqual(descriptor, {
      key: "coloring-1/revision-old/colored-secret.webp",
      checksum: "b".repeat(64),
      byteSize: 654,
      width: 1200,
      height: 800,
    });
    assert.deepEqual(readCalls, []);

    const result = await service.readAsset(descriptor);

    assert.deepEqual(readCalls, [
      {
        key: "coloring-1/revision-old/colored-secret.webp",
        expected: { checksum: "b".repeat(64), width: 1200, height: 800 },
      },
    ]);
    assert.deepEqual(result, asset);
  });

  it("uses API_BASE_URL when API_PUBLIC_URL is absent", async () => {
    const fixture = createColoring();
    const service = createService({ findFirst: async () => fixture });

    const result = await withPublicEnvironment(
      { API_BASE_URL: "https://internal-api.artmate.ru/" },
      () => service.getColoring(fixture.collection.slug, fixture.number),
    );

    assert.equal(
      result.outline.url,
      "https://internal-api.artmate.ru/colorings/mysterious-forest/01/assets/revision-current/outline/content",
    );
  });

  it("uses the configured PORT in the localhost fallback", async () => {
    const fixture = createColoring();
    const service = createService({ findFirst: async () => fixture });

    const result = await withPublicEnvironment({ PORT: "4010" }, () =>
      service.getColoring(fixture.collection.slug, fixture.number),
    );

    assert.equal(
      result.colored.url,
      "http://localhost:4010/colorings/mysterious-forest/01/assets/revision-current/colored/content",
    );
  });
});

type StoredColoring = ReturnType<typeof createColoring>;

type PrismaOverrides = {
  findFirst?: (args: unknown) => Promise<StoredColoring | null>;
  findMany?: (args: unknown) => Promise<StoredColoring[]>;
  findRevision?: (args: unknown) => Promise<Record<string, unknown> | null>;
};

type StorageOverrides = {
  readPublic?: (
    key: string,
    expected: { checksum: string; width: number; height: number },
  ) => Promise<Buffer>;
};

function createService(
  prismaOverrides: PrismaOverrides,
  storageOverrides: StorageOverrides = {},
) {
  const prisma = {
    coloring: {
      findFirst: prismaOverrides.findFirst ?? (async () => null),
      findMany: prismaOverrides.findMany ?? (async () => []),
    },
    coloringRevision: {
      findFirst: prismaOverrides.findRevision ?? (async () => null),
    },
  };
  const storage = {
    readPublic: storageOverrides.readPublic ?? (async () => Buffer.alloc(0)),
  };

  return new PublicColoringsService(
    prisma as unknown as PrismaService,
    storage as unknown as ColoringStorageService,
  );
}

function createColoring() {
  return {
    id: "coloring-1",
    number: 1,
    title: "Лесные друзья",
    description: "Сюжет с лесными животными" as string | null,
    status: ColoringStatus.PUBLISHED as ColoringStatus,
    publishedRevisionId: "revision-current" as string | null,
    publishedAt: new Date("2026-08-29T10:00:00.000Z") as Date | null,
    updatedAt: new Date("2026-08-29T10:30:00.000Z"),
    collection: {
      id: "collection-1",
      slug: "mysterious-forest",
      title: "Загадочный лес",
      status: ColoringCollectionStatus.PUBLISHED as ColoringCollectionStatus,
      publishedAt: new Date("2026-08-29T09:30:00.000Z") as Date | null,
      coverUrl: "https://cdn.artmate.ru/collections/forest.webp" as
        | string
        | null,
      coverAlt: "Обложка Загадочного леса" as string | null,
      coverWidth: 1200 as number | null,
      coverHeight: 800 as number | null,
      updatedAt: new Date("2026-08-29T10:25:00.000Z"),
      product: {
        id: "product-1",
        slug: "album-1",
        title: "Альбом 1",
        status: ProductStatus.PUBLISHED as ProductStatus,
        updatedAt: new Date("2026-08-29T10:20:00.000Z"),
        category: {
          id: "category-1",
          slug: "coloring-books",
          title: "Раскраски",
          updatedAt: new Date("2026-08-29T10:10:00.000Z"),
        } as {
          id: string;
          slug: string;
          title: string;
          updatedAt: Date;
        } | null,
      },
    },
    themes: [
      {
        tag: {
          id: "theme-forest",
          slug: "forest",
          title: "Лес",
          updatedAt: new Date("2026-08-29T10:40:00.000Z"),
        },
      },
      {
        tag: {
          id: "theme-animals",
          slug: "animals",
          title: "Животные",
          updatedAt: new Date("2026-08-29T10:50:00.000Z"),
        },
      },
    ],
    publishedRevision: {
      id: "revision-current",
      firstPublishedAt: new Date("2026-08-29T09:00:00.000Z") as Date | null,
      paletteLabel: "Artmate 168",
      paletteVersion: "2026-08",
      usedColorCount: 12,
      paletteColors: [
        {
          symbolPosition: 1,
          colorNumber: 39,
          pantone: "2337U",
          hex: "#FFB7AE",
          markerNumber: "488",
        },
        {
          symbolPosition: 19,
          colorNumber: 157,
          pantone: "169U",
          hex: "#FFB7AE",
          markerNumber: "168",
        },
      ],
      width: 1200,
      height: 800,
      outlineAlt: "Контур лесных друзей",
      coloredAlt: "Лесные друзья в цвете",
      review: {
        decision:
          ColoringRevisionReviewDecision.APPROVED as ColoringRevisionReviewDecision,
      },
    },
  };
}

function matchesDatabasePublicPredicate(value: StoredColoring) {
  return (
    value.status === ColoringStatus.PUBLISHED &&
    value.collection.status === ColoringCollectionStatus.PUBLISHED &&
    value.collection.publishedAt !== null &&
    value.collection.coverUrl !== null &&
    value.collection.coverAlt !== null &&
    value.collection.coverWidth !== null &&
    value.collection.coverHeight !== null &&
    value.collection.product.status === ProductStatus.PUBLISHED &&
    value.publishedRevisionId !== null &&
    value.publishedRevisionId === value.publishedRevision.id &&
    value.publishedAt !== null &&
    value.description !== null &&
    value.themes.length > 0 &&
    value.publishedRevision.firstPublishedAt !== null &&
    value.publishedRevision.review.decision ===
      ColoringRevisionReviewDecision.APPROVED
  );
}

function assertNoPrivateFields(value: unknown) {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    "status",
    "checksum",
    "storage",
    "byteSize",
    "preview",
    "review",
    "createdBy",
    "reviewedBy",
    "publishedBy",
    "provenance",
    "path",
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
    );
  }
}

async function withApiPublicUrl<T>(url: string, callback: () => Promise<T>) {
  return withPublicEnvironment({ API_PUBLIC_URL: url }, callback);
}

async function withPublicEnvironment<T>(
  environment: {
    API_PUBLIC_URL?: string;
    API_BASE_URL?: string;
    PORT?: string;
  },
  callback: () => Promise<T>,
) {
  const keys = ["API_PUBLIC_URL", "API_BASE_URL", "PORT"] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof keys)[number], string | undefined>;

  for (const key of keys) {
    delete process.env[key];
  }

  Object.assign(process.env, environment);

  try {
    return await callback();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}
