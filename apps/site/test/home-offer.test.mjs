import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/home-offer/lib/has-album-offer.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { hasAlbumOffer } = mod.exports;
const album = (overrides = {}) => ({
  price: 700,
  originalPrice: 799,
  tags: [{ group: "format", slug: "po-nomeram" }],
  ...overrides,
});

test("shows the current 12% offer for numbered and pixel albums, excluding markers", () => {
  assert.equal(
    hasAlbumOffer(
      [
        album(),
        album({ tags: [{ group: "format", slug: "pikselnye" }] }),
        { price: 5200, originalPrice: 5399, tags: [] },
      ],
      12,
    ),
    true,
  );
});

test("hides the offer when any album has a different discount or no sale price", () => {
  for (const other of [
    album({ price: 799 }),
    album({ price: 600 }),
    album({ originalPrice: undefined }),
  ]) {
    assert.equal(hasAlbumOffer([album(), other], 12), false);
  }
});

test("does not advertise an offer for an empty catalogue, markers alone or invalid prices", () => {
  assert.equal(hasAlbumOffer([], 12), false);
  assert.equal(hasAlbumOffer([{ price: 700, originalPrice: 799, tags: [] }], 12), false);
  for (const overrides of [
    { price: NaN },
    { price: Infinity },
    { price: -1 },
    { originalPrice: Infinity },
    { originalPrice: 0 },
  ]) {
    assert.equal(hasAlbumOffer([album(overrides)], 12), false);
  }
});
