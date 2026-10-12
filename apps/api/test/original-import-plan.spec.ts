import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  contourDistance,
  matchOriginalContours,
  verifySourcePalette,
} from "../src/colorings/prepare-original-import";
import {
  planHash,
  readBundleFile,
  sha256,
  validateOriginalImportPlan,
  type OriginalImportPlan,
} from "../src/colorings/original-import-plan";

function fixture(): OriginalImportPlan {
  const asset = {
    file: "picture/file.webp",
    checksum: "a".repeat(64),
    sourceChecksum: "b".repeat(64),
    sourceMime: "image/png" as const,
    byteSize: 200,
    width: 300,
    height: 420,
  };
  const body: Omit<OriginalImportPlan, "planHash"> = {
    schemaVersion: 1,
    derivativeProfile: "webp-preview-v3",
    sourceManifestChecksum: "c".repeat(64),
    entries: [
      {
        coloringId: "coloring1",
        collectionSlug: "flowers",
        number: 1,
        title: "Цветы",
        publishedRevisionId: "revision1",
        legacyOutlineChecksum: "d".repeat(64),
        legacyPaletteHash: "e".repeat(64),
        outlineAlt: "Контур цветов",
        imageAlt: "Цветы",
        sourceKey: "flowers:source1",
        match: { distance: 0.01, runnerUp: 0.15 },
        colors: [{ symbolPosition: 1, hex: "#112233" }],
        assets: {
          outline: asset,
          colored: { ...asset, checksum: "f".repeat(64) },
          card: { ...asset, width: 100, height: 140 },
        },
      },
    ],
  };
  return { ...body, planHash: planHash(body) };
}
function rehash(plan: OriginalImportPlan) {
  const { planHash: previousHash, ...body } = plan;
  assert.equal(typeof previousHash, "string");
  plan.planHash = planHash(body);
  return plan;
}

describe("original import plan", () => {
  it("accepts a complete content-addressed plan", () =>
    assert.doesNotThrow(() => validateOriginalImportPlan(fixture())));
  it("rejects mutation of a checked source, identity or palette", () => {
    for (const mutate of [
      (p: OriginalImportPlan) => p.entries[0]!.number++,
      (p: OriginalImportPlan) => (p.entries[0]!.colors[0]!.hex = "#445566"),
      (p: OriginalImportPlan) =>
        (p.entries[0]!.assets.colored.checksum = "0".repeat(64)),
    ]) {
      const plan = fixture();
      mutate(plan);
      assert.throws(() => validateOriginalImportPlan(plan), /hash mismatch/);
    }
  });
  it("rejects duplicate identities even when the plan is rehashed", () => {
    const plan = fixture();
    plan.entries.push(structuredClone(plan.entries[0]!));
    assert.throws(() => validateOriginalImportPlan(rehash(plan)), /Duplicate/);
  });
  it("rejects impossible palettes and mismatched image pairs", () => {
    const plan = fixture();
    plan.entries[0]!.colors.push({ symbolPosition: 1, hex: "#334455" });
    assert.throws(() => validateOriginalImportPlan(rehash(plan)), /palette/);
    const geometry = fixture();
    geometry.entries[0]!.assets.colored.width++;
    assert.throws(
      () => validateOriginalImportPlan(rehash(geometry)),
      /image pair/,
    );
  });
  it("rejects weak visual identity evidence", () => {
    const plan = fixture();
    plan.entries[0]!.match = { distance: 0.03, runnerUp: 0.04 };
    assert.throws(() => validateOriginalImportPlan(rehash(plan)), /Ambiguous/);
  });
});
describe("contour identity matching", () => {
  it("maps shuffled sources by image evidence instead of filenames", () => {
    const references = [
      Buffer.from([255, 0, 255, 0]),
      Buffer.from([0, 255, 0, 255]),
    ];
    assert.deepEqual(
      matchOriginalContours([references[1]!, references[0]!], references).map(
        (m) => m.index,
      ),
      [1, 0],
    );
    assert.equal(contourDistance(references[0]!, references[0]!), 0);
  });
  it("blocks ambiguous, weak and non-bijective image matching", () => {
    const a = Buffer.from([0, 255, 0, 255]);
    const b = Buffer.from([255, 0, 255, 0]);
    assert.throws(() => matchOriginalContours([a, b], [a, a]), /ambiguous/);
    assert.throws(() => matchOriginalContours([a, a], [a, b]), /ambiguous/);
    assert.throws(
      () =>
        matchOriginalContours([Buffer.from([128, 128, 128, 128]), b], [a, b]),
      /ambiguous/,
    );
    assert.throws(() => matchOriginalContours([a], [a, b]), /coverage/);
  });
});
describe("import file boundaries", () => {
  it("checks content checksums and blocks traversal or symlinked files", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "artmate-original-import-files-"),
    );
    try {
      await mkdir(join(root, "picture"));
      const bytes = Buffer.from("verified derivative");
      await writeFile(join(root, "picture/image.webp"), bytes);
      assert.deepEqual(
        await readBundleFile(root, "picture/image.webp", sha256(bytes)),
        bytes,
      );
      await assert.rejects(
        () => readBundleFile(root, "picture/image.webp", "0".repeat(64)),
        /checksum/,
      );
      await assert.rejects(
        () => readBundleFile(root, "../elsewhere", sha256(bytes)),
        /Unsafe/,
      );
      await symlink(
        join(root, "picture/image.webp"),
        join(root, "picture/linked.webp"),
      );
      await assert.rejects(
        () => readBundleFile(root, "picture/linked.webp", sha256(bytes)),
        /linked/,
      );
      await symlink(join(root, "picture"), join(root, "linked-folder"));
      await assert.rejects(
        () => readBundleFile(root, "linked-folder/image.webp", sha256(bytes)),
        /linked/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("original palette evidence", () => {
  it("accepts original black and exact SVG/PNG swatches, blocks shifted or altered colors", async () => {
    const width = 613;
    const height = 859;
    const pixels = Buffer.alloc(width * height * 3, 255);
    const colors = [
      { symbolPosition: 1, hex: "#000000" },
      { symbolPosition: 2, hex: "#112233" },
    ];
    for (const [index, color] of colors.entries()) {
      const offset = (800 * width + 40 + 26 * index) * 3;
      Buffer.from(color.hex.slice(1), "hex").copy(pixels, offset);
    }
    const png = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    await verifySourcePalette(png, colors);
    await assert.rejects(
      () => verifySourcePalette(png, [{ symbolPosition: 1, hex: "#112233" }]),
      /SVG and PNG palette disagree/,
    );
    await assert.rejects(
      () => verifySourcePalette(png, [{ symbolPosition: 2, hex: "#000000" }]),
      /Invalid source palette/,
    );
  });
});
