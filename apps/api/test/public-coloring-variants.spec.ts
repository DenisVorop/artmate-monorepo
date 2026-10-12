import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  Module,
  NotFoundException,
  ServiceUnavailableException,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";
import { PublicColoringVariantsService } from "../src/colorings/public-coloring-variants.service";
import { PublicColoringVariantsController } from "../src/colorings/public-coloring-variants.controller";
import { PublicColoringVariantsDTO } from "../src/colorings/dto/public-coloring-variant.dto";
import { publicVariantColoringWhere } from "../src/colorings/public-coloring-variant-eligibility";

const checksum = "a".repeat(64);
const cardChecksum = "b".repeat(64);
const outlineChecksum = "c".repeat(64);
const date = new Date("2026-09-27T12:00:00.000Z");

function fixture() {
  const image = {
    imageStorageKey: "coloring/image.webp",
    imageChecksum: checksum,
    imageByteSize: 4,
    sourceChecksum: "d".repeat(64),
    sourceMime: "image/png",
    cardStorageKey: "coloring/card.webp",
    cardChecksum,
    cardByteSize: 4,
    cardWidth: 400,
    cardHeight: 300,
    imageAlt: "Собачка",
    status: "PUBLISHED",
    publishedAt: date,
    updatedAt: date,
  };
  const product = {
    id: "product",
    slug: "album",
    title: "Альбом",
    status: "PUBLISHED",
    category: { id: "category", slug: "albums", title: "Альбомы" },
  };
  const materialColor = {
    id: "color",
    materialSetId: "set",
    code: "040",
    hex: "#123456",
  };
  return {
    id: "coloring",
    number: 1,
    title: "Собачка",
    description: "Щенок в саду",
    status: "PUBLISHED",
    publishedAt: date,
    themes: [{ tag: { id: "theme", slug: "animals", title: "Животные" } }],
    collection: {
      id: "collection",
      slug: "dogs",
      title: "Собачки",
      status: "PUBLISHED",
      publishedAt: date,
      coverUrl: "https://example.com/cover.webp",
      coverAlt: "Собачки",
      coverWidth: 400,
      coverHeight: 300,
      product,
    },
    artwork: {
      width: 1200,
      height: 900,
      derivativeProfile: "webp-preview-v3",
      colorSpace: "srgb",
      outlineStorageKey: "coloring/outline.webp",
      outlineChecksum,
      outlineByteSize: 4,
      outlineSourceChecksum: "d".repeat(64),
      outlineSourceMime: "image/png",
      outlineAlt: "Контур щенка",
      updatedAt: date,
      original: {
        ...image,
        colors: [
          { symbolPosition: 1, hex: "#123456" },
          { symbolPosition: 18, hex: "#abcdef" },
        ],
      },
      materialVariants: [
        {
          ...image,
          materialSetId: "set",
          materialSet: {
            id: "set",
            slug: "artmate-168",
            title: "Artmate · 168 цветов",
            kind: "MARKER",
            isArchived: false,
            product,
            _count: { colors: 168 },
          },
          assignments: [1, 18].map((symbolPosition) => ({
            symbolPosition,
            materialSetId: "set",
            materialColorId: "color",
            materialColor: { ...materialColor },
          })),
        },
      ],
    },
  };
}

function createService(
  record: ReturnType<typeof fixture> | null,
  calls: unknown[] = [],
) {
  return new PublicColoringVariantsService(
    {
      coloring: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return record;
        },
      },
    } as unknown as PrismaService,
    {
      readPublic: async () => Buffer.from("webp"),
    } as unknown as ColoringStorageService,
  );
}

describe("published coloring variants", () => {
  it("returns bounded validated metadata, canonical default and repeated codes without shifting symbols", async () => {
    const calls: unknown[] = [];
    const result = await createService(fixture(), calls).getColoring("dogs", 1);
    assert.equal(result.defaultPaletteId, "set");
    assert.deepEqual(
      result.original.colors.map((c) => c.symbol),
      ["1", "I"],
    );
    assert.deepEqual(
      result.variants[0]!.colors.map((c) => c.code),
      ["040", "040"],
    );
    assert.equal(
      result.original.card.url.endsWith(
        `/original/card/${cardChecksum}/content`,
      ),
      true,
    );
    assert.equal("publishedRevisionId" in result, false);
    assert.equal(JSON.stringify(result).includes("StorageKey"), false);
    assert.deepEqual(
      validateSync(plainToInstance(PublicColoringVariantsDTO, result), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
      [],
    );
    assert.deepEqual(
      (calls[0] as { where: { AND: unknown[] } }).where.AND[0],
      publicVariantColoringWhere,
    );
  });

  it("does not select a brand/title lookalike as the canonical Artmate set", async () => {
    const record = fixture();
    record.artwork.materialVariants[0]!.materialSet.slug = "another-artmate";
    assert.equal(
      (await createService(record).getColoring("dogs", 1)).defaultPaletteId,
      "original",
    );
  });

  for (const [name, mutate] of [
    [
      "draft",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.materialVariants[0]!.status = "DRAFT";
      },
    ],
    [
      "archived set",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.materialVariants[0]!.materialSet.isArchived = true;
      },
    ],
    [
      "missing position",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.materialVariants[0]!.assignments.pop();
      },
    ],
    [
      "foreign material",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.materialVariants[0]!.assignments[0]!.materialColor.materialSetId =
          "foreign";
      },
    ],
    [
      "incomplete image",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.materialVariants[0]!.cardStorageKey = "";
      },
    ],
  ] as const) {
    it(`omits ${name} variants and revokes their assets`, async () => {
      const record = fixture();
      mutate(record);
      const service = createService(record);
      const result = await service.getColoring("dogs", 1);
      assert.equal(result.defaultPaletteId, "original");
      assert.deepEqual(result.variants, []);
      await assert.rejects(
        service.getAssetDescriptor("dogs", 1, "set", "colored", checksum),
        NotFoundException,
      );
    });
  }

  for (const [name, mutate] of [
    [
      "draft coloring",
      (r: ReturnType<typeof fixture>) => {
        r.status = "DRAFT";
      },
    ],
    [
      "missing outline",
      (r: ReturnType<typeof fixture>) => (r.artwork.outlineStorageKey = ""),
    ],
    [
      "broken outline",
      (r: ReturnType<typeof fixture>) => (r.artwork.outlineChecksum = "broken"),
    ],
    [
      "oversized outline",
      (r: ReturnType<typeof fixture>) => (r.artwork.width = 4097),
    ],
    [
      "oversized original card",
      (r: ReturnType<typeof fixture>) => (r.artwork.original.cardWidth = 641),
    ],
    [
      "draft original",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.original.status = "DRAFT";
      },
    ],
    [
      "archived album",
      (r: ReturnType<typeof fixture>) => {
        r.collection.status = "ARCHIVED";
      },
    ],
    [
      "hidden album product",
      (r: ReturnType<typeof fixture>) => {
        r.collection.product.status = "DRAFT";
      },
    ],
    [
      "blank description",
      (r: ReturnType<typeof fixture>) => {
        r.description = "  ";
      },
    ],
    [
      "invalid original palette",
      (r: ReturnType<typeof fixture>) => {
        r.artwork.original.colors[1]!.symbolPosition = 1;
      },
    ],
  ] as const) {
    it(`rejects detail and matching assets for ${name}`, async () => {
      const record = fixture();
      mutate(record);
      const service = createService(record);
      await assert.rejects(service.getColoring("dogs", 1), NotFoundException);
      await assert.rejects(
        service.getAssetDescriptor("dogs", 1, "original", "colored", checksum),
        NotFoundException,
      );
    });
  }

  it("hashes current public catalog data and omits an unpublished material product", async () => {
    const record = fixture();
    const service = createService(record);
    const first = await service.getColoring("dogs", 1);
    record.artwork.materialVariants[0]!.assignments[0]!.materialColor.hex =
      "#654321";
    record.artwork.materialVariants[0]!.materialSet.product = {
      ...record.collection.product,
      status: "DRAFT",
    };
    const second = await service.getColoring("dogs", 1);
    assert.notEqual(first.token, second.token);
    assert.equal("product" in second.variants[0]!, false);
    assert.equal(second.token, (await service.getColoring("dogs", 1)).token);
  });

  it("serves only the current checksum, supported target and correct asset kind", async () => {
    const service = createService(fixture());
    const descriptor = await service.getAssetDescriptor(
      "dogs",
      1,
      "original",
      "outline",
      outlineChecksum,
    );
    assert.equal(descriptor.key, "coloring/outline.webp");
    for (const [target, kind, hash] of [
      ["original", "colored", "d".repeat(64)],
      ["missing", "colored", checksum],
      ["set", "outline", outlineChecksum],
      ["original", "source", checksum],
      ["original", "card", "../private"],
    ]) {
      await assert.rejects(
        service.getAssetDescriptor("dogs", 1, target!, kind!, hash!),
        NotFoundException,
      );
    }
    await assert.rejects(
      createService(null).getColoring("dogs", 1),
      NotFoundException,
    );
  });

  it("accepts the maximum public artwork and card dimensions for detail and assets", async () => {
    const record = fixture();
    record.artwork.width = 4096;
    record.artwork.height = 4096;
    record.artwork.original.cardWidth = 640;
    record.artwork.original.cardHeight = 640;
    const service = createService(record);
    const result = await service.getColoring("dogs", 1);
    assert.equal(result.width, 4096);
    assert.equal(result.original.card.width, 640);
    const image = await service.getAssetDescriptor(
      "dogs",
      1,
      "original",
      "colored",
      checksum,
    );
    assert.equal(image.width, 4096);
    const card = await service.getAssetDescriptor(
      "dogs",
      1,
      "original",
      "card",
      cardChecksum,
    );
    assert.equal(card.width, 640);
  });
});

let httpRecord = fixture();
let unavailable = false;
let reads = 0;
const httpService = new PublicColoringVariantsService(
  {
    coloring: { findFirst: async () => httpRecord },
  } as unknown as PrismaService,
  {
    readPublic: async () => {
      reads += 1;
      if (unavailable) throw new ServiceUnavailableException();
      return Buffer.from("webp");
    },
  } as unknown as ColoringStorageService,
);
@Module({
  controllers: [PublicColoringVariantsController],
  providers: [
    { provide: PublicColoringVariantsService, useValue: httpService },
  ],
})
class PublicVariantsTestModule {}

describe("public variant HTTP assets", () => {
  let app: INestApplication;
  let base: string;
  before(async () => {
    app = await NestFactory.create(PublicVariantsTestModule, { logger: false });
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  after(async () => {
    await app.close();
  });
  const path = `/colorings/dogs/01/variants/assets/original/colored/${checksum}/content`;

  it("serves validated detail and rejects malformed route numbers", async () => {
    const detail = await fetch(`${base}/colorings/dogs/01/variants`);
    assert.equal(detail.status, 200);
    assert.equal(
      ((await detail.json()) as { defaultPaletteId: string }).defaultPaletteId,
      "set",
    );
    const malformed = await fetch(`${base}/colorings/dogs/no/variants`);
    assert.equal(malformed.status, 404);
  });

  it("revalidates public assets and checks eligibility before HEAD and conditional GET", async () => {
    const first = await fetch(base + path);
    assert.equal(first.status, 200);
    assert.equal(
      first.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
    assert.equal(await first.text(), "webp");
    const etag = first.headers.get("etag")!;
    const beforeReads = reads;
    const unchanged = await fetch(base + path, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(unchanged.status, 304);
    assert.equal(reads, beforeReads);
    const head = await fetch(base + path, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "4");
    assert.equal(reads, beforeReads);
    httpRecord.artwork.original.status = "DRAFT";
    try {
      for (const method of ["GET", "HEAD"]) {
        const revoked = await fetch(base + path, {
          method,
          headers: { "If-None-Match": etag },
        });
        assert.equal(revoked.status, 404);
        assert.equal(revoked.headers.get("cache-control"), "no-store");
      }
    } finally {
      httpRecord = fixture();
    }
  });

  it("keeps stale checksums and storage errors non-cacheable", async () => {
    const stale = await fetch(base + path.replace(checksum, "d".repeat(64)));
    assert.equal(stale.status, 404);
    assert.equal(stale.headers.get("cache-control"), "no-store");
    unavailable = true;
    try {
      const response = await fetch(base + path);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
    } finally {
      unavailable = false;
    }
  });

  it("revokes detail and original assets when the shared contour becomes incomplete", async () => {
    httpRecord.artwork.outlineStorageKey = "";
    try {
      const detail = await fetch(`${base}/colorings/dogs/01/variants`);
      assert.equal(detail.status, 404);
      for (const [kind, hash] of [
        ["outline", outlineChecksum],
        ["colored", checksum],
        ["card", cardChecksum],
      ]) {
        for (const method of ["GET", "HEAD"]) {
          const asset = await fetch(
            `${base}/colorings/dogs/01/variants/assets/original/${kind}/${hash}/content`,
            {
              method,
              headers: { "If-None-Match": `"${hash}"` },
            },
          );
          assert.equal(asset.status, 404);
          assert.equal(asset.headers.get("cache-control"), "no-store");
        }
      }
    } finally {
      httpRecord = fixture();
    }
  });
});
