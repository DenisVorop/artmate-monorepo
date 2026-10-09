import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, HttpException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ColoringVariantsService } from "../src/colorings/coloring-variants.service";
import type {
  ColoringMediaService,
  ProcessedColoringPair,
} from "../src/colorings/coloring-media.service";
import type { ColoringStorageService } from "../src/colorings/coloring-storage.service";
import { SaveColoringVariantDTO } from "../src/colorings/dto/coloring-variant.dto";
import type { PrismaService } from "../src/prisma/prisma.service";

const initialDate = new Date("2099-01-01T00:00:00.000Z");
const palette = [
  { symbolPosition: 1, hex: "#aabbcc" },
  { symbolPosition: 7, hex: "#ddeeff" },
];
type Image = {
  imageStorageKey: string;
  imageChecksum: string;
  cardStorageKey: string;
  cardChecksum: string;
  cardWidth: number;
  cardHeight: number;
  updatedAt: Date;
};
type Original = Image & {
  coloringId: string;
  status: string;
  colors: typeof palette;
};
type Assignment = {
  symbolPosition: number;
  materialSetId: string;
  materialColorId: string;
};
type Variant = Image & {
  id: string;
  coloringId: string;
  materialSetId: string;
  status: string;
  materialSet: { title: string };
  assignments: Array<
    Assignment & { materialColor: { code: string; hex: string } }
  >;
};
type Artwork = {
  coloringId: string;
  width: number;
  height: number;
  outlineStorageKey: string;
  outlineChecksum: string;
  updatedAt: Date;
  original: Original | null;
  materialVariants: Variant[];
};
function image(): Image {
  return {
    imageStorageKey: "old-colored",
    imageChecksum: "colored-checksum",
    cardStorageKey: "old-card",
    cardChecksum: "card-checksum",
    cardWidth: 400,
    cardHeight: 600,
    updatedAt: initialDate,
  };
}
function artwork(): Artwork {
  return {
    coloringId: "coloring-1",
    width: 800,
    height: 1200,
    outlineStorageKey: "old-outline",
    outlineChecksum: "outline-checksum",
    updatedAt: initialDate,
    original: {
      coloringId: "coloring-1",
      status: "DRAFT",
      ...image(),
      colors: structuredClone(palette),
    },
    materialVariants: [],
  };
}
function variant(): Variant {
  return {
    id: "variant-stable-id",
    coloringId: "coloring-1",
    materialSetId: "set-1",
    status: "DRAFT",
    ...image(),
    imageStorageKey: "old-variant-colored",
    cardStorageKey: "old-variant-card",
    materialSet: { title: "Markers" },
    assignments: palette.map((row) => ({
      symbolPosition: row.symbolPosition,
      materialSetId: "set-1",
      materialColorId: "color-1",
      materialColor: { code: "A1", hex: "#ABCDEF" },
    })),
  };
}
function processedPair(): ProcessedColoringPair {
  const asset = (kind: string) => ({
    buffer: Buffer.from(kind),
    sourceMime: "image/png" as const,
    sourceChecksum: `${kind}-source`,
    checksum: `${kind}-checksum`,
    byteSize: 10,
    width: 800,
    height: 1200,
  });
  return {
    width: 800,
    height: 1200,
    outline: asset("outline"),
    colored: asset("colored"),
    card: { ...asset("card"), width: 400, height: 600 },
  };
}
function input(
  expectedToken = initialDate.toISOString(),
  target = "original",
): SaveColoringVariantDTO {
  return {
    target,
    expectedToken,
    outlineAlt: "Контуры",
    imageAlt: "Цветная картинка",
    palette:
      target === "original"
        ? structuredClone(palette)
        : palette.map((row) => ({
            symbolPosition: row.symbolPosition,
            materialColorId: "color-1",
          })),
  };
}
function files() {
  const file = {
    buffer: Buffer.from("image"),
    mimetype: "image/png",
    originalname: "image.png",
    size: 5,
  };
  return { outline: [file], colored: [file] };
}
function errorCode(code: string, status: number) {
  return (error: unknown) =>
    error instanceof HttpException &&
    error.getStatus() === status &&
    (error.getResponse() as { errorCode?: string }).errorCode === code;
}

function harness(initial: Artwork | null = artwork()) {
  const state = {
    artwork: structuredClone(initial),
    coloringStatus: "DRAFT",
    collectionStatus: "DRAFT",
    description: "Описание раскраски",
    themes: [{ tagId: "theme-1" }],
    productStatus: "PUBLISHED",
    publishedAt: null as Date | null,
    publicationWrites: 0,
    publicFiles: [] as string[],
    cleanedPublic: [] as string[],
    publicError: null as Error | null,
    setArchived: false,
    pair: processedPair(),
    processed: 0,
    beforeTransaction: () => {},
    transactionMode: "success",
    outcomeReadFails: false,
    mediaError: null as Error | null,
    originalWrites: [] as unknown[],
    variantWrites: [] as unknown[],
    locks: [] as string[],
    stored: [] as Array<{ key: string; created: boolean }>,
    cleaned: [] as string[],
    references: new Set<string>(),
    countFails: false,
    legacy: {
      revisions: [{ id: "revision-1", status: "PUBLISHED" }],
      userWorks: [{ id: "work-1", revisionId: "revision-1" }],
      revisionSequence: 17,
    },
  };
  let transactionFailed = false;
  const count = async ({
    where,
  }: {
    where: { outlineStorageKey?: string; OR?: Array<Record<string, string>> };
  }) => {
    if (state.countFails) throw new Error("reference read unavailable");
    const key = where.outlineStorageKey ?? Object.values(where.OR![0]!)[0]!;
    const current = state.artwork;
    const referenced = [
      current?.outlineStorageKey,
      current?.original?.imageStorageKey,
      current?.original?.cardStorageKey,
      ...(current?.materialVariants.flatMap((v) => [
        v.imageStorageKey,
        v.cardStorageKey,
      ]) ?? []),
    ];
    return referenced.includes(key) ? 1 : 0;
  };
  const db = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      state.locks.push(strings.join("?"));
      return [];
    },
    coloring: {
      findUnique: async () => ({
        status: state.coloringStatus,
        description: state.description,
        themes: state.themes,
        publishedAt: state.publishedAt,
        collection: {
          status: state.collectionStatus,
          product: { status: state.productStatus },
        },
      }),
      update: async ({
        data,
      }: {
        data: { status: string; publishedAt: Date };
      }) => {
        state.coloringStatus = data.status;
        state.publishedAt = data.publishedAt;
      },
    },
    materialSet: {
      findUnique: async () => ({
        isArchived: state.setArchived,
        colors: [{ id: "color-1" }, { id: "color-2" }],
      }),
    },
    coloringArtwork: {
      update: async ({ data }: { data: { updatedAt: Date } }) => {
        state.artwork!.updatedAt = data.updatedAt;
      },
      findUnique: async () => {
        if (transactionFailed && state.outcomeReadFails)
          throw new Error("outcome unknown");
        return structuredClone(state.artwork);
      },
      count,
      upsert: async ({
        create,
        update,
      }: {
        create: Omit<Artwork, "original" | "materialVariants">;
        update: Partial<Artwork>;
      }) => {
        state.artwork = state.artwork
          ? { ...state.artwork, ...update }
          : { ...create, original: null, materialVariants: [] };
        return state.artwork;
      },
    },
    coloringOriginal: {
      update: async ({
        data,
      }: {
        data: { status: string; updatedAt: Date };
      }) => {
        state.publicationWrites++;
        Object.assign(state.artwork!.original!, data);
      },
      count,
      upsert: async (args: {
        where: { coloringId: string };
        create: Image & {
          coloringId: string;
          colors: { create: typeof palette };
        };
        update: Image & {
          colors: { deleteMany: object; create: typeof palette };
        };
      }) => {
        state.originalWrites.push(args);
        const current = state.artwork!.original;
        const data = current ? args.update : args.create;
        state.artwork!.original = {
          ...current,
          ...data,
          coloringId: args.where.coloringId,
          status: current?.status ?? "DRAFT",
          colors: [...data.colors.create].sort(
            (a, b) => a.symbolPosition - b.symbolPosition,
          ),
        };
      },
    },
    coloringMaterialVariant: {
      update: async ({
        where,
        data,
      }: {
        where: { coloringId_materialSetId: { materialSetId: string } };
        data: { status: string; updatedAt: Date };
      }) => {
        state.publicationWrites++;
        Object.assign(
          state.artwork!.materialVariants.find(
            (v) =>
              v.materialSetId === where.coloringId_materialSetId.materialSetId,
          )!,
          data,
        );
      },
      count,
      upsert: async (args: {
        where: {
          coloringId_materialSetId: {
            coloringId: string;
            materialSetId: string;
          };
        };
        create: Image & { assignments: { create: Assignment[] } };
        update: Image & {
          assignments: { deleteMany: object; create: Assignment[] };
        };
      }) => {
        state.variantWrites.push(args);
        const identity = args.where.coloringId_materialSetId;
        const current = state.artwork!.materialVariants.find(
          (v) => v.materialSetId === identity.materialSetId,
        );
        const data = current ? args.update : args.create;
        const saved = {
          ...data,
          ...identity,
          id: current?.id ?? "new-variant-id",
          status: current?.status ?? "DRAFT",
          materialSet: { title: "Markers" },
          assignments: data.assignments.create.map((a) => ({
            ...a,
            materialColor: { code: "A1", hex: "#ABCDEF" },
          })),
        };
        state.artwork!.materialVariants = [
          ...state.artwork!.materialVariants.filter(
            (v) => v.materialSetId !== identity.materialSetId,
          ),
          saved,
        ];
      },
    },
    coloringRevision: {
      count: async ({
        where,
      }: {
        where: { OR: Array<Record<string, string>> };
      }) =>
        where.OR.some((condition) =>
          Object.values(condition).some((key) => state.references.has(key)),
        )
          ? 1
          : 0,
    },
  };
  const prisma = {
    ...db,
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => {
      state.beforeTransaction();
      const snapshot = structuredClone(state.artwork);
      const parentSnapshot = {
        coloringStatus: state.coloringStatus,
        publishedAt: state.publishedAt,
      };
      try {
        const result = await callback(db);
        if (state.transactionMode !== "success")
          throw new Error("commit connection lost");
        return result;
      } catch (error) {
        if (state.transactionMode !== "committed") {
          state.artwork = snapshot;
          Object.assign(state, parentSnapshot);
        }
        transactionFailed = true;
        throw error;
      }
    },
  };
  const media = {
    processPair: async () => {
      state.processed += 1;
      if (state.mediaError) throw state.mediaError;
      return state.pair;
    },
  };
  const storage = {
    materializePublicPair: async (entries: Array<{ key: string }>) => {
      if (state.publicError) throw state.publicError;
      state.publicFiles.push(...entries.map((e) => e.key));
      return entries.map((e) => ({ key: e.key, created: true }));
    },
    cleanupPublic: async (entries: Array<{ key: string }>) => {
      state.cleanedPublic.push(...entries.map((e) => e.key));
    },
    writePrivatePair: async (entries: Array<{ key: string }>) => {
      state.stored = entries.map(({ key }) => ({
        key,
        created: key !== state.artwork?.outlineStorageKey,
      }));
      return state.stored;
    },
    cleanupPrivate: async (keys: string[]) => {
      state.cleaned.push(...keys);
    },
    readProtected: async (key: string, metadata: unknown) => ({
      key,
      metadata,
    }),
  };
  const service = new ColoringVariantsService(
    prisma as unknown as PrismaService,
    media as unknown as ColoringMediaService,
    storage as unknown as ColoringStorageService,
  );
  return { state, service };
}

describe("ColoringVariantsService draft uploads", () => {
  it("starts empty and creates an original with explicit, non-contiguous symbols", async () => {
    const { service, state } = harness(null);
    assert.deepEqual(await service.get("coloring-1"), {
      coloringId: "coloring-1",
      token: "new",
      width: null,
      height: null,
      outlineUrl: null,
      original: null,
      variants: [],
    });
    const result = await service.save("coloring-1", input("new"), files());
    assert.equal(state.stored.length, 3);
    assert.equal(state.artwork?.original?.status, "DRAFT");
    assert.deepEqual(result.original?.palette, [
      { symbolPosition: 1, hex: "#AABBCC" },
      { symbolPosition: 7, hex: "#DDEEFF" },
    ]);
    assert.deepEqual(result.variants, []);
    assert.doesNotMatch(JSON.stringify(result), /StorageKey|sourceChecksum/);
    assert.match(
      result.outlineUrl!,
      /assets\/original\/outline\/content\?token=/,
    );
  });

  it("replaces the original in place, advances the CAS token and preserves shared outlines and legacy data", async () => {
    const { service, state } = harness();
    const legacy = structuredClone(state.legacy);
    const result = await service.save("coloring-1", input(), files());
    assert.equal(state.artwork?.original?.coloringId, "coloring-1");
    assert.equal(state.artwork?.outlineStorageKey, "old-outline");
    assert.equal(state.stored.length, 3);
    assert.equal(result.token, "2099-01-01T00:00:00.001Z");
    assert.deepEqual(state.cleaned.sort(), ["old-card", "old-colored"]);
    assert.deepEqual(state.legacy, legacy);
    assert.deepEqual((state.originalWrites[0] as { where: unknown }).where, {
      coloringId: "coloring-1",
    });
  });

  it("allows one marker on several symbols and replaces a material variant with the same ID", async () => {
    const initial = artwork();
    initial.materialVariants = [variant()];
    const { service, state } = harness(initial);
    const result = await service.save(
      "coloring-1",
      input(undefined, "set-1"),
      files(),
    );
    assert.equal(state.artwork?.materialVariants.length, 1);
    assert.equal(state.artwork?.materialVariants[0]?.id, "variant-stable-id");
    assert.deepEqual(
      result.variants[0]?.palette.map((row) => [
        row.symbolPosition,
        row.materialColorId,
      ]),
      [
        [1, "color-1"],
        [7, "color-1"],
      ],
    );
    assert.deepEqual(state.artwork?.original, initial.original);
    assert.deepEqual(state.cleaned.sort(), [
      "old-variant-card",
      "old-variant-colored",
    ]);
    assert.match(state.locks[0]!, /FOR UPDATE OF c, cc/);
    assert.match(state.locks[1]!, /material_sets.*FOR UPDATE/);
  });

  it("cleans replaced contours when no material adaptation depends on them", async () => {
    const { service, state } = harness();
    state.pair.outline.checksum = "new-outline";
    await service.save("coloring-1", input(), files());
    assert.equal(state.stored.length, 3);
    assert.deepEqual(state.cleaned.sort(), [
      "old-card",
      "old-colored",
      "old-outline",
    ]);
  });

  it("retains retired files referenced by legacy revisions", async () => {
    const { service, state } = harness();
    state.references.add("old-colored");
    await service.save("coloring-1", input(), files());
    assert.deepEqual(state.cleaned, ["old-card"]);
  });

  it("retains retired files still used by another current variant", async () => {
    const initial = artwork();
    initial.materialVariants = [
      { ...variant(), imageStorageKey: "old-colored" },
    ];
    const { service, state } = harness(initial);
    await service.save("coloring-1", input(), files());
    assert.deepEqual(state.cleaned, ["old-card"]);
    assert.equal(
      state.artwork?.materialVariants[0]?.imageStorageKey,
      "old-colored",
    );
  });

  it("creates the first adaptation without changing the original or its symbols", async () => {
    const { service, state } = harness();
    const original = structuredClone(state.artwork!.original);
    const result = await service.save(
      "coloring-1",
      input(undefined, "set-1"),
      files(),
    );
    assert.equal(result.variants.length, 1);
    assert.equal(state.artwork?.materialVariants[0]?.status, "DRAFT");
    assert.deepEqual(state.artwork?.original, original);
    assert.deepEqual(state.cleaned, []);
  });

  it("rejects a stale token before image processing", async () => {
    const { service, state } = harness();
    await assert.rejects(
      service.save("coloring-1", input("new"), files()),
      errorCode("STALE_UPLOAD", 409),
    );
    assert.equal(state.processed, 0);
    assert.deepEqual(state.stored, []);
  });

  it("rechecks CAS after locking and cleans only the losing upload", async () => {
    const { service, state } = harness();
    state.beforeTransaction = () => {
      state.artwork!.updatedAt = new Date("2099-01-01T00:00:00.010Z");
    };
    await assert.rejects(
      service.save("coloring-1", input(), files()),
      errorCode("STALE_UPLOAD", 409),
    );
    assert.deepEqual(state.originalWrites, []);
    assert.deepEqual(
      state.cleaned,
      state.stored.filter((file) => file.created).map((file) => file.key),
    );
    assert.equal(state.artwork!.original!.imageStorageKey, "old-colored");
  });

  for (const target of ["original", "set-1"]) {
    it(`rejects archived ${target} replacement`, async () => {
      const initial = artwork();
      initial.materialVariants = [variant()];
      if (target === "original") initial.original!.status = "ARCHIVED";
      else initial.materialVariants[0]!.status = "ARCHIVED";
      const { service, state } = harness(initial);
      await assert.rejects(
        service.save("coloring-1", input(undefined, target), files()),
        errorCode("VARIANT_ARCHIVED", 409),
      );
      assert.deepEqual(state.stored, []);
    });
    it(`rejects changed contours for ${target} when adaptations exist`, async () => {
      const initial = artwork();
      initial.materialVariants = [variant()];
      const { service, state } = harness(initial);
      state.pair.outline.checksum = "different";
      await assert.rejects(
        service.save("coloring-1", input(undefined, target), files()),
        errorCode("OUTLINE_IN_USE", 409),
      );
      assert.deepEqual(state.stored, []);
    });
  }

  for (const field of ["coloringStatus", "collectionStatus"] as const) {
    it(`rejects archived ${field}`, async () => {
      const { service, state } = harness();
      state[field] = "ARCHIVED";
      await assert.rejects(
        service.save("coloring-1", input(), files()),
        errorCode("COLORING_ARCHIVED", 409),
      );
      assert.equal(state.processed, 0);
    });
  }

  it("rejects archived sets and colors from another set", async () => {
    const { service, state } = harness();
    state.setArchived = true;
    await assert.rejects(
      service.save("coloring-1", input(undefined, "set-1"), files()),
      errorCode("MATERIAL_SET_ARCHIVED", 409),
    );
    state.setArchived = false;
    const request = input(undefined, "set-1");
    request.palette[0]!.materialColorId = "other-set-color";
    await assert.rejects(
      service.save("coloring-1", request, files()),
      errorCode("MATERIAL_COLOR_INVALID", 400),
    );
    assert.deepEqual(state.stored, []);
  });

  it("requires an original and all its explicit symbols for an adaptation", async () => {
    await assert.rejects(
      harness(null).service.save("coloring-1", input("new", "set-1"), files()),
      errorCode("ORIGINAL_REQUIRED", 400),
    );
    const request = input(undefined, "set-1");
    request.palette[1]!.symbolPosition = 2;
    await assert.rejects(
      harness().service.save("coloring-1", request, files()),
      errorCode("PALETTE_INVALID", 400),
    );
  });

  it("preserves original symbols already used by material adaptations", async () => {
    const initial = artwork();
    initial.materialVariants = [variant()];
    const request = input();
    request.palette[1]!.symbolPosition = 2;
    await assert.rejects(
      harness(initial).service.save("coloring-1", request, files()),
      errorCode("SYMBOLS_IN_USE", 409),
    );
  });

  it("rolls back persisted mutations and removes new files after a known failure", async () => {
    const { service, state } = harness();
    const before = structuredClone(state.artwork);
    state.transactionMode = "rollback";
    await assert.rejects(
      service.save("coloring-1", input(), files()),
      /commit connection lost/,
    );
    assert.deepEqual(state.artwork, before);
    assert.deepEqual(
      state.cleaned,
      state.stored.filter((file) => file.created).map((file) => file.key),
    );
  });

  it("reconciles a committed upload when its acknowledgement was lost", async () => {
    const { service, state } = harness();
    state.transactionMode = "committed";
    const result = await service.save("coloring-1", input(), files());
    assert.notEqual(result.token, initialDate.toISOString());
    assert.deepEqual(state.cleaned.sort(), ["old-card", "old-colored"]);
    assert.ok(state.stored.every((file) => !state.cleaned.includes(file.key)));
  });

  it("preserves all new and old files while commit outcome cannot be read", async () => {
    const { service, state } = harness();
    state.transactionMode = "committed";
    state.outcomeReadFails = true;
    await assert.rejects(
      service.save("coloring-1", input(), files()),
      /commit connection lost/,
    );
    assert.equal(state.stored.length, 3);
    assert.deepEqual(state.cleaned, []);
  });

  it("defers cleanup when reference checks fail without failing a saved upload", async () => {
    const { service, state } = harness();
    state.countFails = true;
    assert.ok((await service.save("coloring-1", input(), files())).original);
    assert.deepEqual(state.cleaned, []);
  });

  it("rejects missing/duplicate files and maps malformed images to IMAGE_INVALID", async () => {
    const { service, state } = harness();
    for (const upload of [
      undefined,
      { outline: files().outline },
      { ...files(), colored: [...files().colored, ...files().colored] },
    ]) {
      await assert.rejects(
        service.save("coloring-1", input(), upload),
        errorCode("IMAGE_INVALID", 400),
      );
    }
    state.mediaError = new BadRequestException("raw decoder detail");
    await assert.rejects(
      service.save("coloring-1", input(), files()),
      errorCode("IMAGE_INVALID", 400),
    );
    assert.deepEqual(state.stored, []);
  });

  it("resolves protected assets with expected checksum and dimensions", async () => {
    const { service } = harness();
    assert.deepEqual(await service.asset("coloring-1", "original", "card"), {
      key: "old-card",
      metadata: { checksum: "card-checksum", width: 400, height: 600 },
    });
    assert.deepEqual(await service.asset("coloring-1", "original", "outline"), {
      key: "old-outline",
      metadata: { checksum: "outline-checksum", width: 800, height: 1200 },
    });
    await assert.rejects(service.asset("coloring-1", "missing", "colored"), {
      status: 404,
    });
    await assert.rejects(service.asset("coloring-1", "original", "source"), {
      status: 400,
    });
  });
});

describe("Mutable variant publication", () => {
  it("publishes the original after verifying all derivatives and preserves legacy references", async () => {
    const { service, state } = harness();
    const legacy = structuredClone(state.legacy);
    const result = await service.publish(
      "coloring-1",
      "original",
      { expectedToken: initialDate.toISOString() },
      "admin-1",
    );
    assert.equal(result.original?.status, "published");
    assert.notEqual(result.token, initialDate.toISOString());
    assert.equal(state.coloringStatus, "PUBLISHED");
    assert.equal(state.publicFiles.length, 3);
    assert.deepEqual(state.legacy, legacy);
    assert.deepEqual(state.cleanedPublic, []);
  });
  it("requires publishing the original before its adaptation", async () => {
    const first = artwork();
    first.materialVariants = [variant()];
    const { service, state } = harness(first);
    await assert.rejects(
      service.publish(
        "coloring-1",
        "set-1",
        { expectedToken: initialDate.toISOString() },
        "admin",
      ),
      errorCode("ORIGINAL_NOT_PUBLISHED", 400),
    );
    assert.deepEqual(state.publicFiles, []);
    const original = await service.publish(
      "coloring-1",
      "original",
      { expectedToken: initialDate.toISOString() },
      "admin",
    );
    const adapted = await service.publish(
      "coloring-1",
      "set-1",
      { expectedToken: original.token },
      "admin",
    );
    assert.equal(adapted.variants[0]?.status, "published");
    assert.equal(state.artwork!.materialVariants[0]!.id, "variant-stable-id");
  });
  it("rejects stale publication without copying files", async () => {
    const { service, state } = harness();
    await assert.rejects(
      service.publish(
        "coloring-1",
        "original",
        { expectedToken: "new" },
        "admin",
      ),
      errorCode("STALE_UPLOAD", 409),
    );
    assert.deepEqual(state.publicFiles, []);
  });
  for (const missing of ["description", "theme", "product"]) {
    it(`requires ${missing} readiness`, async () => {
      const { service, state } = harness();
      if (missing === "description") state.description = " ";
      if (missing === "theme") state.themes = [];
      if (missing === "product") state.productStatus = "DRAFT";
      await assert.rejects(
        service.publish(
          "coloring-1",
          "original",
          { expectedToken: initialDate.toISOString() },
          "admin",
        ),
        errorCode("PUBLICATION_NOT_READY", 400),
      );
      assert.equal(state.publicationWrites, 0);
    });
  }
  it("does not mark an original published when a derivative fails verification", async () => {
    const { service, state } = harness();
    state.publicError = new Error("Invalid derivative");
    await assert.rejects(
      service.publish(
        "coloring-1",
        "original",
        { expectedToken: initialDate.toISOString() },
        "admin",
      ),
      /Invalid derivative/,
    );
    assert.equal(state.artwork!.original!.status, "DRAFT");
    assert.equal(state.coloringStatus, "DRAFT");
  });
  it("does not hide a media failure when rechecking an already published variant", async () => {
    const first = artwork();
    first.original!.status = "PUBLISHED";
    const { service, state } = harness(first);
    state.publicError = new Error("Invalid derivative");
    await assert.rejects(
      service.publish(
        "coloring-1",
        "original",
        { expectedToken: initialDate.toISOString() },
        "admin",
      ),
      /Invalid derivative/,
    );
  });
  it("reconciles a lost publication commit acknowledgement", async () => {
    const { service, state } = harness();
    state.transactionMode = "committed";
    assert.equal(
      (
        await service.publish(
          "coloring-1",
          "original",
          { expectedToken: initialDate.toISOString() },
          "admin",
        )
      ).original?.status,
      "published",
    );
    assert.deepEqual(state.cleaned, []);
    assert.deepEqual(state.cleanedPublic, []);
  });
  it("leaves publication as draft after a known rollback", async () => {
    const { service, state } = harness();
    state.transactionMode = "rollback";
    await assert.rejects(
      service.publish(
        "coloring-1",
        "original",
        { expectedToken: initialDate.toISOString() },
        "admin",
      ),
      /commit connection lost/,
    );
    assert.equal(state.artwork!.original!.status, "DRAFT");
    assert.equal(state.coloringStatus, "DRAFT");
  });
  for (const target of ["original", "set-1"]) {
    it(`replaces published ${target} in place and cleans both retired copies`, async () => {
      const first = artwork();
      first.original!.status = "PUBLISHED";
      first.materialVariants = [variant()];
      first.materialVariants[0]!.status = "PUBLISHED";
      const { service, state } = harness(first);
      const result = await service.save(
        "coloring-1",
        input(undefined, target),
        files(),
      );
      assert.equal(
        target === "original"
          ? result.original?.status
          : result.variants[0]?.status,
        "published",
      );
      assert.equal(state.publicFiles.length, 3);
      assert.deepEqual(state.cleanedPublic, state.cleaned);
      assert.equal(state.cleaned.length, 2);
      assert.ok(!state.cleaned.includes("old-outline"));
    });
  }
  it("keeps the old published image when replacement materialization fails", async () => {
    const first = artwork();
    first.original!.status = "PUBLISHED";
    const { service, state } = harness(first);
    state.publicError = new Error("copy failed");
    await assert.rejects(
      service.save("coloring-1", input(), files()),
      /copy failed/,
    );
    assert.equal(state.artwork!.original!.imageStorageKey, "old-colored");
    assert.equal(state.artwork!.original!.status, "PUBLISHED");
    assert.ok(!state.cleaned.includes("old-colored"));
  });
});

describe("SaveColoringVariantDTO multipart palette validation", () => {
  for (const invalid of [
    "{broken",
    "{}",
    "null",
    "[]",
    JSON.stringify([
      { symbolPosition: 1, hex: "#AABBCC" },
      { symbolPosition: 1, hex: "#FFFFFF" },
    ]),
    JSON.stringify([{ symbolPosition: 20, hex: "#AABBCC" }]),
    JSON.stringify([{ symbolPosition: 1, hex: "red" }]),
  ]) {
    it(`rejects invalid palette ${invalid}`, async () => {
      const dto = plainToInstance(SaveColoringVariantDTO, {
        ...input(),
        palette: invalid,
      });
      assert.ok(
        (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
          .length > 0,
      );
    });
  }
  it("accepts JSON gaps and repeated material colors, and trims alternatives", async () => {
    const dto = plainToInstance(SaveColoringVariantDTO, {
      ...input(undefined, "set-1"),
      imageAlt: "  Цветная картинка  ",
      palette: JSON.stringify(input(undefined, "set-1").palette),
    });
    assert.deepEqual(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
      [],
    );
    assert.deepEqual(
      dto.palette.map((row) => row.symbolPosition),
      [1, 7],
    );
    assert.equal(dto.imageAlt, "Цветная картинка");
  });
});
