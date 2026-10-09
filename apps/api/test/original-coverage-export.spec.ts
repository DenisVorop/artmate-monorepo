import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Prisma } from "../src/generated/prisma/client";
import { exportOriginalCoverageSnapshot } from "../src/colorings/original-coverage-export";
import { analyzeOriginalCoverage } from "../src/colorings/original-coverage-preflight";
import { publicColoringWhere } from "../src/colorings/public-coloring-eligibility";
import { publicWorkshopWorkWhere } from "../src/workshops/workshop-eligibility";

const checksum = (letter: string) => letter.repeat(64);
const publishedAt = new Date("2026-09-27T00:00:00.000Z");

function fixture() {
  return {
    colorings: [
      {
        id: "c1",
        number: 1,
        publishedRevisionId: "r1" as string | null,
        collection: { slug: "dogs" },
      },
    ],
    publicColorings: [
      {
        id: "c1",
        description: "A dog",
        publishedAt,
        publishedRevisionId: "r1",
        publishedRevision: { id: "r1", firstPublishedAt: publishedAt },
      },
    ],
    officialRevisions: [1, 2].map((version) => ({
      id: `r${version}`,
      coloringId: "c1",
      version,
      coloredChecksum: checksum(version === 1 ? "a" : "b"),
      width: 100,
      height: 200,
      paletteColors: [{ symbolPosition: 19 }, { symbolPosition: 1 }],
    })),
    works: [
      {
        id: "w1",
        publicId: "public1",
        coloringId: "c1",
        currentRevisionId: "wr2" as string | null,
        publishedRevisionId: "wr1" as string | null,
      },
    ],
    publicWorks: [
      {
        id: "w1",
        publishedRevisionId: "wr1",
        publishedRevision: { id: "wr1" },
      },
    ],
    workRevisions: [1, 2].map((sequence) => ({
      id: `wr${sequence}`,
      workId: "w1",
      coloringId: "c1",
      officialRevisionId: `r${sequence}`,
    })),
    artworks: [{ coloringId: "c1", width: 100, height: 200 }],
    originals: [
      {
        coloringId: "c1",
        imageChecksum: checksum("c"),
        cardChecksum: checksum("d"),
        status: "PUBLISHED",
        publishedAt: publishedAt as Date | null,
        colors: [{ symbolPosition: 1 }, { symbolPosition: 19 }],
      },
    ],
  };
}

function mockTx(data = fixture()) {
  const calls: { delegate: string; args: Record<string, unknown> }[] = [];
  const query = (
    delegate: string,
    rows: unknown[] | ((args: Record<string, unknown>) => unknown[]),
  ) => ({
    findMany: async (args: Record<string, unknown>) => {
      calls.push({ delegate, args });
      return typeof rows === "function" ? rows(args) : rows;
    },
  });
  const mock = {
    coloring: query("coloring", (args) =>
      args.where ? data.publicColorings : data.colorings,
    ),
    coloringRevision: query("coloringRevision", data.officialRevisions),
    workshopWork: query("workshopWork", (args) =>
      args.where ? data.publicWorks : data.works,
    ),
    workshopWorkRevision: query("workshopWorkRevision", data.workRevisions),
    coloringArtwork: query("coloringArtwork", data.artworks),
    coloringOriginal: query("coloringOriginal", data.originals),
  };
  return { tx: mock as unknown as Prisma.TransactionClient, calls, mock };
}

describe("original coverage snapshot exporter", () => {
  it("uses the exact live public predicates and selects only required metadata", async () => {
    const { tx, calls } = mockTx();
    await exportOriginalCoverageSnapshot(tx, { originalsSchema: "present" });
    assert.equal(calls.length, 8);
    assert.equal(calls[1]!.args.where, publicColoringWhere);
    assert.equal(calls[4]!.args.where, publicWorkshopWorkWhere);
    assert.deepEqual(calls[0]!.args, {
      select: {
        id: true,
        number: true,
        publishedRevisionId: true,
        collection: { select: { slug: true } },
      },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(calls[2]!.args, {
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
    assert.deepEqual(calls[3]!.args, {
      select: {
        id: true,
        publicId: true,
        coloringId: true,
        currentRevisionId: true,
        publishedRevisionId: true,
      },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(calls[5]!.args, {
      select: {
        id: true,
        workId: true,
        coloringId: true,
        officialRevisionId: true,
      },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(calls[6]!.args, {
      select: { coloringId: true, width: true, height: true },
      orderBy: { coloringId: "asc" },
    });
    assert.deepEqual(calls[7]!.args, {
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
    });
    const selections = JSON.stringify(calls.map(({ args }) => args.select));
    for (const forbidden of [
      "owner",
      "caption",
      "email",
      "sourceChecksum",
      "normalizedChecksum",
      "StorageKey",
      "materials",
      "symbolMappings",
      "imageAlt",
    ]) {
      assert.ok(
        !selections.includes(forbidden),
        `No private or unnecessary selection: ${forbidden}`,
      );
    }
    assert.ok(
      calls.every(({ args }) => !args.include && !args.take && !args.skip),
    );
  });

  it("uses the published official revision, preserves every saved work revision and public ID", async () => {
    const { tx } = mockTx();
    const result = await exportOriginalCoverageSnapshot(tx, {
      originalsSchema: "present",
    });
    assert.equal(result.exportReady, true);
    assert.ok(result.snapshot);
    assert.equal(
      result.snapshot.colorings[0]!.legacy.imageChecksum,
      checksum("a"),
    );
    assert.deepEqual(
      result.snapshot.colorings[0]!.legacy.symbolPositions,
      [1, 19],
    );
    assert.deepEqual(result.snapshot.works, [
      {
        id: "wr1",
        coloringId: "c1",
        public: true,
        officialImageChecksum: checksum("a"),
      },
      {
        id: "wr2",
        coloringId: "c1",
        public: false,
        officialImageChecksum: checksum("b"),
      },
    ]);
    assert.deepEqual(result.references, {
      colorings: [
        { id: "c1", collectionSlug: "dogs", number: 1, legacyRevisionId: "r1" },
      ],
      works: [
        { revisionId: "wr1", workId: "w1", publicId: "public1" },
        { revisionId: "wr2", workId: "w1", publicId: "public1" },
      ],
    });
    assert.equal(analyzeOriginalCoverage(result.snapshot).coverageReady, true);
    assert.throws(() => analyzeOriginalCoverage(result), /expected exactly/);
  });

  it("selects the latest persisted official revision for a nonpublic coloring without a publication", async () => {
    const data = fixture();
    data.colorings[0]!.publishedRevisionId = null;
    data.publicColorings = [];
    const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.equal(
      result.snapshot?.colorings[0]!.legacy.imageChecksum,
      checksum("b"),
    );
    assert.equal(result.snapshot?.colorings[0]!.public, false);
    assert.equal(result.references.colorings[0]!.legacyRevisionId, "r2");
  });

  it("honors runtime nonempty description readiness and work predicate independence", async () => {
    const data = fixture();
    data.publicColorings[0]!.description = " \n ";
    const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.equal(result.snapshot?.colorings[0]!.public, false);
    assert.equal(result.snapshot?.works[0]!.public, true);
  });

  it("does not infer publication from stored revision references alone", async () => {
    const data = fixture();
    data.publicColorings = [];
    data.publicWorks = [];
    const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.equal(result.snapshot?.colorings[0]!.public, false);
    assert.ok(result.snapshot?.works.every((row) => !row.public));
  });

  it("handles explicitly verified absent tables without querying them or inventing originals", async () => {
    const { tx, mock, calls } = mockTx();
    mock.coloringArtwork.findMany = async () => {
      throw Error("must not query missing schema");
    };
    mock.coloringOriginal.findMany = async () => {
      throw Error("must not query missing schema");
    };
    const result = await exportOriginalCoverageSnapshot(tx, {
      originalsSchema: "legacy-only",
    });
    assert.equal(calls.length, 6);
    assert.equal(result.exportReady, true);
    assert.equal(result.snapshot?.colorings[0]!.original, null);
    assert.equal(result.diagnostics[0]!.code, "original-schema-absent");
    assert.equal(result.diagnostics[0]!.severity, "warning");
    const coverage = analyzeOriginalCoverage(result.snapshot);
    assert.equal(coverage.coverageReady, false);
    assert.deepEqual(coverage.publicAvailabilityLoss, {
      coloringIds: ["c1"],
      workIds: ["wr1"],
    });
  });

  it("propagates query errors instead of treating them as an absent schema", async () => {
    const { tx, mock } = mockTx();
    const failure = Error("database permission denied");
    mock.coloringOriginal.findMany = async () => {
      throw failure;
    };
    await assert.rejects(
      exportOriginalCoverageSnapshot(tx, { originalsSchema: "present" }),
      (error) => error === failure,
    );
  });

  it("rejects an unspecified or invalid schema mode", async () => {
    await assert.rejects(
      exportOriginalCoverageSnapshot(mockTx().tx, {
        originalsSchema: "auto" as "present",
      }),
      /explicitly verified/,
    );
  });

  it("keeps a coloring with no revisions visible in diagnostics and blocks the snapshot", async () => {
    const data = fixture();
    data.colorings.push({
      id: "c2",
      number: 2,
      publishedRevisionId: null,
      collection: { slug: "dogs" },
    });
    const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.equal(result.exportReady, false);
    assert.equal(result.snapshot, null);
    assert.equal(result.records.colorings.length, 2);
    assert.equal(result.records.colorings[1]!.legacy, null);
    assert.equal(result.references.colorings[1]!.legacyRevisionId, null);
    assert.ok(
      result.diagnostics.some(
        (row) => row.id === "c2" && row.code === "missing-legacy-source",
      ),
    );
  });

  for (const [name, mutate, code] of [
    [
      "dangling published official revision",
      (data: ReturnType<typeof fixture>) => {
        data.colorings[0]!.publishedRevisionId = "missing";
      },
      "dangling-published-revision",
    ],
    [
      "foreign official revision",
      (data: ReturnType<typeof fixture>) => {
        data.officialRevisions[0]!.coloringId = "other";
      },
      "official-revision-coloring-mismatch",
    ],
    [
      "dangling saved official reference",
      (data: ReturnType<typeof fixture>) => {
        data.workRevisions[1]!.officialRevisionId = "missing";
      },
      "invalid-official-revision-reference",
    ],
    [
      "foreign saved work owner",
      (data: ReturnType<typeof fixture>) => {
        data.workRevisions[1]!.workId = "missing";
      },
      "work-revision-owner-mismatch",
    ],
    [
      "dangling work publication",
      (data: ReturnType<typeof fixture>) => {
        data.works[0]!.publishedRevisionId = "missing";
      },
      "invalid-work-revision-reference",
    ],
    [
      "dangling work current revision",
      (data: ReturnType<typeof fixture>) => {
        data.works[0]!.currentRevisionId = "missing";
      },
      "invalid-work-revision-reference",
    ],
    [
      "orphan original",
      (data: ReturnType<typeof fixture>) => {
        data.artworks = [];
      },
      "orphan-original",
    ],
  ] as const) {
    it(`blocks ${name} without dropping known records`, async () => {
      const data = fixture();
      mutate(data);
      const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
        originalsSchema: "present",
      });
      assert.equal(result.snapshot, null);
      assert.equal(result.exportReady, false);
      assert.equal(result.records.works.length, 2);
      assert.equal(result.records.colorings.length, 1);
      assert.ok(result.diagnostics.some((row) => row.code === code));
    });
  }

  it("does not label a draft or undated original as published", async () => {
    for (const field of ["status", "publishedAt"] as const) {
      const data = fixture();
      if (field === "status") data.originals[0]!.status = "DRAFT";
      else data.originals[0]!.publishedAt = null;
      const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
        originalsSchema: "present",
      });
      assert.equal(result.snapshot?.colorings[0]!.original?.published, false);
      assert.equal(
        analyzeOriginalCoverage(result.snapshot).coverageReady,
        false,
      );
    }
  });

  it("blocks malformed image metadata instead of emitting invalid analyzer input", async () => {
    const data = fixture();
    data.originals[0]!.imageChecksum = "not-a-checksum";
    const result = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.equal(result.snapshot, null);
    assert.equal(result.diagnostics[0]!.code, "invalid-source-metadata");
    assert.equal(
      result.records.colorings[0]!.original?.imageChecksum,
      "not-a-checksum",
    );
  });

  it("is deterministic across row, symbol and property order, without mutating source rows", async () => {
    const data = fixture();
    const before = structuredClone(data);
    const first = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.deepEqual(data, before);
    data.officialRevisions.reverse();
    data.workRevisions.reverse();
    data.originals[0]!.colors.reverse();
    data.officialRevisions.forEach((row) => row.paletteColors.reverse());
    data.colorings[0] = Object.fromEntries(
      Object.entries(data.colorings[0]!).reverse(),
    ) as (typeof data.colorings)[number];
    const second = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.deepEqual(second, first);
    data.officialRevisions[1]!.version = 7;
    const changed = await exportOriginalCoverageSnapshot(mockTx(data).tx, {
      originalsSchema: "present",
    });
    assert.notEqual(changed.sourceFingerprint, first.sourceFingerprint);
    assert.match(first.sourceFingerprint, /^[a-f0-9]{64}$/);
  });
});
