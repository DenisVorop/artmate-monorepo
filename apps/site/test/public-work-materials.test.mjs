import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/entities/community-work/ui/materials.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)(require, mod, mod.exports);
const { CommunityWorkMaterials } = mod.exports;
const material = { position: 1, type: "CUSTOM", brand: "Copic", line: "Sketch" };
const mapping = { symbol: "1", markerNumber: "023", materialPosition: 1 };
const makeWork = (materials, symbolMappings) => ({
  official: {
    palette: {
      label: "Artmate",
      version: "1",
      colors: [{ symbol: "1", markerNumber: "611", hex: "#302122" }],
    },
  },
  submission: { materials, symbolMappings },
});
const render = (materials, mappings) =>
  renderToStaticMarkup(
    React.createElement(CommunityWorkMaterials, { work: makeWork(materials, mappings) }),
  );

test("photo-only work renders no materials, mappings or official palette", () => {
  assert.equal(CommunityWorkMaterials({ work: makeWork([], []) }), null);
  assert.equal(render([], []), "");
});

test("materials alone show only the author's materials", () => {
  const markup = render([material], []);
  assert.match(markup, /Материалы, указанные автором/);
  assert.match(markup, /Copic.*Sketch/);
  assert.doesNotMatch(markup, /Соответствие символов|Палитра|611|Автор не указал/);
});

test("mappings alone show no empty materials block or official palette", () => {
  const markup = render([], [mapping]);
  assert.match(markup, /Соответствие символов/);
  assert.match(markup, /023/);
  assert.doesNotMatch(markup, /Материалы, указанные автором|Палитра|611|Автор не указал/);
});

test("provided materials and mappings retain the author's marker association", () => {
  const markup = render([material], [mapping]);
  assert.match(markup, /Материалы, указанные автором/);
  assert.match(markup, /Соответствие символов/);
  assert.match(markup, /023/);
  assert.equal((markup.match(/Copic/g) ?? []).length, 2);
  assert.doesNotMatch(markup, /Палитра|611|#302122/);
});
