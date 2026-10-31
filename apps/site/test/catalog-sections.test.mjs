import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL("../src/" + path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const { routes } = await load("shared/constants/routes.ts");
const state = await load("features/catalog/lib/catalog-state.ts", {
  "@/shared/constants": { routes },
});
const defaults = {
  query: "",
  tagSlugs: [],
  onlyAvailable: false,
  onlyBestsellers: false,
  sortBy: "featured",
};
const product = (id, categorySlug, format) => ({
  id,
  slug: id,
  title: id,
  categoryId: categorySlug,
  categorySlug,
  price: 700,
  tags: format ? [{ slug: format, group: "format", title: format }] : [],
  characteristics: [],
  createdAt: "2026-10-30",
  isHit: false,
  isOutOfStock: false,
});
const products = [
  product("book", "animals", "po-nomeram"),
  product("pixel", undefined, "pikselnye"),
  product("markers", "markery"),
];

async function provider(section, params = {}) {
  let nextParams, destination;
  const { CatalogProvider } = await load(
    "features/catalog/lib/catalog-provider/catalog-provider.tsx",
    {
      react: {
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
        useEffect: () => {},
        useRef: (value) => ({ current: value }),
        useState: (value) => [typeof value === "function" ? value() : value, () => {}],
      },
      "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
      "next/navigation": {
        useRouter: () => ({
          replace: (href) => {
            destination = href;
          },
        }),
      },
      "@/entities/products": {
        getProductCategory: (categories, id) => categories.find((category) => category.id === id),
      },
      "@/shared/lib/query-state-manager": {
        useQueryState: () => [
          params,
          {
            addMany: (next) => {
              nextParams = next;
            },
          },
        ],
      },
      "../catalog-state": state,
      "./catalog.context": { CatalogContext: { Provider: "Provider" } },
    },
  );
  const tree = CatalogProvider({ products, categories: [], section, children: null });
  return { value: tree.props.value, nextParams: () => nextParams, destination: () => destination };
}

test("marker categories and products have their own paths; coloring paths are preserved", () => {
  assert.equal(routes.catalog, "/catalog");
  assert.equal(routes.catalogColorings, "/catalog/raskraski");
  assert.equal(routes.catalogCategory("markery"), "/catalog/markery");
  assert.equal(routes.product("markery", "markers-168"), "/catalog/markery/markers-168");
  assert.equal(routes.catalogCategory("animals"), "/catalog/raskraski/animals");
  assert.equal(routes.product("animals", "book"), "/catalog/raskraski/animals/book");
  assert.equal(routes.product(undefined, "book"), "/catalog/raskraski/book");
});

test("catalog section links select the destination and retain filters without a redundant category query", () => {
  for (const [category, pathname] of [
    ["colorings", "/catalog/raskraski"],
    ["markers", "/catalog/markery"],
    [undefined, "/catalog"],
  ]) {
    const url = new URL(
      state.getCatalogHrefWithFilters(
        { ...defaults, category, minPrice: 0 },
        { category: "markers", utm_source: "mail" },
      ),
      "https://artmate.example",
    );
    assert.equal(url.pathname, pathname);
    assert.equal(url.searchParams.get("category"), null);
    assert.equal(url.searchParams.get("min"), "0");
    assert.equal(url.searchParams.get("utm_source"), "mail");
  }
});

test("each section constrains the product list even with conflicting URL filters and after reset", async () => {
  const all = await provider(undefined);
  assert.deepEqual(
    all.value.filteredProducts.map((item) => item.id),
    ["book", "pixel", "markers"],
  );
  for (const [section, conflicting, expected] of [
    ["colorings", "markers", ["book", "pixel"]],
    ["markers", "colorings", ["markers"]],
  ]) {
    const filtered = await provider(section, { category: conflicting, min: "10000" });
    assert.deepEqual(filtered.value.filteredProducts, []);
    filtered.value.clearAll();
    const reset = await provider(section, { category: conflicting, ...filtered.nextParams() });
    assert.deepEqual(
      reset.value.filteredProducts.map((item) => item.id),
      expected,
    );
    assert.equal(reset.value.activeCategory.id, section);
    assert.equal(reset.value.getCategoryHref("markers"), "/catalog/markery");
    assert.equal(reset.value.getCategoryHref("colorings"), "/catalog/raskraski");
    reset.value.setCategory(undefined);
    assert.equal(reset.destination(), "/catalog");
  }
});
