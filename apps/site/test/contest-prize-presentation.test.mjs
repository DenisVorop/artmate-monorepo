import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
async function loadComponent(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => dependencies[name] ?? require(name),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const prizeComponents = await loadComponent(
  "../../../packages/ui/src/contest-prizes.tsx",
);
const { ContestPrizeList, contestAwardLabel } = prizeComponents;

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
  assert.doesNotMatch(html, /1 победитель/);
  assert.match(html, /За участие/);
});

test("grouped places show capacities and can display distinct promo-only prizes", () => {
  const html = renderToStaticMarkup(
    React.createElement(ContestPrizeList, {
      prizes: {
        mode: "places",
        winners: [
          { place: 1, winnersCount: 1, title: "Маркеры" },
          { place: 2, winnersCount: 3, title: "Альбом на выбор" },
          { place: 3, winnersCount: 3, title: "Новый альбом Artmate" },
          { place: 4, winnersCount: 3, title: "Промокод на скидку 20%" },
          { place: 5, winnersCount: 10, title: "Промокод на скидку 15%" },
        ],
      },
    }),
  );
  const items = html.match(/<li\b.*?<\/li>/g) ?? [];
  assert.equal(items.length, 5);
  assert.match(items[0], /1-е место · 1 победитель/);
  assert.match(items[1], /2-е место · 3 победителя/);
  assert.match(items[2], /3-е место · 3 победителя/);
  assert.match(items[3], /4-е место · 3 победителя.*Промокод на скидку 20%/);
  assert.match(items[4], /5-е место · 10 победителей.*Промокод на скидку 15%/);
});

test("public results keep every winner with their shared place and prize", async () => {
  const { ContestResults } = await loadComponent(
    "../src/features/contests/ui/results.tsx",
    {
      "next/image": { default: () => null },
      "@repo/ui/contest-prizes": prizeComponents,
      "@/shared/ui": { Button: "button", Card: "div" },
      "@/shared/ui/typography": { SectionTitle: "h2" },
      "../lib/format-date": { formatContestDate: () => "Дата итогов" },
    },
  );
  const winners = [3, 2, 2, 1, 3, 2, 3].map((place, index) => ({
    id: `winner-${index + 1}`,
    place,
    prizeTitle: place === 3 ? "Новый альбом Artmate" : "Приз",
    work: { author: `Участник ${index + 1}`, albumTitle: "Альбом" },
  }));
  const html = renderToStaticMarkup(
    React.createElement(ContestResults, {
      contest: {
        prizePresentation: { mode: "places" },
        draw: { mode: "MANUAL", winners },
      },
      onOpenWork: () => {},
    }),
  );
  const places = [...html.matchAll(/(\d+)-е место/g)].map((match) => match[1]);
  assert.deepEqual(places, ["1", "2", "2", "2", "3", "3", "3"]);
  const shownAuthors = [...html.matchAll(/>(Участник \d+)<\/h3>/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(shownAuthors).size, 7);
  assert.equal((html.match(/Новый альбом Artmate/g) ?? []).length, 3);
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
