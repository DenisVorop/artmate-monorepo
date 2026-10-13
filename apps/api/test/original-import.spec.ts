import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  importDatabaseUrl,
  parseImportArguments,
} from "../src/colorings/import-originals";
import {
  importOriginals,
  type OriginalImportDependencies,
  type OriginalImportReport,
} from "../src/colorings/original-import";
import { artmateMarkerColors } from "../src/colorings/marker-colors.data";
import {
  legacyPaletteHash,
  planHash,
  sha256,
  type OriginalImportPlan,
} from "../src/colorings/original-import-plan";
import type {
  Coloring,
  ColoringArtwork,
  ColoringOriginal,
  ColoringRevision,
  ColoringCollection,
  MarkerColor,
  MaterialColor,
  MaterialSet,
  Prisma,
  Product,
} from "../src/generated/prisma/client";

type MarkerRow = Pick<
  MarkerColor,
  "id" | "colorNumber" | "pantone" | "hex" | "catalogPosition" | "markerNumber"
>;
type MaterialColorRow = Pick<
  MaterialColor,
  "id" | "code" | "hex" | "pantone" | "position"
>;
type ImageRow = Pick<
  ColoringOriginal,
  | "imageStorageKey"
  | "imageChecksum"
  | "imageByteSize"
  | "sourceChecksum"
  | "sourceMime"
  | "imageAlt"
  | "cardStorageKey"
  | "cardChecksum"
  | "cardByteSize"
  | "cardWidth"
  | "cardHeight"
  | "status"
  | "publishedAt"
>;
type OriginalColor = { symbolPosition: number; hex: string };
type OriginalRow = ImageRow & { colors: OriginalColor[] };
type OutlineRow = Pick<
  ColoringArtwork,
  | "outlineStorageKey"
  | "outlineChecksum"
  | "outlineByteSize"
  | "outlineSourceChecksum"
  | "outlineSourceMime"
  | "outlineAlt"
>;
type VariantRow = ImageRow &
  OutlineRow & {
    id: string;
    materialSetId: string;
    assignments: Array<{
      symbolPosition: number;
      materialColor: MaterialColorRow;
    }>;
  };
type ArtworkRow = Pick<
  ColoringArtwork,
  | "width"
  | "height"
  | "derivativeProfile"
  | "colorSpace"
  | "outlineStorageKey"
  | "outlineChecksum"
  | "outlineByteSize"
  | "outlineSourceChecksum"
  | "outlineSourceMime"
  | "outlineAlt"
> & { original: OriginalRow | null; materialVariants: VariantRow[] };
type RevisionRow = Pick<
  ColoringRevision,
  | "id"
  | "firstPublishedAt"
  | "width"
  | "height"
  | "outlineStorageKey"
  | "outlineByteSize"
  | "outlineChecksum"
  | "outlineAlt"
  | "outlineSourceChecksum"
  | "outlineSourceMime"
  | "coloredStorageKey"
  | "coloredByteSize"
  | "coloredChecksum"
  | "coloredSourceChecksum"
  | "coloredSourceMime"
  | "coloredAlt"
  | "cardStorageKey"
  | "cardByteSize"
  | "cardChecksum"
  | "cardWidth"
  | "cardHeight"
> & {
  paletteColors: Array<
    OriginalColor & { markerNumber: string; markerColor: MarkerRow }
  >;
};
type ColoringRow = Pick<
  Coloring,
  | "id"
  | "number"
  | "title"
  | "description"
  | "status"
  | "publishedAt"
  | "publishedRevisionId"
> & {
  collection: Pick<ColoringCollection, "slug" | "status" | "publishedAt"> & {
    product: Pick<Product, "status" | "slug" | "title">;
  };
  themes: Array<{ tagId: string }>;
  publishedRevision: RevisionRow;
  artwork: ArtworkRow | null;
};
type MaterialSetRow = Pick<
  MaterialSet,
  "id" | "slug" | "title" | "brand" | "line" | "kind" | "isArchived"
> & {
  product: Pick<Product, "slug" | "title">;
  colors: MaterialColorRow[];
};
type ArtworkCreateData = Omit<ArtworkRow, "original" | "materialVariants"> & {
  coloringId: string;
};
type OriginalCreateData = ImageRow & {
  coloringId: string;
  colors: { createMany: { data: OriginalColor[] } };
};
type VariantCreateData = ImageRow &
  OutlineRow & {
    coloringId: string;
    materialSetId: string;
  };
type AssignmentCreateData = {
  variantId: string;
  materialSetId: string;
  materialColorId: string;
  symbolPosition: number;
};

function existingArtwork(
  entry: OriginalImportPlan["entries"][number],
  hash: string,
): ArtworkRow {
  return {
    width: entry.assets.outline.width,
    height: entry.assets.outline.height,
    derivativeProfile: "webp-preview-v3",
    colorSpace: "srgb",
    outlineStorageKey: `${entry.coloringId}/${hash.slice(0, 32)}/outline-${entry.assets.outline.checksum}.webp`,
    outlineChecksum: entry.assets.outline.checksum,
    outlineByteSize: entry.assets.outline.byteSize,
    outlineSourceChecksum: entry.assets.outline.sourceChecksum,
    outlineSourceMime: entry.assets.outline.sourceMime,
    outlineAlt: entry.outlineAlt,
    original: null,
    materialVariants: [],
  };
}

const checksum = (seed: number) => seed.toString(16).padStart(64, "0");

function importFixture(entryCount = 1) {
  const marker = artmateMarkerColors[0]!;
  const palette = [
    { symbolPosition: 1, hex: marker.hex, markerNumber: marker.markerNumber },
  ];
  const entries = Array.from({ length: entryCount }, (_, index) => {
    const coloringId = `coloring${index + 1}`;
    const revisionId = `revision${index + 1}`;
    const asset = (kind: string, seed: number, width = 300, height = 420) => {
      const file = `${coloringId}/${kind}.webp`;
      const bytes = Buffer.from(file);
      return {
        file,
        checksum: sha256(bytes),
        sourceChecksum: checksum(seed + 100),
        sourceMime: "image/png" as const,
        byteSize: bytes.length,
        width,
        height,
      };
    };
    return {
      coloringId,
      collectionSlug: "flowers",
      number: index + 1,
      title: `Flower ${index + 1}`,
      publishedRevisionId: revisionId,
      legacyOutlineChecksum: checksum(900),
      legacyPaletteHash: legacyPaletteHash(palette),
      outlineAlt: `Outline ${index + 1}`,
      imageAlt: `Colored ${index + 1}`,
      sourceKey: `flowers:source${index + 1}`,
      match: { distance: 0.01, runnerUp: 0.15 },
      // Archive manifests sort object keys; equality must be semantic.
      colors: [{ hex: "#112233", symbolPosition: 1 }],
      assets: {
        outline: asset("outline", index * 10 + 1),
        colored: asset("colored", index * 10 + 2),
        card: asset("card", index * 10 + 3, 100, 140),
      },
    };
  });
  const body: Omit<OriginalImportPlan, "planHash"> = {
    schemaVersion: 1,
    derivativeProfile: "webp-preview-v3",
    sourceManifestChecksum: checksum(999),
    entries,
  };
  return { ...body, planHash: planHash(body) } satisfies OriginalImportPlan;
}

function databaseFixture(
  plan: OriginalImportPlan,
  options: {
    commitError?: boolean;
    failInsert?: boolean;
    existing?: boolean;
  } = {},
) {
  const markerRows = artmateMarkerColors.map((item) => ({
    ...item,
    id: `marker-${item.markerNumber}`,
  }));
  const materialColors = markerRows.map((marker, index) => ({
    id: `material-${marker.markerNumber}`,
    code: marker.markerNumber,
    hex: marker.hex,
    pantone: marker.pantone,
    position: index + 1,
  }));
  const first = markerRows[0]!;
  const stamp = new Date("2023-01-02T00:00:00.000Z");
  const rows: ColoringRow[] = plan.entries.map((entry) => ({
    id: entry.coloringId,
    number: entry.number,
    title: entry.title,
    description: "Public coloring description",
    status: "PUBLISHED",
    publishedAt: stamp,
    publishedRevisionId: entry.publishedRevisionId,
    collection: {
      slug: entry.collectionSlug,
      status: "PUBLISHED",
      publishedAt: stamp,
      product: { status: "PUBLISHED", slug: "product", title: "Product" },
    },
    themes: [{ tagId: "flowers" }],
    publishedRevision: {
      id: entry.publishedRevisionId,
      firstPublishedAt: stamp,
      width: 300,
      height: 420,
      outlineStorageKey: `${entry.coloringId}/legacy-outline.webp`,
      outlineByteSize: 8,
      outlineChecksum: entry.legacyOutlineChecksum,
      outlineAlt: "Legacy outline",
      outlineSourceChecksum: checksum(703),
      outlineSourceMime: "image/png",
      coloredStorageKey: `${entry.coloringId}/legacy-colored.webp`,
      coloredByteSize: 8,
      coloredChecksum: checksum(700),
      coloredSourceChecksum: checksum(701),
      coloredSourceMime: "image/png",
      coloredAlt: "Legacy colored",
      cardStorageKey: `${entry.coloringId}/legacy-card.webp`,
      cardByteSize: 8,
      cardChecksum: checksum(702),
      cardWidth: 100,
      cardHeight: 140,
      paletteColors: [
        {
          symbolPosition: 1,
          hex: first.hex,
          markerNumber: first.markerNumber,
          markerColor: first,
        },
      ],
    },
    artwork: null,
  }));
  const set: MaterialSetRow = {
    id: "material-set",
    slug: "artmate-168",
    title: "Artmate · 168 цветов",
    brand: "Artmate",
    line: "168",
    kind: "MARKER",
    isArchived: false,
    product: {
      slug: "akrilovye-markery-artmate-168-cvetov",
      title: "Акриловые маркеры Artmate, 168 цветов",
    },
    colors: materialColors,
  };
  if (options.existing) {
    for (const row of rows) {
      row.artwork = existingArtwork(
        plan.entries.find((entry) => entry.coloringId === row.id)!,
        plan.planHash,
      );
    }
  }
  const writes = {
    artwork: 0,
    original: 0,
    variant: 0,
    assignments: 0,
    set: 0,
  };
  let committedOnce = false;
  let transactionCount = 0;
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async (query: Prisma.Sql | TemplateStringsArray) => {
      const sql = "sql" in query ? query.sql : query.join("");
      if (sql.includes("transaction_read_only"))
        return [{ transaction_read_only: "on" }];
      if (sql.includes("to_regclass"))
        return [{ artworks: true, originals: true, colors: true }];
      return [];
    },
    coloring: {
      findMany: async () => structuredClone(rows),
    },
    markerColor: { findMany: async () => markerRows },
    materialSet: { findUnique: async () => set },
    product: { findUnique: async () => null },
    coloringArtwork: {
      create: async ({ data }: { data: ArtworkCreateData }) => {
        if (options.failInsert && writes.artwork > 0)
          throw new Error("simulated insert failure after first batch entry");
        writes.artwork++;
        const row = rows.find((item) => item.id === data.coloringId)!;
        row.artwork = { ...data, original: null, materialVariants: [] };
        return { coloringId: data.coloringId };
      },
    },
    coloringOriginal: {
      create: async ({ data }: { data: OriginalCreateData }) => {
        writes.original++;
        const row = rows.find((item) => item.id === data.coloringId)!;
        assert.ok(row.artwork);
        row.artwork.original = { ...data, colors: data.colors.createMany.data };
        return {};
      },
    },
    coloringMaterialVariant: {
      create: async ({ data }: { data: VariantCreateData }) => {
        writes.variant++;
        const row = rows.find((item) => item.id === data.coloringId)!;
        const variant: VariantRow = {
          ...data,
          id: `variant-${data.coloringId}`,
          assignments: [],
        };
        assert.ok(row.artwork);
        row.artwork.materialVariants.push(variant);
        return { id: variant.id };
      },
    },
    materialColor: { findMany: async () => materialColors },
    coloringMaterialAssignment: {
      createMany: async ({ data }: { data: AssignmentCreateData[] }) => {
        writes.assignments += data.length;
        for (const item of data) {
          const variant = rows.find(
            (row) => row.id === item.variantId?.replace("variant-", ""),
          )?.artwork?.materialVariants[0];
          const materialColor = materialColors.find(
            (color) => color.id === item.materialColorId,
          );
          assert.ok(variant);
          assert.ok(materialColor);
          variant.assignments.push({
            symbolPosition: item.symbolPosition,
            materialColor,
          });
        }
        return { count: data.length };
      },
    },
  };
  const prisma = {
    ...tx,
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
      transactionCount++;
      const before = structuredClone(rows);
      const beforeWrites = { ...writes };
      try {
        const result = await callback(tx);
        if (options.commitError && transactionCount > 1 && !committedOnce) {
          committedOnce = true;
          throw new Error("simulated lost commit acknowledgement");
        }
        return result;
      } catch (error) {
        if (
          !(
            options.commitError &&
            committedOnce &&
            writes.original > beforeWrites.original
          )
        ) {
          rows.splice(0, rows.length, ...before);
          Object.assign(writes, beforeWrites);
        }
        throw error;
      }
    },
  };
  return { prisma, rows, writes, set };
}

async function runImport(
  plan: OriginalImportPlan,
  fixture: ReturnType<typeof databaseFixture>,
  apply: boolean,
): Promise<{
  result?: OriginalImportReport;
  error?: unknown;
  storageEvents: string[];
}> {
  const root = await mkdtemp(join(tmpdir(), "artmate-originals-integration-"));
  await mkdir(root, { recursive: true });
  for (const entry of plan.entries)
    for (const asset of Object.values(entry.assets)) {
      const path = join(root, asset.file);
      await mkdir(join(path, ".."), { recursive: true });
      const bytes = Buffer.from(asset.file);
      await writeFile(path, bytes);
    }
  const storageEvents: string[] = [];
  const media = { verifyDerivative: async () => undefined } satisfies Pick<
    OriginalImportDependencies["media"],
    "verifyDerivative"
  >;
  const storage = {
    readProtected: async () => Buffer.from("legacy"),
    writePrivatePair: async (assets: Array<{ key: string }>) => {
      storageEvents.push(`private:${assets[0]!.key}`);
      return [];
    },
    materializePublicPair: async (assets: Array<{ key: string }>) => {
      storageEvents.push(`public:${assets[0]!.key}`);
      return [];
    },
    readPublic: async () => Buffer.from("verified"),
  } satisfies Pick<
    OriginalImportDependencies["storage"],
    | "readProtected"
    | "writePrivatePair"
    | "materializePublicPair"
    | "readPublic"
  >;
  try {
    const result = await importOriginals(
      {
        prisma:
          fixture.prisma as unknown as OriginalImportDependencies["prisma"],
        media: media as unknown as OriginalImportDependencies["media"],
        storage: storage as unknown as OriginalImportDependencies["storage"],
      },
      { plan, bundleRoot: root, apply },
    );
    return { result, storageEvents };
  } catch (error) {
    return { error, storageEvents };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("import command requires explicit local or production mode and absolute input paths", () => {
  assert.throws(
    () =>
      parseImportArguments(["--plan=/tmp/plan.json", "--bundle=/tmp/bundle"]),
    /Choose --local or --production explicitly/,
  );
  assert.throws(
    () =>
      parseImportArguments([
        "--local",
        "--plan=plan.json",
        "--bundle=/tmp/bundle",
      ]),
    /Usage:/,
  );
  assert.throws(
    () =>
      parseImportArguments([
        "--local",
        "--production",
        "--plan=/tmp/plan.json",
        "--bundle=/tmp/bundle",
      ]),
    /Choose only one database mode/,
  );
});

test("check mode is the default and apply requires a confirmation hash", () => {
  const parsed = parseImportArguments([
    "--local",
    "--plan=/tmp/plan.json",
    "--bundle=/tmp/bundle",
  ]);
  assert.equal(parsed.apply, false);
  assert.equal(parsed.production, false);
  assert.throws(
    () =>
      parseImportArguments([
        "--local",
        "--apply",
        "--plan=/tmp/plan.json",
        "--bundle=/tmp/bundle",
      ]),
    /Apply requires --confirm/,
  );
  assert.equal(
    parseImportArguments([
      "--local",
      "--apply",
      "--confirm=" + "a".repeat(64),
      "--plan=/tmp/plan.json",
      "--bundle=/tmp/bundle",
    ]).apply,
    true,
  );
});

test("local mode only accepts an explicit localhost database URL", () => {
  assert.throws(
    () =>
      importDatabaseUrl("local", {
        ORIGINAL_IMPORT_DATABASE_URL:
          "postgresql://user:secret@db.example.test/app",
      }),
    /localhost/,
  );
  assert.equal(
    importDatabaseUrl("local", {
      ORIGINAL_IMPORT_DATABASE_URL:
        "postgresql://user:secret@localhost:5432/app",
    }),
    "postgresql://user:secret@localhost:5432/app",
  );
  assert.throws(
    () =>
      importDatabaseUrl("local", {
        DATABASE_URL: "postgresql://user:secret@localhost:5432/app",
      }),
    /Set ORIGINAL_IMPORT_DATABASE_URL explicitly/,
  );
});

test("production mode requires explicit mode and rejects localhost", () => {
  assert.throws(
    () =>
      importDatabaseUrl("production", {
        ORIGINAL_IMPORT_DATABASE_URL:
          "postgresql://user:secret@localhost:5432/app",
      }),
    /nonlocal/,
  );
  assert.equal(
    importDatabaseUrl("production", {
      ORIGINAL_IMPORT_DATABASE_URL:
        "postgresql://user:secret@db.example.test/app",
    }),
    "postgresql://user:secret@db.example.test/app",
  );
  assert.equal(
    importDatabaseUrl("production", {
      DATABASE_URL: "postgresql://user:secret@db.example.test/app",
    }),
    "postgresql://user:secret@db.example.test/app",
  );
});

test("unsupported database URL options are rejected without echoing credentials", () => {
  assert.throws(
    () =>
      importDatabaseUrl("local", {
        ORIGINAL_IMPORT_DATABASE_URL:
          "postgresql://user:secret@localhost/app?sslmode=require",
      }),
    (error: unknown) => {
      assert.match(
        error instanceof Error ? error.message : "",
        /Unsupported import database URL/,
      );
      assert.doesNotMatch(
        error instanceof Error ? error.message : "",
        /secret/,
      );
      return true;
    },
  );
});

test("check-only preflight never writes files or database rows", async () => {
  const plan = importFixture();
  const fixture = databaseFixture(plan);
  fixture.set.title = "User-edited catalog title";
  fixture.set.product.title = "Current published product wording";
  const { result, storageEvents } = await runImport(plan, fixture, false);
  assert.ok(result);
  assert.equal(result.mode, "check");
  assert.equal(result.readyToCreate, 1);
  assert.deepEqual(storageEvents, []);
  assert.deepEqual(fixture.writes, {
    artwork: 0,
    original: 0,
    variant: 0,
    assignments: 0,
    set: 0,
  });
});

test("snapshot, canonical marker and existing-original conflicts stop before file writes", async () => {
  for (const mutate of [
    (plan: OriginalImportPlan, state: ReturnType<typeof databaseFixture>) => {
      state.rows[0]!.publishedRevisionId = "revision-changed";
    },
    (plan: OriginalImportPlan, state: ReturnType<typeof databaseFixture>) => {
      state.rows[0]!.publishedRevision!.outlineChecksum = checksum(88);
    },
    (_plan: OriginalImportPlan, state: ReturnType<typeof databaseFixture>) => {
      state.rows[0]!.publishedRevision!.paletteColors[0]!.markerColor.hex =
        "#000000";
    },
    (plan: OriginalImportPlan, state: ReturnType<typeof databaseFixture>) => {
      const entry = plan.entries[0]!;
      state.rows[0]!.artwork = {
        ...existingArtwork(entry, plan.planHash),
        original: {
          imageStorageKey: "conflicting-original.webp",
          imageChecksum: entry.assets.colored.checksum,
          imageByteSize: entry.assets.colored.byteSize,
          sourceChecksum: checksum(12),
          sourceMime: "image/png",
          imageAlt: entry.imageAlt,
          cardStorageKey: "conflicting-card.webp",
          cardChecksum: entry.assets.card.checksum,
          cardByteSize: entry.assets.card.byteSize,
          cardWidth: entry.assets.card.width,
          cardHeight: entry.assets.card.height,
          status: "PUBLISHED",
          publishedAt: state.rows[0]!.publishedAt,
          colors: entry.colors,
        },
      };
    },
  ]) {
    const plan = importFixture();
    const state = databaseFixture(plan);
    mutate(plan, state);
    const { error, storageEvents } = await runImport(plan, state, true);
    assert.ok(error instanceof Error);
    assert.deepEqual(storageEvents, []);
    assert.deepEqual(state.writes, {
      artwork: 0,
      original: 0,
      variant: 0,
      assignments: 0,
      set: 0,
    });
  }
});

test("an insert failure rolls the entire batch back while leaving deterministic files in place", async () => {
  const plan = importFixture(2);
  const state = databaseFixture(plan, { failInsert: true });
  const { error, storageEvents } = await runImport(plan, state, true);
  assert.ok(error instanceof Error);
  assert.ok(storageEvents.length > 0);
  assert.deepEqual(
    state.rows.map((row) => row.artwork),
    [null, null],
  );
  assert.deepEqual(state.writes, {
    artwork: 0,
    original: 0,
    variant: 0,
    assignments: 0,
    set: 0,
  });
});

test("a conflict in a later batch entry blocks the entire batch before storage writes", async () => {
  const plan = importFixture(2);
  const state = databaseFixture(plan);
  state.rows[1]!.publishedRevision!.paletteColors[0]!.hex = "#000000";
  const { error, storageEvents } = await runImport(plan, state, true);
  assert.ok(error instanceof Error);
  assert.deepEqual(storageEvents, []);
  assert.deepEqual(
    state.rows.map((row) => row.artwork),
    [null, null],
  );
});

test("a lost commit acknowledgement retains files and a verified retry is idempotent", async () => {
  const plan = importFixture();
  const state = databaseFixture(plan, { commitError: true });
  const first = await runImport(plan, state, true);
  assert.ok(first.error instanceof Error);
  assert.ok(
    first.storageEvents.length > 0,
    first.error instanceof Error ? first.error.message : "no import error",
  );
  assert.ok(state.rows[0]!.artwork?.original);
  const second = await runImport(plan, state, true);
  assert.ok(second.result);
  assert.equal(second.result.alreadyImported, 1);
  assert.equal(second.result.readyToCreate, 0);
  assert.equal(second.result.committed, true);
  assert.deepEqual(state.writes, {
    artwork: 1,
    original: 1,
    variant: 1,
    assignments: 1,
    set: 0,
  });
});

test("a completed import preserves published legacy revision and historical snapshot fields", async () => {
  const plan = importFixture();
  const state = databaseFixture(plan);
  const revisionBefore = structuredClone(state.rows[0]!.publishedRevision);
  const coloringBefore = {
    publishedRevisionId: state.rows[0]!.publishedRevisionId,
    publishedAt: state.rows[0]!.publishedAt,
  };
  const { result } = await runImport(plan, state, true);
  assert.ok(result);
  assert.equal(result.committed, true);
  assert.deepEqual(state.rows[0]!.publishedRevision, revisionBefore);
  assert.deepEqual(
    {
      publishedRevisionId: state.rows[0]!.publishedRevisionId,
      publishedAt: state.rows[0]!.publishedAt,
    },
    coloringBefore,
  );
  assert.deepEqual(state.writes, {
    artwork: 1,
    original: 1,
    variant: 1,
    assignments: 1,
    set: 0,
  });
});

test("imports the paired legacy contour while retaining the distinct original contour", async () => {
  const plan = importFixture();
  const state = databaseFixture(plan);
  const { result } = await runImport(plan, state, true);
  assert.ok(result?.committed);
  const artwork = state.rows[0]!.artwork!;
  const variant = artwork.materialVariants[0]!;
  const revision = state.rows[0]!.publishedRevision;
  for (const field of [
    "outlineStorageKey",
    "outlineChecksum",
    "outlineByteSize",
    "outlineSourceChecksum",
    "outlineSourceMime",
    "outlineAlt",
  ] as const) {
    assert.equal(variant[field], revision[field]);
  }
  assert.notEqual(variant.outlineStorageKey, artwork.outlineStorageKey);
  assert.notEqual(variant.outlineChecksum, artwork.outlineChecksum);
});

test("a retry rejects every changed paired contour field before writes", async () => {
  const mutations = [
    { outlineStorageKey: "original/outline.webp" },
    { outlineChecksum: checksum(999) },
    { outlineByteSize: 99 },
    { outlineSourceChecksum: checksum(998) },
    { outlineSourceMime: "image/webp" },
    { outlineAlt: "Оригинальный контур" },
  ];
  for (const mutation of mutations) {
    const plan = importFixture();
    const state = databaseFixture(plan);
    assert.ok((await runImport(plan, state, true)).result?.committed);
    Object.assign(state.rows[0]!.artwork!.materialVariants[0]!, mutation);
    const writes = structuredClone(state.writes);
    const retry = await runImport(plan, state, true);
    assert.ok(retry.error instanceof Error);
    assert.match(retry.error.message, /Existing artwork conflicts/);
    assert.deepEqual(retry.storageEvents, []);
    assert.deepEqual(state.writes, writes);
  }
});
