import { createHash } from "node:crypto";

interface ImageGeometry {
  imageChecksum: string;
  width: number;
  height: number;
  symbolPositions: number[];
}

interface OriginalImage extends ImageGeometry {
  published: boolean;
  cardChecksum: string;
}

export interface OriginalCoverageSnapshot {
  version: 1;
  sourceFingerprint: string;
  colorings: {
    id: string;
    public: boolean;
    original: OriginalImage | null;
    legacy: ImageGeometry;
  }[];
  works: {
    id: string;
    coloringId: string;
    public: boolean;
    officialImageChecksum: string;
  }[];
}

type CoverageIssueCode =
  | "missing-original"
  | "unpublished-original"
  | "geometry-conflict"
  | "symbol-conflict"
  | "missing-coloring";

export interface OriginalCoverageReport {
  version: 1;
  scope: "original-coverage-only";
  policy: {
    catalog: "original";
    workshop: "original";
    digitalDefault: "artmate-168";
  };
  sourceFingerprint: string;
  fingerprint: string;
  coverageReady: boolean;
  requiredChecks: string[];
  issues: {
    entity: "coloring" | "work";
    id: string;
    code: CoverageIssueCode;
  }[];
  publicAvailabilityLoss: { coloringIds: string[]; workIds: string[] };
  colorings: {
    id: string;
    public: boolean;
    coverageReady: boolean;
    originalImageChecksum: string | null;
    originalCardChecksum: string | null;
  }[];
  works: {
    id: string;
    coloringId: string;
    public: boolean;
    coverageReady: boolean;
    comparisonTarget: { kind: "original"; imageChecksum: string } | null;
    comparisonChanged: boolean | null;
  }[];
}

function invalid(path: string, reason: string): never {
  throw new TypeError(
    `Invalid original coverage snapshot at ${path}: ${reason}`,
  );
}

function object(
  value: unknown,
  path: string,
  fields: string[],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return invalid(path, "expected a plain object");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => typeof key !== "string" || !fields.includes(key))
  ) {
    return invalid(path, `expected exactly these fields: ${fields.join(", ")}`);
  }
  return value as Record<string, unknown>;
}

function id(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    return invalid(
      path,
      "expected a nonempty ID without surrounding whitespace",
    );
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    return invalid(path, "expected a boolean");
  }
  return value;
}

function checksum(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^[a-fA-F0-9]{64}$/.test(value)) {
    return invalid(path, "expected a SHA256 hex digest");
  }
  return value.toLowerCase();
}

function dimension(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return invalid(path, "expected a positive safe integer");
  }
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    return invalid(path, "expected an explicit array");
  }
  // Reject sparse arrays as well as undefined elements during item validation.
  return Array.from(value);
}

function geometry(value: Record<string, unknown>, path: string): ImageGeometry {
  const symbolPositions = array(
    value.symbolPositions,
    `${path}.symbolPositions`,
  )
    .map((position) => {
      if (
        typeof position !== "number" ||
        !Number.isInteger(position) ||
        position < 1 ||
        position > 19
      ) {
        return invalid(
          `${path}.symbolPositions`,
          "expected integers from 1 to 19",
        );
      }
      return position;
    })
    .sort((a, b) => a - b);
  if (
    !symbolPositions.length ||
    new Set(symbolPositions).size !== symbolPositions.length
  ) {
    return invalid(
      `${path}.symbolPositions`,
      "expected a nonempty unique symbol set",
    );
  }
  return {
    imageChecksum: checksum(value.imageChecksum, `${path}.imageChecksum`),
    width: dimension(value.width, `${path}.width`),
    height: dimension(value.height, `${path}.height`),
    symbolPositions,
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueIds<T extends { id: string }>(values: T[], path: string): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    return invalid(path, "duplicate IDs");
  }
  return values.sort((a, b) => compare(a.id, b.id));
}

function parseSnapshot(input: unknown): OriginalCoverageSnapshot {
  const root = object(input, "$", [
    "version",
    "sourceFingerprint",
    "colorings",
    "works",
  ]);
  if (root.version !== 1)
    return invalid("$.version", "only version 1 is supported");
  const imageFields = ["imageChecksum", "width", "height", "symbolPositions"];
  return {
    version: 1,
    sourceFingerprint: checksum(root.sourceFingerprint, "$.sourceFingerprint"),
    colorings: uniqueIds(
      array(root.colorings, "$.colorings").map((entry, index) => {
        const path = `$.colorings[${index}]`;
        const coloring = object(entry, path, [
          "id",
          "public",
          "original",
          "legacy",
        ]);
        let original: OriginalImage | null = null;
        if (coloring.original !== null) {
          const originalPath = `${path}.original`;
          const parsed = object(coloring.original, originalPath, [
            ...imageFields,
            "published",
            "cardChecksum",
          ]);
          original = {
            ...geometry(parsed, originalPath),
            published: boolean(parsed.published, `${originalPath}.published`),
            cardChecksum: checksum(
              parsed.cardChecksum,
              `${originalPath}.cardChecksum`,
            ),
          };
        }
        return {
          id: id(coloring.id, `${path}.id`),
          public: boolean(coloring.public, `${path}.public`),
          original,
          legacy: geometry(
            object(coloring.legacy, `${path}.legacy`, imageFields),
            `${path}.legacy`,
          ),
        };
      }),
      "$.colorings",
    ),
    works: uniqueIds(
      array(root.works, "$.works").map((entry, index) => {
        const path = `$.works[${index}]`;
        const work = object(entry, path, [
          "id",
          "coloringId",
          "public",
          "officialImageChecksum",
        ]);
        return {
          id: id(work.id, `${path}.id`),
          coloringId: id(work.coloringId, `${path}.coloringId`),
          public: boolean(work.public, `${path}.public`),
          officialImageChecksum: checksum(
            work.officialImageChecksum,
            `${path}.officialImageChecksum`,
          ),
        };
      }),
      "$.works",
    ),
  };
}

/**
 * Analyzes declared coverage only. `published` is snapshot evidence, not a file
 * probe. Neither source provenance nor actual public eligibility is verified.
 * There is deliberately no runtime, database, filesystem or apply integration.
 */
export function analyzeOriginalCoverage(
  input: unknown,
): OriginalCoverageReport {
  const snapshot = parseSnapshot(input);
  const issues: OriginalCoverageReport["issues"] = [];
  const colorings: OriginalCoverageReport["colorings"] = snapshot.colorings.map(
    (coloring) => {
      const codes: CoverageIssueCode[] = [];
      const original = coloring.original;
      if (!original) {
        codes.push("missing-original");
      } else {
        if (!original.published) codes.push("unpublished-original");
        if (
          original.width !== coloring.legacy.width ||
          original.height !== coloring.legacy.height
        ) {
          codes.push("geometry-conflict");
        }
        if (
          JSON.stringify(original.symbolPositions) !==
          JSON.stringify(coloring.legacy.symbolPositions)
        ) {
          codes.push("symbol-conflict");
        }
      }
      issues.push(
        ...codes.map((code) => ({
          entity: "coloring" as const,
          id: coloring.id,
          code,
        })),
      );
      const coverageReady = codes.length === 0;
      return {
        id: coloring.id,
        public: coloring.public,
        coverageReady,
        originalImageChecksum:
          coverageReady && original ? original.imageChecksum : null,
        originalCardChecksum:
          coverageReady && original ? original.cardChecksum : null,
      };
    },
  );
  const coloringById = new Map(
    colorings.map((coloring) => [coloring.id, coloring]),
  );
  const works: OriginalCoverageReport["works"] = snapshot.works.map((work) => {
    const coloring = coloringById.get(work.coloringId);
    if (!coloring)
      issues.push({ entity: "work", id: work.id, code: "missing-coloring" });
    const imageChecksum = coloring?.originalImageChecksum ?? null;
    return {
      id: work.id,
      coloringId: work.coloringId,
      public: work.public,
      coverageReady: imageChecksum !== null,
      comparisonTarget:
        imageChecksum === null ? null : { kind: "original", imageChecksum },
      comparisonChanged:
        imageChecksum === null
          ? null
          : imageChecksum !== work.officialImageChecksum,
    };
  });
  issues.sort(
    (a, b) =>
      compare(a.entity, b.entity) ||
      compare(a.id, b.id) ||
      compare(a.code, b.code),
  );
  const report: Omit<OriginalCoverageReport, "fingerprint"> = {
    version: 1,
    scope: "original-coverage-only",
    policy: {
      catalog: "original",
      workshop: "original",
      digitalDefault: "artmate-168",
    },
    sourceFingerprint: snapshot.sourceFingerprint,
    coverageReady: issues.length === 0,
    requiredChecks: [
      "file-verification",
      "palette-catalog-mapping",
      "sql-dependencies",
      "user-data-invariants",
      "public-eligibility-parity",
    ],
    issues,
    publicAvailabilityLoss: {
      coloringIds: colorings
        .filter((coloring) => coloring.public && !coloring.coverageReady)
        .map((coloring) => coloring.id),
      workIds: works
        .filter((work) => work.public && !work.coverageReady)
        .map((work) => work.id),
    },
    colorings,
    works,
  };
  // Parsing rebuilt objects in fixed key order and sorted every set-like array.
  // Bind the report to all declared input, including unavailable originals.
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ snapshot, report }))
    .digest("hex");
  return { ...report, fingerprint };
}
