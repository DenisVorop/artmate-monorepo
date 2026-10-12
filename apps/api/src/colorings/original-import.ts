import { join } from "node:path";

import {
  Prisma,
  ColoringCollectionStatus,
  ColoringStatus,
  MaterialKind,
  ProductStatus,
} from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import type { ColoringMediaService } from "./coloring-media.service";
import type { ColoringStorageService } from "./coloring-storage.service";
import {
  legacyPaletteHash,
  readBundleFile,
  validateOriginalImportPlan,
  type OriginalImportAsset,
  type OriginalImportEntry,
  type OriginalImportPlan,
} from "./original-import-plan";

const artmateSet = {
  slug: "artmate-168",
  title: "Artmate · 168 цветов",
  brand: "Artmate",
  line: "168",
  productSlug: "akrilovye-markery-artmate-168-cvetov",
} as const;

export class OriginalImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OriginalImportValidationError";
  }
}

type Db = PrismaClient | Prisma.TransactionClient;
type Marker = {
  id: string;
  colorNumber: number;
  pantone: string;
  hex: string;
  catalogPosition: number;
  markerNumber: string;
};
type ColoringRow = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: ColoringStatus;
  publishedAt: Date | null;
  publishedRevisionId: string | null;
  collection: {
    slug: string;
    status: ColoringCollectionStatus;
    publishedAt: Date | null;
    product: { status: ProductStatus; slug: string; title: string };
  };
  themes: Array<{ tagId: string }>;
  publishedRevision: null | {
    id: string;
    firstPublishedAt: Date | null;
    width: number;
    height: number;
    outlineStorageKey: string;
    outlineByteSize: number;
    outlineChecksum: string;
    outlineAlt: string;
    coloredStorageKey: string;
    coloredByteSize: number;
    coloredChecksum: string;
    coloredSourceChecksum: string;
    coloredSourceMime: string;
    coloredAlt: string;
    cardStorageKey: string | null;
    cardByteSize: number | null;
    cardChecksum: string | null;
    cardWidth: number | null;
    cardHeight: number | null;
    paletteColors: Array<{
      symbolPosition: number;
      hex: string;
      markerNumber: string;
      markerColor: Marker;
    }>;
  };
  artwork: null | {
    width: number;
    height: number;
    derivativeProfile: string;
    outlineStorageKey: string;
    outlineChecksum: string;
    outlineByteSize: number;
    outlineSourceChecksum: string;
    outlineSourceMime: string;
    outlineAlt: string;
    original: null | {
      imageStorageKey: string;
      sourceChecksum: string;
      sourceMime: string;
      imageChecksum: string;
      imageByteSize: number;
      imageAlt: string;
      cardStorageKey: string;
      cardChecksum: string;
      cardByteSize: number;
      cardWidth: number;
      cardHeight: number;
      status: ColoringStatus;
      publishedAt: Date | null;
      colors: Array<{ symbolPosition: number; hex: string }>;
    };
    materialVariants: Array<{
      id: string;
      materialSetId: string;
      imageStorageKey: string;
      imageChecksum: string;
      imageByteSize: number;
      sourceChecksum: string;
      sourceMime: string;
      imageAlt: string;
      cardStorageKey: string;
      cardChecksum: string;
      cardByteSize: number;
      cardWidth: number;
      cardHeight: number;
      status: ColoringStatus;
      publishedAt: Date | null;
      assignments: Array<{
        symbolPosition: number;
        materialColor: { id: string; code: string; hex: string };
      }>;
    }>;
  };
};
type MaterialSetRow = null | {
  id: string;
  slug: string;
  title: string;
  brand: string;
  line: string | null;
  kind: MaterialKind;
  isArchived: boolean;
  product: null | { slug: string; title: string };
  colors: Array<{
    id: string;
    code: string;
    hex: string;
    pantone: string | null;
    position: number;
  }>;
};

export type OriginalImportReport = {
  planHash: string;
  mode: "check" | "apply";
  total: number;
  readyToCreate: number;
  alreadyImported: number;
  materialSet: { action: "create" | "reuse"; colorCount: number };
  bindings: Array<{
    coloringId: string;
    count: number;
    markerNumbers: string[];
  }>;
  committed?: true;
};

type PreparedEntry = {
  entry: OriginalImportEntry;
  row: ColoringRow;
  original: Buffer;
  outline: Buffer;
  card: Buffer;
  alreadyImported: boolean;
  bindings: Array<{ symbolPosition: number; marker: Marker }>;
  rowStateKey: string;
};

export type OriginalImportDependencies = {
  prisma: PrismaClient;
  media: ColoringMediaService;
  storage: ColoringStorageService;
};

export async function importOriginals(
  dependencies: OriginalImportDependencies,
  input: { plan: OriginalImportPlan; bundleRoot: string; apply: boolean },
): Promise<OriginalImportReport> {
  validateOriginalImportPlan(input.plan);
  const preparedFiles = await readAndVerifyPlanFiles(
    input.bundleRoot,
    input.plan,
    dependencies.media,
  );
  const snapshot = await readOnlySnapshot(dependencies.prisma, input.plan);
  const prepared = await validateSnapshot(
    snapshot,
    input.plan,
    preparedFiles,
    dependencies,
  );
  const materialSetAction = snapshot.materialSet ? "reuse" : "create";
  const report: OriginalImportReport = {
    planHash: input.plan.planHash,
    mode: input.apply ? "apply" : "check",
    total: prepared.length,
    readyToCreate: prepared.filter((item) => !item.alreadyImported).length,
    alreadyImported: prepared.filter((item) => item.alreadyImported).length,
    materialSet: {
      action: materialSetAction,
      colorCount: snapshot.markers.length,
    },
    bindings: prepared.map(({ entry, bindings }) => ({
      coloringId: entry.coloringId,
      count: bindings.length,
      markerNumbers: bindings.map(({ marker }) => marker.markerNumber),
    })),
  };
  if (!input.apply) return report;

  await verifyAndMaterializeFiles(dependencies, prepared, input.plan);
  await dependencies.prisma.$transaction(
    async (tx) => {
      await lockRows(tx, input.plan);
      const current = await loadSnapshot(tx, input.plan);
      const rechecked = await validateSnapshot(
        current,
        input.plan,
        preparedFiles,
        dependencies,
        { verifyLegacyFiles: false },
      );
      if (!samePreflight(prepared, rechecked)) {
        throw new Error(
          "Import inputs changed while assets were being prepared",
        );
      }
      const set =
        current.materialSet ?? (await createCanonicalMaterialSet(tx, current));
      for (const item of rechecked) {
        if (item.alreadyImported) continue;
        await writeEntry(tx, item, set.id, input.plan);
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120_000,
    },
  );
  return { ...report, committed: true };
}

async function readAndVerifyPlanFiles(
  bundleRoot: string,
  plan: OriginalImportPlan,
  media: ColoringMediaService,
) {
  const byColoring = new Map<
    string,
    Record<"outline" | "colored" | "card", Buffer>
  >();
  for (const entry of plan.entries) {
    const assets = {} as Record<"outline" | "colored" | "card", Buffer>;
    for (const kind of ["outline", "colored", "card"] as const) {
      const asset = entry.assets[kind];
      const buffer = await readBundleFile(
        bundleRoot,
        asset.file,
        asset.checksum,
      );
      await media.verifyDerivative(buffer, asset);
      if (buffer.length !== asset.byteSize)
        throw new Error("Import derivative byte size mismatch");
      assets[kind] = buffer;
    }
    byColoring.set(entry.coloringId, assets);
  }
  return byColoring;
}

async function readOnlySnapshot(
  prisma: PrismaClient,
  plan: OriginalImportPlan,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const settings = await tx.$queryRaw<
        Array<{ transaction_read_only: string }>
      >`SHOW transaction_read_only`;
      if (settings[0]?.transaction_read_only !== "on")
        throw new Error("Read-only database transaction is required");
      const schema = await inspectSchema(tx);
      if (!schema)
        throw new Error(
          "Originals tables are not installed; no migration was attempted",
        );
      return loadSnapshot(tx, plan);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60_000,
    },
  );
}

async function inspectSchema(tx: Db) {
  const tables = await tx.$queryRaw<
    Array<{ artworks: boolean; originals: boolean; colors: boolean }>
  >`
    SELECT to_regclass('public.coloring_artworks') IS NOT NULL AS artworks,
      to_regclass('public.coloring_originals') IS NOT NULL AS originals,
      to_regclass('public.coloring_original_colors') IS NOT NULL AS colors`;
  if (!tables[0]) throw new Error("Unable to inspect originals schema");
  const { artworks, originals, colors } = tables[0];
  if (artworks && originals && colors) return true;
  if (!artworks && !originals && !colors) return false;
  throw new Error(
    "Partial originals schema; import stopped without schema changes",
  );
}

async function loadSnapshot(tx: Db, plan: OriginalImportPlan) {
  if (!(await inspectSchema(tx)))
    throw new Error(
      "Originals tables are not installed; no migration was attempted",
    );
  const ids = plan.entries.map(({ coloringId }) => coloringId).sort();
  const colorings = await tx.coloring.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      status: true,
      publishedAt: true,
      publishedRevisionId: true,
      collection: {
        select: {
          slug: true,
          status: true,
          publishedAt: true,
          product: { select: { status: true, slug: true, title: true } },
        },
      },
      themes: { select: { tagId: true } },
      publishedRevision: {
        select: {
          id: true,
          firstPublishedAt: true,
          width: true,
          height: true,
          outlineStorageKey: true,
          outlineByteSize: true,
          outlineChecksum: true,
          outlineAlt: true,
          coloredStorageKey: true,
          coloredByteSize: true,
          coloredChecksum: true,
          coloredSourceChecksum: true,
          coloredSourceMime: true,
          coloredAlt: true,
          cardStorageKey: true,
          cardByteSize: true,
          cardChecksum: true,
          cardWidth: true,
          cardHeight: true,
          paletteColors: {
            orderBy: { symbolPosition: "asc" },
            select: {
              symbolPosition: true,
              hex: true,
              markerNumber: true,
              markerColor: {
                select: {
                  id: true,
                  colorNumber: true,
                  pantone: true,
                  hex: true,
                  catalogPosition: true,
                  markerNumber: true,
                },
              },
            },
          },
        },
      },
      artwork: {
        select: {
          width: true,
          height: true,
          derivativeProfile: true,
          outlineStorageKey: true,
          outlineChecksum: true,
          outlineByteSize: true,
          outlineSourceChecksum: true,
          outlineSourceMime: true,
          outlineAlt: true,
          original: {
            select: {
              imageStorageKey: true,
              sourceChecksum: true,
              sourceMime: true,
              imageChecksum: true,
              imageByteSize: true,
              imageAlt: true,
              cardStorageKey: true,
              cardChecksum: true,
              cardByteSize: true,
              cardWidth: true,
              cardHeight: true,
              status: true,
              publishedAt: true,
              colors: {
                orderBy: { symbolPosition: "asc" },
                select: { symbolPosition: true, hex: true },
              },
            },
          },
          materialVariants: {
            select: {
              id: true,
              materialSetId: true,
              imageStorageKey: true,
              imageChecksum: true,
              imageByteSize: true,
              sourceChecksum: true,
              sourceMime: true,
              imageAlt: true,
              cardStorageKey: true,
              cardChecksum: true,
              cardByteSize: true,
              cardWidth: true,
              cardHeight: true,
              status: true,
              publishedAt: true,
              assignments: {
                select: {
                  symbolPosition: true,
                  materialColor: {
                    select: { id: true, code: true, hex: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  const markers = await tx.markerColor.findMany({
    orderBy: { catalogPosition: "asc" },
    select: {
      id: true,
      colorNumber: true,
      pantone: true,
      hex: true,
      catalogPosition: true,
      markerNumber: true,
    },
  });
  const materialSet = await tx.materialSet.findUnique({
    where: { slug: artmateSet.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      brand: true,
      line: true,
      kind: true,
      isArchived: true,
      product: { select: { slug: true, title: true } },
      colors: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          code: true,
          hex: true,
          pantone: true,
          position: true,
        },
      },
    },
  });
  const product = materialSet
    ? null
    : await tx.product.findUnique({
        where: { slug: artmateSet.productSlug },
        select: { id: true, slug: true, title: true, status: true },
      });
  return {
    colorings: colorings as unknown as ColoringRow[],
    markers: markers as Marker[],
    materialSet: materialSet as MaterialSetRow,
    product,
  };
}

async function validateSnapshot(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  plan: OriginalImportPlan,
  files: Awaited<ReturnType<typeof readAndVerifyPlanFiles>>,
  dependencies: OriginalImportDependencies,
  options: { verifyLegacyFiles: boolean } = { verifyLegacyFiles: true },
): Promise<PreparedEntry[]> {
  if (snapshot.colorings.length !== plan.entries.length)
    throw new OriginalImportValidationError(
      "Import plan does not match the current coloring set",
    );
  const markers = validateMarkerCatalog(snapshot.markers);
  const materialColorByCode = snapshot.materialSet
    ? validateMaterialSet(snapshot.materialSet, markers)
    : new Map<string, { id: string; code: string; hex: string }>();
  if (snapshot.materialSet && snapshot.materialSet.isArchived)
    throw new OriginalImportValidationError(
      "Canonical Artmate material set is archived",
    );
  if (
    !snapshot.materialSet &&
    (!snapshot.product ||
      snapshot.product.slug !== artmateSet.productSlug ||
      snapshot.product.status !== ProductStatus.PUBLISHED)
  )
    throw new OriginalImportValidationError(
      "Published Artmate 168 product is required to create the canonical material set",
    );
  const rowsById = new Map(snapshot.colorings.map((row) => [row.id, row]));
  const prepared: PreparedEntry[] = [];
  for (const entry of plan.entries) {
    const row = rowsById.get(entry.coloringId);
    const revision = row?.publishedRevision;
    if (
      !row ||
      !revision ||
      row.id !== entry.coloringId ||
      row.number !== entry.number ||
      row.collection.slug !== entry.collectionSlug ||
      revision.id !== entry.publishedRevisionId ||
      row.publishedRevisionId !== entry.publishedRevisionId ||
      !revision.firstPublishedAt ||
      row.status !== ColoringStatus.PUBLISHED ||
      !row.publishedAt ||
      !row.description?.trim() ||
      row.collection.status !== ColoringCollectionStatus.PUBLISHED ||
      !row.collection.publishedAt ||
      row.collection.product.status !== ProductStatus.PUBLISHED ||
      !row.themes.length
    )
      throw new OriginalImportValidationError(
        `Coloring ${entry.coloringId} is not currently public and published`,
      );
    if (revision.outlineChecksum.toLowerCase() !== entry.legacyOutlineChecksum)
      throw new OriginalImportValidationError(
        `Legacy outline changed for coloring ${entry.coloringId}`,
      );
    if (row.title !== entry.title)
      throw new OriginalImportValidationError(
        `Coloring title changed for coloring ${entry.coloringId}`,
      );
    if (
      revision.width !== entry.assets.outline.width ||
      revision.height !== entry.assets.outline.height ||
      entry.assets.outline.width !== entry.assets.colored.width ||
      entry.assets.outline.height !== entry.assets.colored.height
    )
      throw new OriginalImportValidationError(
        `Image geometry changed for coloring ${entry.coloringId}`,
      );
    if (
      !revision.cardStorageKey ||
      !revision.cardChecksum ||
      !revision.cardByteSize ||
      !revision.cardWidth ||
      !revision.cardHeight ||
      revision.cardByteSize <= 0 ||
      revision.cardWidth <= 0 ||
      revision.cardHeight <= 0
    )
      throw new OriginalImportValidationError(
        `Legacy card metadata is incomplete for coloring ${entry.coloringId}`,
      );
    const palette = revision.paletteColors.map(
      ({ symbolPosition, hex, markerNumber }) => ({
        symbolPosition,
        hex,
        markerNumber,
      }),
    );
    if (legacyPaletteHash(palette) !== entry.legacyPaletteHash)
      throw new OriginalImportValidationError(
        `Legacy palette changed for coloring ${entry.coloringId}`,
      );
    const positions = palette
      .map(({ symbolPosition }) => symbolPosition)
      .sort((a, b) => a - b);
    const originalPositions = entry.colors
      .map(({ symbolPosition }) => symbolPosition)
      .sort((a, b) => a - b);
    if (JSON.stringify(positions) !== JSON.stringify(originalPositions))
      throw new OriginalImportValidationError(
        `Palette positions differ for coloring ${entry.coloringId}`,
      );
    const bindings = palette
      .map((color) => {
        const marker = markers.find(
          (candidate) => candidate.markerNumber === color.markerNumber,
        );
        if (
          !marker ||
          marker.id !==
            revision.paletteColors.find(
              (item) => item.symbolPosition === color.symbolPosition,
            )?.markerColor.id ||
          marker.hex.toUpperCase() !== color.hex.toUpperCase() ||
          marker.hex !==
            revision.paletteColors.find(
              (item) => item.symbolPosition === color.symbolPosition,
            )?.markerColor.hex ||
          marker.pantone !==
            revision.paletteColors.find(
              (item) => item.symbolPosition === color.symbolPosition,
            )?.markerColor.pantone ||
          marker.colorNumber !==
            revision.paletteColors.find(
              (item) => item.symbolPosition === color.symbolPosition,
            )?.markerColor.colorNumber ||
          marker.catalogPosition !==
            revision.paletteColors.find(
              (item) => item.symbolPosition === color.symbolPosition,
            )?.markerColor.catalogPosition
        )
          throw new OriginalImportValidationError(
            `Legacy palette does not match the canonical marker catalog for coloring ${entry.coloringId}`,
          );
        return { symbolPosition: color.symbolPosition, marker };
      })
      .sort((a, b) => a.symbolPosition - b.symbolPosition);
    const alreadyImported = checkExistingImport(
      row.artwork,
      entry,
      revision,
      bindings,
      materialColorByCode,
      snapshot.materialSet?.id,
      plan.planHash,
    );
    if (!alreadyImported && row.artwork)
      throw new OriginalImportValidationError(
        `Existing artwork conflicts with the import for coloring ${entry.coloringId}`,
      );
    const filesForEntry = files.get(entry.coloringId);
    if (!filesForEntry)
      throw new OriginalImportValidationError(
        "Import derivative files are incomplete",
      );
    if (options.verifyLegacyFiles)
      await verifyLegacyAssets(dependencies, revision);
    prepared.push({
      entry,
      row,
      original: filesForEntry.colored,
      outline: filesForEntry.outline,
      card: filesForEntry.card,
      alreadyImported,
      bindings,
      rowStateKey: JSON.stringify(row),
    });
  }
  validateMaterialSetCreationInputs(snapshot.markers);
  return prepared;
}

function validateMarkerCatalog(markers: Marker[]) {
  if (markers.length !== 168)
    throw new OriginalImportValidationError(
      `Canonical marker catalog must contain exactly 168 rows; found ${markers.length}`,
    );
  const numbers = new Set<string>();
  for (const [index, marker] of markers.entries()) {
    if (
      marker.catalogPosition !== index + 1 ||
      !/^\d{3}$/.test(marker.markerNumber) ||
      numbers.has(marker.markerNumber) ||
      !/^#[0-9A-F]{6}$/.test(marker.hex) ||
      !marker.pantone.trim()
    )
      throw new OriginalImportValidationError(
        "Canonical marker catalog is invalid",
      );
    numbers.add(marker.markerNumber);
  }
  return markers;
}

function validateMaterialSet(
  set: NonNullable<MaterialSetRow>,
  markers: Marker[],
) {
  if (
    set.slug !== artmateSet.slug ||
    set.brand !== artmateSet.brand ||
    set.line !== artmateSet.line ||
    set.kind !== MaterialKind.MARKER ||
    set.isArchived ||
    set.product?.slug !== artmateSet.productSlug ||
    set.colors.length !== 168
  )
    throw new OriginalImportValidationError(
      "Existing canonical material set conflicts with the marker catalog",
    );
  const byCode = new Map(set.colors.map((color) => [color.code, color]));
  for (const marker of markers) {
    const color = byCode.get(marker.markerNumber);
    if (
      !color ||
      color.hex !== marker.hex ||
      color.pantone !== marker.pantone ||
      color.position !== marker.catalogPosition
    )
      throw new OriginalImportValidationError(
        "Existing canonical material set conflicts with the marker catalog",
      );
  }
  return new Map(
    set.colors.map(({ id, code, hex }) => [code, { id, code, hex }]),
  );
}

function validateMaterialSetCreationInputs(markers: Marker[]) {
  if (markers.length !== 168)
    throw new Error(
      "Canonical material set requires exactly 168 marker colors",
    );
}

function checkExistingImport(
  artwork: ColoringRow["artwork"],
  entry: OriginalImportEntry,
  revision: NonNullable<ColoringRow["publishedRevision"]>,
  bindings: Array<{ symbolPosition: number; marker: Marker }>,
  materialColors: Map<string, { id: string; code: string; hex: string }>,
  materialSetId?: string,
  planHashValue?: string,
) {
  const original = artwork?.original;
  const variant = artwork?.materialVariants.find(
    (item) => item.materialSetId === materialSetId,
  );
  if (!artwork || !original || !variant || !materialSetId) return false;
  if (
    !planHashValue ||
    artwork.derivativeProfile !== "webp-preview-v3" ||
    artwork.width !== entry.assets.outline.width ||
    artwork.height !== entry.assets.outline.height ||
    artwork.outlineChecksum !== entry.assets.outline.checksum ||
    artwork.outlineStorageKey !==
      importAssetKey(
        entry.coloringId,
        planHashValue,
        "outline",
        entry.assets.outline,
      ) ||
    artwork.outlineByteSize !== entry.assets.outline.byteSize ||
    artwork.outlineSourceChecksum !== entry.assets.outline.sourceChecksum ||
    artwork.outlineSourceMime !== entry.assets.outline.sourceMime ||
    artwork.outlineAlt !== entry.outlineAlt
  )
    return false;
  if (
    original.sourceChecksum !== entry.assets.colored.sourceChecksum ||
    original.sourceMime !== entry.assets.colored.sourceMime ||
    original.imageChecksum !== entry.assets.colored.checksum ||
    original.imageStorageKey !==
      importAssetKey(
        entry.coloringId,
        planHashValue,
        "colored",
        entry.assets.colored,
      ) ||
    original.imageByteSize !== entry.assets.colored.byteSize ||
    original.imageAlt !== entry.imageAlt ||
    original.cardStorageKey !==
      importAssetKey(
        entry.coloringId,
        planHashValue,
        "card",
        entry.assets.card,
      ) ||
    original.cardChecksum !== entry.assets.card.checksum ||
    original.cardByteSize !== entry.assets.card.byteSize ||
    original.cardWidth !== entry.assets.card.width ||
    original.cardHeight !== entry.assets.card.height ||
    original.status !== ColoringStatus.PUBLISHED ||
    original.publishedAt?.getTime() !== revision.firstPublishedAt?.getTime()
  )
    return false;
  if (
    original.colors.length !== entry.colors.length ||
    entry.colors.some(
      (color, index) =>
        original.colors[index]?.symbolPosition !== color.symbolPosition ||
        original.colors[index]?.hex !== color.hex,
    )
  )
    return false;
  if (
    variant.status !== ColoringStatus.PUBLISHED ||
    variant.imageStorageKey !== revision.coloredStorageKey ||
    variant.imageChecksum !== revision.coloredChecksum ||
    variant.imageByteSize !== revision.coloredByteSize ||
    variant.sourceChecksum !== revision.coloredSourceChecksum ||
    variant.sourceMime !== revision.coloredSourceMime ||
    variant.imageAlt !== revision.coloredAlt ||
    variant.cardStorageKey !== revision.cardStorageKey ||
    variant.cardChecksum !== revision.cardChecksum ||
    variant.cardByteSize !== revision.cardByteSize ||
    variant.cardWidth !== revision.cardWidth ||
    variant.cardHeight !== revision.cardHeight ||
    variant.publishedAt?.getTime() !== revision.firstPublishedAt?.getTime()
  )
    return false;
  if (variant.assignments.length !== bindings.length) return false;
  return bindings.every(({ symbolPosition, marker }) => {
    const assignment = variant.assignments.find(
      (item) => item.symbolPosition === symbolPosition,
    );
    const color = materialColors.get(marker.markerNumber);
    return Boolean(
      assignment &&
      color &&
      assignment.materialColor.id === color.id &&
      assignment.materialColor.code === marker.markerNumber &&
      assignment.materialColor.hex === marker.hex,
    );
  });
}

function importAssetKey(
  coloringId: string,
  planHashValue: string,
  kind: "outline" | "colored" | "card",
  asset: OriginalImportAsset,
) {
  return `${coloringId}/${planHashValue.slice(0, 32)}/${kind}-${asset.checksum}.webp`;
}

async function verifyLegacyAssets(
  dependencies: OriginalImportDependencies,
  revision: NonNullable<ColoringRow["publishedRevision"]>,
) {
  const assets = [
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
      key: revision.cardStorageKey!,
      checksum: revision.cardChecksum!,
      width: revision.cardWidth!,
      height: revision.cardHeight!,
    },
  ];
  for (const asset of assets) {
    const buffer = await dependencies.storage.readProtected(asset.key, asset);
    await dependencies.media.verifyDerivative(buffer, asset);
  }
}

async function verifyAndMaterializeFiles(
  dependencies: OriginalImportDependencies,
  prepared: PreparedEntry[],
  plan: OriginalImportPlan,
) {
  for (const item of prepared) {
    const { entry, row } = item;
    const revision = row.publishedRevision!;
    const originalKey = (
      kind: "outline" | "colored" | "card",
      asset: OriginalImportAsset,
    ) =>
      `${entry.coloringId}/${plan.planHash.slice(0, 32)}/${kind}-${asset.checksum}.webp`;
    const newAssets = [
      {
        kind: "outline" as const,
        asset: entry.assets.outline,
        buffer: item.outline,
      },
      {
        kind: "colored" as const,
        asset: entry.assets.colored,
        buffer: item.original,
      },
      { kind: "card" as const, asset: entry.assets.card, buffer: item.card },
    ];
    for (const { kind, asset, buffer } of newAssets) {
      const key = originalKey(kind, asset);
      await dependencies.storage.writePrivatePair([
        { key, buffer, checksum: asset.checksum },
      ]);
      await dependencies.storage.materializePublicPair([
        {
          key,
          checksum: asset.checksum,
          width: asset.width,
          height: asset.height,
        },
      ]);
      await dependencies.storage.readPublic(key, {
        checksum: asset.checksum,
        width: asset.width,
        height: asset.height,
      });
    }
    for (const asset of [
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
        key: revision.cardStorageKey!,
        checksum: revision.cardChecksum!,
        width: revision.cardWidth!,
        height: revision.cardHeight!,
      },
    ]) {
      await dependencies.storage.materializePublicPair([asset]);
      await dependencies.storage.readPublic(asset.key, {
        checksum: asset.checksum,
        width: asset.width,
        height: asset.height,
      });
    }
  }
}

async function lockRows(tx: Db, plan: OriginalImportPlan) {
  const ids = plan.entries.map(({ coloringId }) => coloringId).sort();
  for (const id of ids) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "colorings" WHERE "id" = ${id} FOR UPDATE`,
    );
  }
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "coloring_collections" WHERE "id" IN (SELECT "collection_id" FROM "colorings" WHERE "id" = ANY(${ids})) FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "products" WHERE "id" IN (SELECT p."id" FROM "products" p JOIN "coloring_collections" c ON c."product_id" = p."id" JOIN "colorings" g ON g."collection_id" = c."id" WHERE g."id" = ANY(${ids})) FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "coloring_revisions" WHERE "id" IN (SELECT "published_revision_id" FROM "colorings" WHERE "id" = ANY(${ids})) FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "marker_colors" ORDER BY "catalog_position" FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "material_sets" WHERE "slug" = ${artmateSet.slug} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "material_colors" WHERE "material_set_id" IN (SELECT "id" FROM "material_sets" WHERE "slug" = ${artmateSet.slug}) ORDER BY "position" FOR UPDATE`,
  );
}

async function createCanonicalMaterialSet(
  tx: Db,
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
) {
  if (!snapshot.product || snapshot.product.status !== ProductStatus.PUBLISHED)
    throw new Error(
      "Published Artmate 168 product is required to create the canonical material set",
    );
  const set = await tx.materialSet.create({
    data: {
      slug: artmateSet.slug,
      title: artmateSet.title,
      brand: artmateSet.brand,
      line: artmateSet.line,
      kind: MaterialKind.MARKER,
      productId: snapshot.product.id,
      colors: {
        createMany: {
          data: snapshot.markers.map((marker) => ({
            code: marker.markerNumber,
            name: marker.markerNumber,
            hex: marker.hex,
            pantone: marker.pantone,
            position: marker.catalogPosition,
          })),
        },
      },
    },
    select: { id: true, colors: { select: { id: true, code: true } } },
  });
  return set;
}

async function writeEntry(
  tx: Db,
  item: PreparedEntry,
  materialSetId: string,
  plan: OriginalImportPlan,
) {
  const { entry, row } = item;
  const revision = row.publishedRevision!;
  const key = (
    kind: "outline" | "colored" | "card",
    asset: OriginalImportAsset,
  ) =>
    `${entry.coloringId}/${plan.planHash.slice(0, 32)}/${kind}-${asset.checksum}.webp`;
  const assets = entry.assets;
  const outlineKey = key("outline", assets.outline);
  const coloredKey = key("colored", assets.colored);
  const cardKey = key("card", assets.card);
  const artwork = await tx.coloringArtwork.create({
    data: {
      coloringId: entry.coloringId,
      width: assets.outline.width,
      height: assets.outline.height,
      derivativeProfile: plan.derivativeProfile,
      colorSpace: "srgb",
      outlineStorageKey: outlineKey,
      outlineChecksum: assets.outline.checksum,
      outlineByteSize: assets.outline.byteSize,
      outlineSourceChecksum: assets.outline.sourceChecksum,
      outlineSourceMime: assets.outline.sourceMime,
      outlineAlt: entry.outlineAlt,
    },
    select: { coloringId: true },
  });
  await tx.coloringOriginal.create({
    data: {
      coloringId: artwork.coloringId,
      imageStorageKey: coloredKey,
      imageChecksum: assets.colored.checksum,
      imageByteSize: assets.colored.byteSize,
      sourceChecksum: assets.colored.sourceChecksum,
      sourceMime: assets.colored.sourceMime,
      imageAlt: entry.imageAlt,
      cardStorageKey: cardKey,
      cardChecksum: assets.card.checksum,
      cardByteSize: assets.card.byteSize,
      cardWidth: assets.card.width,
      cardHeight: assets.card.height,
      status: ColoringStatus.PUBLISHED,
      publishedAt: revision.firstPublishedAt,
      colors: { createMany: { data: entry.colors } },
    },
  });
  const legacyCardWidth = revision.cardWidth!;
  const legacyCardHeight = revision.cardHeight!;
  const variant = await tx.coloringMaterialVariant.create({
    data: {
      coloringId: entry.coloringId,
      materialSetId,
      imageStorageKey: revision.coloredStorageKey,
      imageChecksum: revision.coloredChecksum,
      imageByteSize: revision.coloredByteSize,
      sourceChecksum: revision.coloredSourceChecksum,
      sourceMime: revision.coloredSourceMime,
      imageAlt: revision.coloredAlt,
      cardStorageKey: revision.cardStorageKey!,
      cardChecksum: revision.cardChecksum!,
      cardByteSize: revision.cardByteSize!,
      cardWidth: legacyCardWidth,
      cardHeight: legacyCardHeight,
      status: ColoringStatus.PUBLISHED,
      publishedAt: revision.firstPublishedAt,
    },
    select: { id: true },
  });
  const setColors = await tx.materialColor.findMany({
    where: { materialSetId },
    select: { id: true, code: true },
  });
  const idByCode = new Map(setColors.map(({ id, code }) => [code, id]));
  const assignments = item.bindings.map(({ symbolPosition, marker }) => {
    const materialColorId = idByCode.get(marker.markerNumber);
    if (!materialColorId)
      throw new Error("Canonical material assignment is missing");
    return {
      variantId: variant.id,
      materialSetId,
      materialColorId,
      symbolPosition,
    };
  });
  await tx.coloringMaterialAssignment.createMany({ data: assignments });
}

function samePreflight(before: PreparedEntry[], after: PreparedEntry[]) {
  return (
    before.length === after.length &&
    before.every(
      (item, index) =>
        item.entry.coloringId === after[index]?.entry.coloringId &&
        item.alreadyImported === after[index]?.alreadyImported &&
        item.rowStateKey === after[index]?.rowStateKey,
    )
  );
}

export function defaultColoringStorageRoots(cwd = process.cwd()) {
  return {
    privateRoot: join(cwd, "private", "colorings"),
    publicRoot: join(cwd, "uploads", "colorings"),
  };
}
