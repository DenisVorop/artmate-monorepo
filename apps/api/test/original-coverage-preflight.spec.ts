import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeOriginalCoverage,
  type OriginalCoverageSnapshot,
} from "../src/colorings/original-coverage-preflight";

const originalChecksum = "a".repeat(64);
const legacyChecksum = "b".repeat(64);
const cardChecksum = "c".repeat(64);

function fixture(): OriginalCoverageSnapshot {
  return {
    version: 1,
    sourceFingerprint: "d".repeat(64),
    colorings: [
      {
        id: "coloring-1",
        public: true,
        original: {
          published: true,
          imageChecksum: originalChecksum,
          cardChecksum,
          width: 100,
          height: 200,
          symbolPositions: [1, 2, 19],
        },
        legacy: {
          imageChecksum: legacyChecksum,
          width: 100,
          height: 200,
          symbolPositions: [1, 2, 19],
        },
      },
    ],
    works: [
      {
        id: "work-1",
        coloringId: "coloring-1",
        public: true,
        officialImageChecksum: legacyChecksum,
      },
    ],
  };
}

function originalOf(snapshot: OriginalCoverageSnapshot) {
  const original = snapshot.colorings[0]!.original;
  assert.ok(original);
  return original;
}

describe("original coverage preflight", () => {
  it("reports only coverage readiness and the remaining checks", () => {
    const report = analyzeOriginalCoverage(fixture());
    assert.equal(report.coverageReady, true);
    assert.equal(report.scope, "original-coverage-only");
    assert.equal(report.sourceFingerprint, "d".repeat(64));
    assert.match(report.fingerprint, /^[a-f0-9]{64}$/);
    assert.deepEqual(report.policy, {
      catalog: "original",
      workshop: "original",
      digitalDefault: "artmate-168",
    });
    assert.deepEqual(report.requiredChecks, [
      "file-verification",
      "palette-catalog-mapping",
      "sql-dependencies",
      "user-data-invariants",
      "public-eligibility-parity",
    ]);
    assert.deepEqual(report.issues, []);
    assert.deepEqual(report.publicAvailabilityLoss, {
      coloringIds: [],
      workIds: [],
    });
    assert.equal("canApply" in report, false);
    assert.equal("canSwitch" in report, false);
    assert.equal(report.colorings[0]!.originalCardChecksum, cardChecksum);
  });

  it("blocks missing originals and lists affected public objects without a fallback", () => {
    const snapshot = fixture();
    snapshot.colorings[0]!.original = null;
    const report = analyzeOriginalCoverage(snapshot);
    assert.equal(report.coverageReady, false);
    assert.deepEqual(report.issues, [
      { entity: "coloring", id: "coloring-1", code: "missing-original" },
    ]);
    assert.deepEqual(report.publicAvailabilityLoss, {
      coloringIds: ["coloring-1"],
      workIds: ["work-1"],
    });
    assert.equal(report.colorings[0]!.originalImageChecksum, null);
    assert.equal(report.works[0]!.comparisonTarget, null);
    assert.equal(report.works[0]!.comparisonChanged, null);
  });

  it("keeps private deficiencies visible without hiding unrelated public objects or promoting private ones", () => {
    const snapshot = fixture();
    snapshot.colorings.push({
      ...snapshot.colorings[0]!,
      id: "private-coloring",
      public: false,
      original: null,
    });
    snapshot.works.push({
      ...snapshot.works[0]!,
      id: "private-work",
      coloringId: "private-coloring",
      public: false,
    });
    const report = analyzeOriginalCoverage(snapshot);
    assert.equal(report.coverageReady, false);
    assert.deepEqual(report.publicAvailabilityLoss, {
      coloringIds: [],
      workIds: [],
    });
    assert.equal(report.colorings[0]!.coverageReady, true);
    assert.equal(report.colorings[1]!.public, false);
    assert.equal(
      report.works.find((work) => work.id === "private-work")!.public,
      false,
    );
    assert.deepEqual(report.issues, [
      { entity: "coloring", id: "private-coloring", code: "missing-original" },
    ]);
  });

  it("does not infer work visibility from coloring visibility", () => {
    const snapshot = fixture();
    snapshot.colorings[0]!.public = false;
    snapshot.colorings[0]!.original = null;
    assert.deepEqual(analyzeOriginalCoverage(snapshot).publicAvailabilityLoss, {
      coloringIds: [],
      workIds: ["work-1"],
    });
  });

  it("reports unpublished originals and all geometry/symbol conflicts together", () => {
    const snapshot = fixture();
    Object.assign(originalOf(snapshot), {
      published: false,
      width: 101,
      symbolPositions: [1, 3, 19],
    });
    const report = analyzeOriginalCoverage(snapshot);
    assert.deepEqual(
      report.issues.map((issue) => issue.code),
      ["geometry-conflict", "symbol-conflict", "unpublished-original"],
    );
    assert.equal(report.coverageReady, false);
    assert.equal(report.works[0]!.comparisonTarget, null);
    assert.deepEqual(report.publicAvailabilityLoss, {
      coloringIds: ["coloring-1"],
      workIds: ["work-1"],
    });
  });

  it("reports a missing coloring reference as a blocker", () => {
    const snapshot = fixture();
    snapshot.works[0]!.coloringId = "absent";
    const report = analyzeOriginalCoverage(snapshot);
    assert.equal(report.coverageReady, false);
    assert.deepEqual(report.issues, [
      { entity: "work", id: "work-1", code: "missing-coloring" },
    ]);
    assert.deepEqual(report.publicAvailabilityLoss, {
      coloringIds: [],
      workIds: ["work-1"],
    });
  });

  it("maps changed and unchanged comparisons to the current original", () => {
    const snapshot = fixture();
    snapshot.works.push({
      ...snapshot.works[0]!,
      id: "work-2",
      officialImageChecksum: originalChecksum.toUpperCase(),
    });
    const report = analyzeOriginalCoverage(snapshot);
    assert.deepEqual(
      report.works.map((work) => work.comparisonTarget),
      [
        { kind: "original", imageChecksum: originalChecksum },
        { kind: "original", imageChecksum: originalChecksum },
      ],
    );
    assert.deepEqual(
      report.works.map((work) => work.comparisonChanged),
      [true, false],
    );
  });

  it("does not infer lack of authenticity from equal legacy and original checksums", () => {
    const snapshot = fixture();
    originalOf(snapshot).imageChecksum = legacyChecksum;
    const report = analyzeOriginalCoverage(snapshot);
    assert.equal(report.coverageReady, true);
    assert.equal(report.works[0]!.comparisonChanged, false);
  });

  it("does not mutate input and returns no references into the snapshot", () => {
    const snapshot = fixture();
    originalOf(snapshot).symbolPositions.reverse();
    const before = structuredClone(snapshot);
    function freeze(value: object) {
      Object.values(value).forEach((child: unknown) => {
        if (child !== null && typeof child === "object") freeze(child);
      });
      Object.freeze(value);
    }
    freeze(snapshot);
    const report = analyzeOriginalCoverage(snapshot);
    report.colorings[0]!.id = "changed";
    assert.deepEqual(snapshot, before);
  });

  it("produces byte-identical reports across object, record and symbol permutations", () => {
    const snapshot = fixture();
    snapshot.colorings.push({
      ...structuredClone(snapshot.colorings[0]!),
      id: "coloring-2",
      original: null,
    });
    snapshot.works.push({
      ...snapshot.works[0]!,
      id: "work-2",
      coloringId: "coloring-2",
    });
    const permuted = structuredClone(snapshot);
    permuted.colorings.reverse();
    permuted.works.reverse();
    for (const coloring of permuted.colorings) {
      coloring.legacy.symbolPositions.reverse();
      coloring.original?.symbolPositions.reverse();
    }
    function reorder(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reorder);
      if (value !== null && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, child]) => [key, reorder(child)]),
        );
      }
      return value;
    }
    assert.equal(
      JSON.stringify(analyzeOriginalCoverage(snapshot)),
      JSON.stringify(analyzeOriginalCoverage(reorder(permuted))),
    );
  });

  it("binds the fingerprint to input fields even when they do not change coverage", () => {
    const snapshot = fixture();
    const first = analyzeOriginalCoverage(snapshot).fingerprint;
    snapshot.colorings[0]!.legacy.imageChecksum = "e".repeat(64);
    const second = analyzeOriginalCoverage(snapshot).fingerprint;
    assert.notEqual(first, second);
    snapshot.sourceFingerprint = "f".repeat(64);
    assert.notEqual(second, analyzeOriginalCoverage(snapshot).fingerprint);
  });

  it("accepts explicitly empty collections without claiming migration readiness", () => {
    const report = analyzeOriginalCoverage({
      version: 1,
      sourceFingerprint: "a".repeat(64),
      colorings: [],
      works: [],
    });
    assert.equal(report.coverageReady, true);
    assert.equal(report.requiredChecks.length, 5);
  });

  for (const [name, transform] of [
    [
      "unversioned",
      (input: Record<string, unknown>) => {
        delete input.version;
      },
    ],
    [
      "unknown version",
      (input: Record<string, unknown>) => {
        input.version = 2;
      },
    ],
    [
      "malformed fingerprint",
      (input: Record<string, unknown>) => {
        input.sourceFingerprint = "not-a-hash";
      },
    ],
    [
      "omitted colorings",
      (input: Record<string, unknown>) => {
        delete input.colorings;
      },
    ],
    [
      "null works",
      (input: Record<string, unknown>) => {
        input.works = null;
      },
    ],
    [
      "omitted works",
      (input: Record<string, unknown>) => {
        delete input.works;
      },
    ],
    [
      "unknown root field",
      (input: Record<string, unknown>) => {
        input.apply = true;
      },
    ],
  ] as const) {
    it(`rejects ${name}`, () => {
      const snapshot = fixture() as unknown as Record<string, unknown>;
      transform(snapshot);
      assert.throws(() => analyzeOriginalCoverage(snapshot), TypeError);
    });
  }

  for (const invalidInput of [undefined, null, [], "", {}, new Date()]) {
    it(`rejects invalid root ${String(invalidInput)}`, () => {
      assert.throws(() => analyzeOriginalCoverage(invalidInput), TypeError);
    });
  }

  for (const collection of ["colorings", "works"] as const) {
    it(`rejects duplicate ${collection} IDs`, () => {
      const snapshot = fixture();
      snapshot[collection].push(snapshot[collection][0]! as never);
      assert.throws(() => analyzeOriginalCoverage(snapshot), /duplicate IDs/);
    });
  }

  for (const [field, value] of [
    ["published", "true"],
    ["imageChecksum", "bad"],
    ["cardChecksum", null],
    ["width", 0],
    ["height", -1],
    ["width", 1.5],
    ["width", Infinity],
    ["symbolPositions", []],
    ["symbolPositions", [1, 1]],
    ["symbolPositions", [0]],
    ["symbolPositions", [20]],
    ["symbolPositions", [1.5]],
    ["symbolPositions", ["1"]],
    ["unknown", true],
  ] as const) {
    it(`rejects invalid original ${field}=${JSON.stringify(value)}`, () => {
      const snapshot = fixture();
      Object.assign(originalOf(snapshot), { [field]: value });
      assert.throws(() => analyzeOriginalCoverage(snapshot), TypeError);
    });
  }

  it("requires every original field", () => {
    for (const field of Object.keys(originalOf(fixture()))) {
      const snapshot = fixture();
      delete (originalOf(snapshot) as unknown as Record<string, unknown>)[
        field
      ];
      assert.throws(() => analyzeOriginalCoverage(snapshot), TypeError);
    }
  });

  it("rejects malformed coloring, work and legacy fields", () => {
    for (const mutate of [
      (s: OriginalCoverageSnapshot) => {
        Object.assign(s.colorings[0]!, { public: 1 });
      },
      (s: OriginalCoverageSnapshot) => {
        Object.assign(s.colorings[0]!, { unknown: true });
      },
      (s: OriginalCoverageSnapshot) => {
        s.colorings[0]!.id = " ";
      },
      (s: OriginalCoverageSnapshot) => {
        Object.assign(s.colorings[0]!.legacy, { extra: true });
      },
      (s: OriginalCoverageSnapshot) => {
        s.colorings[0]!.legacy.imageChecksum = "bad";
      },
      (s: OriginalCoverageSnapshot) => {
        Object.assign(s.works[0]!, { public: "false" });
      },
      (s: OriginalCoverageSnapshot) => {
        Object.assign(s.works[0]!, { extra: true });
      },
      (s: OriginalCoverageSnapshot) => {
        s.works[0]!.coloringId = "";
      },
      (s: OriginalCoverageSnapshot) => {
        s.works[0]!.officialImageChecksum = "bad";
      },
    ]) {
      const snapshot = fixture();
      mutate(snapshot);
      assert.throws(() => analyzeOriginalCoverage(snapshot), TypeError);
    }
  });
});
