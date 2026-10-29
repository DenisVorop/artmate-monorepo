import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/home-products/lib/select-products.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("exports", output)(mod.exports);
const { selectHomeProducts } = mod.exports;
const album = (id, createdAt, isHit = false) => ({
  id,
  createdAt,
  isHit,
  tags: [{ group: "format", slug: "po-nomeram" }],
});

test("home shelf excludes markers, keeps hits first, then chooses recent albums without duplicates", () => {
  const products = [
    album("older", "2026-01-01"),
    { id: "markers", isHit: true, tags: [], createdAt: "2026-10-25" },
    album("new", "2026-10-20"),
    album("hit", "2026-05-01", true),
    album("pixel", "2026-10-21"),
  ];
  products[4].tags[0].slug = "pikselnye";
  const before = structuredClone(products);
  assert.deepEqual(
    selectHomeProducts(products).map((x) => x.id),
    ["hit", "pixel", "new", "older"],
  );
  assert.deepEqual(products, before);
});

test("home shelf is bounded to eight albums and handles an empty catalog", () => {
  assert.deepEqual(selectHomeProducts([]), []);
  const products = Array.from({ length: 12 }, (_, index) =>
    album(String(index), `2026-10-${String(index + 1).padStart(2, "0")}`, index < 4),
  );
  assert.deepEqual(
    selectHomeProducts(products).map((x) => x.id),
    ["0", "1", "2", "3", "11", "10", "9", "8"],
  );
});
