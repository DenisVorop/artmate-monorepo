import { createHash } from "node:crypto";

import { ColoringStatus, type Prisma } from "../generated/prisma/client";
import { publicWorkshopWorkWhere } from "../workshops/workshop-eligibility";
import {
  analyzeOriginalCoverage,
  type OriginalCoverageSnapshot,
} from "./original-coverage-preflight";
import { publicColoringWhere } from "./public-coloring-eligibility";

export type OriginalCoverageSchema = "present" | "legacy-only";
type ColoringRecord = OriginalCoverageSnapshot["colorings"][number];
type WorkRecord = OriginalCoverageSnapshot["works"][number];

export interface OriginalCoverageExport {
  version: 1;
  scope: "original-coverage-export";
  sourceFingerprint: string;
  originalsSchema: OriginalCoverageSchema;
  exportReady: boolean;
  snapshot: OriginalCoverageSnapshot | null;
  records: {
    colorings: (Omit<ColoringRecord, "legacy"> & {
      legacy: ColoringRecord["legacy"] | null;
    })[];
    works: (Omit<WorkRecord, "officialImageChecksum"> & {
      officialImageChecksum: string | null;
    })[];
  };
  references: {
    colorings: {
      id: string;
      collectionSlug: string;
      number: number;
      legacyRevisionId: string | null;
    }[];
    works: { revisionId: string; workId: string; publicId: string | null }[];
  };
  diagnostics: {
    severity: "warning" | "blocker";
    entity: "schema" | "coloring" | "work" | "work-revision" | "original";
    id: string | null;
    code: string;
    message: string;
  }[];
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// All selected arrays are sets (rows or palette positions); canonicalization
// also protects the fingerprint from driver object-key and result ordering.
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map(canonical)
      .sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => compare(a, b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/**
 * Caller must use a REPEATABLE READ, READ ONLY transaction and verify schema
 * availability through the catalog before choosing legacy-only. This function
 * never catches database errors or probes files, and performs only SELECTs.
 */
export async function exportOriginalCoverageSnapshot(
  tx: Prisma.TransactionClient,
  options: { originalsSchema: OriginalCoverageSchema },
): Promise<OriginalCoverageExport> {
  if (!["present", "legacy-only"].includes(options.originalsSchema)) {
    throw new TypeError(
      "An explicitly verified originals schema mode is required",
    );
  }
  const colorings = await tx.coloring.findMany({
    select: {
      id: true,
      number: true,
      publishedRevisionId: true,
      collection: { select: { slug: true } },
    },
    orderBy: { id: "asc" },
  });
  const publicColorings = await tx.coloring.findMany({
    where: publicColoringWhere,
    select: {
      id: true,
      description: true,
      publishedAt: true,
      publishedRevisionId: true,
      publishedRevision: { select: { id: true, firstPublishedAt: true } },
    },
    orderBy: { id: "asc" },
  });
  const officialRevisions = await tx.coloringRevision.findMany({
    select: {
      id: true,
      coloringId: true,
      version: true,
      coloredChecksum: true,
      width: true,
      height: true,
      paletteColors: {
        select: { symbolPosition: true },
        orderBy: { symbolPosition: "asc" },
      },
    },
    orderBy: [{ coloringId: "asc" }, { version: "desc" }, { id: "asc" }],
  });
  const works = await tx.workshopWork.findMany({
    select: {
      id: true,
      publicId: true,
      coloringId: true,
      currentRevisionId: true,
      publishedRevisionId: true,
    },
    orderBy: { id: "asc" },
  });
  const publicWorks = await tx.workshopWork.findMany({
    where: publicWorkshopWorkWhere,
    select: {
      id: true,
      publishedRevisionId: true,
      publishedRevision: { select: { id: true } },
    },
    orderBy: { id: "asc" },
  });
  const workRevisions = await tx.workshopWorkRevision.findMany({
    select: {
      id: true,
      workId: true,
      coloringId: true,
      officialRevisionId: true,
    },
    orderBy: { id: "asc" },
  });
  const artworks =
    options.originalsSchema === "present"
      ? await tx.coloringArtwork.findMany({
          select: { coloringId: true, width: true, height: true },
          orderBy: { coloringId: "asc" },
        })
      : [];
  const originals =
    options.originalsSchema === "present"
      ? await tx.coloringOriginal.findMany({
          select: {
            coloringId: true,
            imageChecksum: true,
            cardChecksum: true,
            status: true,
            publishedAt: true,
            colors: {
              select: { symbolPosition: true },
              orderBy: { symbolPosition: "asc" },
            },
          },
          orderBy: { coloringId: "asc" },
        })
      : [];

  const sourceFingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          originalsSchema: options.originalsSchema,
          colorings,
          publicColorings,
          officialRevisions,
          works,
          publicWorks,
          workRevisions,
          artworks,
          originals,
        }),
      ),
    )
    .digest("hex");
  const result: OriginalCoverageExport = {
    version: 1,
    scope: "original-coverage-export",
    sourceFingerprint,
    originalsSchema: options.originalsSchema,
    exportReady: false,
    snapshot: null,
    records: { colorings: [], works: [] },
    references: { colorings: [], works: [] },
    diagnostics: [],
  };
  const block = (
    entity: OriginalCoverageExport["diagnostics"][number]["entity"],
    id: string,
    code: string,
    message: string,
  ) =>
    result.diagnostics.push({ severity: "blocker", entity, id, code, message });
  if (options.originalsSchema === "legacy-only") {
    result.diagnostics.push({
      severity: "warning",
      entity: "schema",
      id: null,
      code: "original-schema-absent",
      message:
        "Original tables are absent; every original is unknown, not migrated.",
    });
  }
  const coloringById = new Map(colorings.map((row) => [row.id, row]));
  const officialById = new Map(officialRevisions.map((row) => [row.id, row]));
  const workById = new Map(works.map((row) => [row.id, row]));
  const workRevisionById = new Map(workRevisions.map((row) => [row.id, row]));
  const artworkById = new Map(artworks.map((row) => [row.coloringId, row]));
  const originalById = new Map(originals.map((row) => [row.coloringId, row]));
  const publicColoringIds = new Set(
    publicColorings
      .filter(
        (row) =>
          // Same additional runtime readiness check as PublicColoringsService.
          row.description?.trim() &&
          row.publishedAt &&
          row.publishedRevisionId &&
          row.publishedRevision?.firstPublishedAt,
      )
      .map((row) => row.id),
  );
  const publicWorkIds = new Set(
    publicWorks.filter((row) => row.publishedRevision).map((row) => row.id),
  );
  for (const row of publicColorings) {
    if (
      !coloringById.has(row.id) ||
      row.publishedRevisionId !== row.publishedRevision?.id ||
      row.publishedRevisionId !== coloringById.get(row.id)?.publishedRevisionId
    ) {
      block(
        "coloring",
        row.id,
        "public-reference-mismatch",
        "Public coloring revision does not match its persisted reference.",
      );
    }
  }
  for (const row of publicWorks) {
    if (
      !workById.has(row.id) ||
      row.publishedRevisionId !== row.publishedRevision?.id ||
      row.publishedRevisionId !== workById.get(row.id)?.publishedRevisionId
    ) {
      block(
        "work",
        row.id,
        "public-reference-mismatch",
        "Public work revision does not match its persisted reference.",
      );
    }
  }
  for (const row of officialRevisions) {
    if (!coloringById.has(row.coloringId)) {
      block(
        "coloring",
        row.coloringId,
        "orphan-official-revision",
        `Official revision ${row.id} has no coloring.`,
      );
    }
  }
  for (const row of artworks) {
    if (!coloringById.has(row.coloringId)) {
      block(
        "original",
        row.coloringId,
        "orphan-artwork",
        "Artwork has no coloring.",
      );
    }
  }
  for (const row of originals) {
    if (!artworkById.has(row.coloringId) || !coloringById.has(row.coloringId)) {
      block(
        "original",
        row.coloringId,
        "orphan-original",
        "Original has no matching artwork and coloring.",
      );
    }
  }
  for (const coloring of [...colorings].sort((a, b) => compare(a.id, b.id))) {
    const legacy = coloring.publishedRevisionId
      ? officialById.get(coloring.publishedRevisionId)
      : officialRevisions
          .filter((row) => row.coloringId === coloring.id)
          .sort((a, b) => b.version - a.version || compare(a.id, b.id))[0];
    let legacyImage: ColoringRecord["legacy"] | null = null;
    if (!legacy) {
      block(
        "coloring",
        coloring.id,
        coloring.publishedRevisionId
          ? "dangling-published-revision"
          : "missing-legacy-source",
        "No persisted official revision is available; legacy metadata cannot be fabricated.",
      );
    } else if (legacy.coloringId !== coloring.id) {
      block(
        "coloring",
        coloring.id,
        "official-revision-coloring-mismatch",
        "Selected official revision belongs to another coloring.",
      );
    } else {
      legacyImage = {
        imageChecksum: legacy.coloredChecksum.toLowerCase(),
        width: legacy.width,
        height: legacy.height,
        symbolPositions: legacy.paletteColors
          .map((row) => row.symbolPosition)
          .sort((a, b) => a - b),
      };
    }
    const original = originalById.get(coloring.id);
    const artwork = artworkById.get(coloring.id);
    result.records.colorings.push({
      id: coloring.id,
      public: publicColoringIds.has(coloring.id),
      legacy: legacyImage,
      original:
        original && artwork
          ? {
              published:
                original.status === ColoringStatus.PUBLISHED &&
                original.publishedAt !== null,
              imageChecksum: original.imageChecksum.toLowerCase(),
              cardChecksum: original.cardChecksum.toLowerCase(),
              width: artwork.width,
              height: artwork.height,
              symbolPositions: original.colors
                .map((row) => row.symbolPosition)
                .sort((a, b) => a - b),
            }
          : null,
    });
    result.references.colorings.push({
      id: coloring.id,
      collectionSlug: coloring.collection.slug,
      number: coloring.number,
      legacyRevisionId: legacy?.id ?? coloring.publishedRevisionId,
    });
  }
  for (const work of works) {
    if (!coloringById.has(work.coloringId)) {
      block(
        "work",
        work.id,
        "missing-work-coloring",
        "Work refers to a missing coloring.",
      );
    }
    for (const field of ["currentRevisionId", "publishedRevisionId"] as const) {
      const ref = work[field];
      const revision = ref ? workRevisionById.get(ref) : undefined;
      if (
        ref &&
        (!revision ||
          revision.workId !== work.id ||
          revision.coloringId !== work.coloringId)
      ) {
        block(
          "work",
          work.id,
          "invalid-work-revision-reference",
          `${field} does not resolve to a revision of this work and coloring.`,
        );
      }
    }
  }
  for (const revision of [...workRevisions].sort((a, b) =>
    compare(a.id, b.id),
  )) {
    const work = workById.get(revision.workId);
    const official = officialById.get(revision.officialRevisionId);
    if (!work || work.coloringId !== revision.coloringId) {
      block(
        "work-revision",
        revision.id,
        "work-revision-owner-mismatch",
        "Revision has no matching work and coloring.",
      );
    }
    if (!official || official.coloringId !== revision.coloringId) {
      block(
        "work-revision",
        revision.id,
        "invalid-official-revision-reference",
        "Official revision does not resolve to this coloring.",
      );
    }
    result.records.works.push({
      id: revision.id,
      coloringId: revision.coloringId,
      public: Boolean(
        work &&
        publicWorkIds.has(work.id) &&
        work.publishedRevisionId === revision.id,
      ),
      officialImageChecksum:
        official?.coloringId === revision.coloringId
          ? official.coloredChecksum.toLowerCase()
          : null,
    });
    result.references.works.push({
      revisionId: revision.id,
      workId: revision.workId,
      publicId: work?.publicId ?? null,
    });
  }
  if (!result.diagnostics.some((row) => row.severity === "blocker")) {
    const snapshot = {
      version: 1,
      sourceFingerprint,
      colorings: result.records.colorings,
      works: result.records.works,
    };
    try {
      // Reuse strict analyzer validation; coverage failures are legitimate
      // snapshot content, while malformed source metadata blocks export.
      analyzeOriginalCoverage(snapshot);
      result.snapshot = snapshot as OriginalCoverageSnapshot;
      result.exportReady = true;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      block("schema", "snapshot", "invalid-source-metadata", error.message);
    }
  }
  result.diagnostics.sort(
    (a, b) =>
      compare(a.entity, b.entity) ||
      compare(a.id ?? "", b.id ?? "") ||
      compare(a.code, b.code) ||
      compare(a.message, b.message),
  );
  return result;
}
