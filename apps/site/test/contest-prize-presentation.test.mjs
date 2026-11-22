import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const source = await readFile(
  new URL("../../../packages/ui/src/contest-prizes.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(require, loaded, loaded.exports);
const { ContestPrizeList, contestAwardLabel } = loaded.exports;

test("places retain their assigned order and participation has a label", () => {
  const html = renderToStaticMarkup(
    React.createElement(ContestPrizeList, {
      prizes: {
        mode: "places",
        winners: [
          { place: 3, title: "Третий приз" },
          { place: 1, title: "Первый приз" },
        ],
        participation: { title: "Промокод 10%" },
      },
    }),
  );
  assert.ok(html.indexOf("Первый приз") < html.indexOf("Третий приз"));
  assert.match(html, /3-е место/);
  assert.doesNotMatch(html, /2-е место/);
  assert.match(html, /За участие/);
});
test("equal winners get no invented places and award labels distinguish participation", () => {
  const html = renderToStaticMarkup(
    React.createElement(ContestPrizeList, {
      prizes: {
        mode: "equal",
        winners: [{ title: "Альбом" }],
        participation: { title: "Промокод" },
      },
    }),
  );
  assert.doesNotMatch(html, /-е место/);
  assert.match(html, /За участие/);
  assert.equal(contestAwardLabel({ kind: "participation" }), "За участие");
  assert.equal(contestAwardLabel({ kind: "place", place: 2 }), "2-е место");
  assert.equal(contestAwardLabel(), null);
});
