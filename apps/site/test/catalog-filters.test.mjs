import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/catalog/lib/catalog-state.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)(
  (id) =>
    id === "@/shared/constants"
      ? {
          routes: {
            catalog: "/catalog",
            catalogColorings: "/catalog/raskraski",
            catalogMarkers: "/catalog/markery",
          },
        }
      : require(id),
  mod,
  mod.exports,
);
const {
  getCatalogSearchResult,
  getCatalogFacets,
  readCatalogFilters,
  getCatalogParams,
  getCatalogHrefWithFilters,
  getCatalogCategories,
  formatCount,
} = mod.exports;
const tag = (slug, group = "theme") => ({ id: slug, slug, title: slug, group });
const make = (id, extra) => ({
  id,
  slug: id,
  title: id,
  categoryId: "books",
  category: "Раскраски",
  price: 800,
  createdAt: "2026-09-01",
  isHit: false,
  isOutOfStock: false,
  description: "",
  characteristics: [],
  tags: [tag("po-nomeram", "format")],
  ...extra,
});
const products = [
  make("flowers", {
    title: "Лёгкие цветы",
    description: "Раскрашивайте маркерами",
    characteristics: [{ name: "Чем раскрашивать", value: "Маркеры, карандаши" }],
    tags: [tag("flowers"), tag("easy", "difficulty"), tag("po-nomeram", "format")],
    createdAt: "2026-09-03",
  }),
  make("cats", {
    title: "Кошки",
    price: 1000,
    tags: [tag("animals"), tag("easy", "difficulty"), tag("pikselnye", "format")],
    isHit: true,
  }),
  make("japan", {
    title: "Япония",
    price: 700,
    categoryId: undefined,
    category: undefined,
    tags: [tag("travel"), tag("detailed", "difficulty"), tag("po-nomeram", "format")],
    isOutOfStock: true,
  }),
  make("markers", {
    title: "Маркеры",
    categoryId: "markers",
    categorySlug: "markery",
    category: "Маркеры",
    price: 2000,
    createdAt: "2026-09-04",
    characteristics: [{ name: "Количество цветов", value: "168" }],
    tags: [],
  }),
];
const defaults = {
  category: undefined,
  query: "",
  onlyBestsellers: false,
  onlyAvailable: false,
  tagSlugs: [],
  sortBy: "featured",
};
const ids = (filters) =>
  getCatalogSearchResult(products, { ...defaults, ...filters }).products.map((p) => p.id);

test("categories group coloring books across source categories and include unassigned books", () => {
  assert.deepEqual(
    getCatalogCategories([...products, make("unknown", { tags: [], categoryId: undefined })]),
    [
      { id: "colorings", title: "Раскраски", count: 3 },
      { id: "markers", title: "Маркеры", count: 1 },
    ],
  );
  assert.deepEqual(ids({ category: "colorings" }), ["flowers", "cats", "japan"]);
  assert.deepEqual(ids({ category: "markers" }), ["markers"]);
  assert.deepEqual(ids({ categoryId: "books" }), ["flowers", "cats"]);
});
test("combines price, stock, category and hits without excluding boundary prices", () => {
  assert.deepEqual(
    ids({ category: "colorings", minPrice: 800, maxPrice: 1000, onlyAvailable: true }),
    ["flowers", "cats"],
  );
  assert.deepEqual(ids({ maxPrice: 1000, onlyBestsellers: true }), ["cats"]);
  assert.deepEqual(ids({ minPrice: 0, maxPrice: 0 }), []);
});
test("format selections use OR and combine with availability and price", () => {
  assert.deepEqual(ids({ tagSlugs: ["po-nomeram", "pikselnye"] }), ["flowers", "cats", "japan"]);
  assert.deepEqual(ids({ tagSlugs: ["po-nomeram", "pikselnye"], onlyAvailable: true }), [
    "flowers",
    "cats",
  ]);
  assert.deepEqual(ids({ tagSlugs: ["pikselnye"], maxPrice: 900 }), []);
});
test("search normalizes Russian text and finds category and actual characteristics", () => {
  assert.deepEqual(ids({ query: "  ЛЕГКИЕ   цветы " }), ["flowers"]);
  assert.deepEqual(ids({ query: "168" }), ["markers"]);
  assert.deepEqual(ids({ query: "материалы", categoryId: "books" }), []);
  assert.ok(
    getCatalogSearchResult(products, { ...defaults, query: "кошк" }).products.some(
      (p) => p.id === "cats",
    ),
  );
});
test("search prioritizes product identity over compatible materials in characteristics", () => {
  assert.deepEqual(ids({ query: "маркеры" }), ["markers"]);
  assert.deepEqual(ids({ query: "карандаши" }), ["flowers"]);
  assert.deepEqual(ids({ query: "168 маркеры" }), ["markers"]);
  assert.deepEqual(ids({ query: "раскрашивайте" }), []);
});
test("only format facets remain, and counts keep alternatives from their own group", () => {
  const facets = getCatalogFacets(products, {
    ...defaults,
    category: "colorings",
    tagSlugs: ["po-nomeram"],
    onlyAvailable: true,
  });
  assert.deepEqual(
    facets.map((facet) => facet.group),
    ["format"],
  );
  assert.equal(facets[0].options.find((t) => t.slug === "po-nomeram").count, 1);
  assert.equal(facets[0].options.find((t) => t.slug === "pikselnye").count, 1);
  assert.deepEqual(getCatalogFacets(products, { ...defaults, category: "markers" }), []);
});
test("newest sort uses dates rather than response order", () => {
  assert.deepEqual(ids({ sortBy: "newest" }), ["markers", "flowers", "cats", "japan"]);
  assert.deepEqual(ids({ sortBy: "price-asc" }), ["japan", "flowers", "cats", "markers"]);
});
test("URL round trip preserves filters, zero price and unrelated parameters; invalid input is ignored", () => {
  const filters = {
    ...defaults,
    category: "colorings",
    query: "кошки и цветы",
    minPrice: 0,
    maxPrice: 1000,
    onlyAvailable: true,
    tagSlugs: ["po-nomeram", "pikselnye"],
    sortBy: "price-desc",
  };
  const params = getCatalogParams(filters);
  assert.deepEqual(readCatalogFilters(params, products), {
    ...filters,
    tagSlugs: ["pikselnye", "po-nomeram"],
  });
  const href = getCatalogHrefWithFilters(filters, {
    utm_source: "example",
    tags: "travel",
  });
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, "/catalog/raskraski");
  assert.equal(url.searchParams.get("category"), null);
  assert.equal(url.searchParams.get("utm_source"), "example");
  assert.equal(url.searchParams.get("tags"), "pikselnye,po-nomeram");
  assert.equal(url.searchParams.get("min"), "0");
  assert.deepEqual(
    readCatalogFilters(
      {
        category: "unknown",
        min: "-1",
        max: "Infinity",
        tags: "unknown,easy,flowers,po-nomeram,po-nomeram",
        sort: "wrong",
      },
      products,
    ),
    { ...defaults, tagSlugs: ["po-nomeram"], minPrice: undefined, maxPrice: undefined },
  );
});
test("counts describe different product types", () => {
  assert.deepEqual([0, 1, 2, 5, 11, 21].map(formatCount), [
    "0 товаров",
    "1 товар",
    "2 товара",
    "5 товаров",
    "11 товаров",
    "21 товар",
  ]);
});
