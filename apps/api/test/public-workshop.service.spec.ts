import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrismaService } from "../src/prisma/prisma.service";
import { ColoringStatus } from "../src/generated/prisma/client";
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
