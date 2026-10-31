import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/community-gallery/lib/mosaic-layout.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { getMosaicBlocks } = mod.exports;

test("mosaic covers every cell without holes or overlaps for any gallery length", () => {
  for (let count = 0; count <= 180; count++) {
    const works = Array.from({ length: count }, (_, index) => ({ publicId: String(index) }));
    const blocks = getMosaicBlocks(works);
    assert.deepEqual(
      blocks.flatMap((block) => block.items),
      works,
    );
    for (const block of blocks) {
      for (const layout of [block.wide, block.narrow]) {
        const columns = layout.columns.split(" ").length;
        assert.ok(
          layout.columns.split(" ").every((track) => Number.parseFloat(track) >= 1),
          "Fractional tracks must fill the entire available width",
        );
        const occupied = Array.from({ length: columns }, () => Array(12).fill(false));
        assert.ok(Number.isFinite(layout.ratio) && layout.ratio > 0);
        assert.equal(layout.positions.length, block.items.length);
        for (const position of layout.positions) {
          const [, start, span] = /^(\d+) \/ span (\d+)$/.exec(position.row);
          assert.ok(Number(start) >= 1 && Number(start) + Number(span) <= 13);
          const column = occupied[position.column - 1];
          for (let row = Number(start) - 1; row < Number(start) - 1 + Number(span); row++) {
            assert.equal(column[row], false, `Overlap in a gallery of ${count} works`);
            column[row] = true;
          }
        }
        assert.ok(
          occupied.every((column) => column.every(Boolean)),
          `Hole in a gallery of ${count} works`,
        );
      }
    }
  }
});

test("mosaic positions are stable for the same publications", () => {
  const works = Array.from({ length: 46 }, (_, index) => ({ publicId: `work-${index}` }));
  assert.deepEqual(getMosaicBlocks(works), getMosaicBlocks(works));
  assert.ok(
    getMosaicBlocks(works).some(
      (block) => new Set(block.wide.positions.map((tile) => tile.row)).size > 1,
    ),
  );
});
