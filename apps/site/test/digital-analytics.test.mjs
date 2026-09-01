import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) =>
    Object.hasOwn(mocks, specifier) ? mocks[specifier] : require(specifier);

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

async function loadSharedAnalytics() {
  const types = evaluateTypeScript(await readSource("src/shared/lib/analytics/types.ts"));
  const product = evaluateTypeScript(await readSource("src/shared/lib/analytics/product.ts"));
  const dedupe = evaluateTypeScript(await readSource("src/shared/lib/analytics/dedupe.ts"));
  const sanitizer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/sanitize-analytics-url.ts"),
  );
  const factory = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/create-analytics.ts"),
    {
      "./dedupe": dedupe,
      "./product": product,
      "./sanitize-analytics-url": sanitizer,
      "./types": types,
    },
  );

  return { ...types, ...product, ...dedupe, ...factory };
}

async function loadAdapter(path, sharedAnalytics) {
  return evaluateTypeScript(await readSource(path), {
    "@/shared/lib/analytics": sharedAnalytics,
  }).useAnalytics();
}

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

async function withWindow(callback) {
  const previous = globalThis.window;
  const analyticsWindow = {
    dataLayer: [],
    document: { getElementById: () => null },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  };
  globalThis.window = analyticsWindow;

  try {
    await callback(analyticsWindow);
  } finally {
    if (previous === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previous;
    }
  }
}

test("digital pages emit exact goals once per view and reject invalid data", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const catalog = await loadAdapter(
    "src/features/coloring-collections-catalog/lib/analytics.ts",
    sharedAnalytics,
  );
  const gallery = await loadAdapter(
    "src/features/coloring-collection-gallery/lib/analytics.ts",
    sharedAnalytics,
  );
  const coloring = await loadAdapter(
    "src/features/coloring-details/lib/analytics.ts",
    sharedAnalytics,
  );

  await withWindow(({ dataLayer }) => {
    catalog.opened("catalog-view-1");
    catalog.opened("catalog-view-1");
    gallery.opened(" flowers ", "collection-view-1");
    gallery.opened("", "collection-view-invalid");
    coloring.opened("flowers", 1, "coloring-view-1");
    coloring.opened("flowers", 1, "coloring-view-1");
    coloring.opened("flowers", 0, "coloring-view-invalid");

    assert.deepEqual(dataLayer, [
      { event: "digital_versions_opened" },
      { event: "digital_versions_opened", collection_slug: "flowers" },
      {
        event: "digital_coloring_open",
        collection_slug: "flowers",
        coloring_number: 1,
      },
    ]);
  });
});

test("product CTA emits the safe diagnostic event on every real click", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const purchase = await loadAdapter(
    "src/features/product-purchase/lib/analytics.ts",
    sharedAnalytics,
  );

  await withWindow(({ dataLayer }) => {
    purchase.digitalOpened(" product-1 ", " flowers ");
    purchase.digitalOpened("product-1", "flowers");
    purchase.digitalOpened("", "flowers");

    assert.deepEqual(dataLayer, [
      {
        event: "digital_open_from_product",
        product_id: "product-1",
        collection_slug: "flowers",
      },
      {
        event: "digital_open_from_product",
        product_id: "product-1",
        collection_slug: "flowers",
      },
    ]);
  });
});

test("digital analytics is wired only after valid page data and on the product CTA", async () => {
  const [catalog, gallery, coloring, purchase] = await Promise.all([
    readSource("src/features/coloring-collections-catalog/ui/catalog.tsx"),
    readSource("src/features/coloring-collection-gallery/ui/gallery.tsx"),
    readSource("src/features/coloring-details/ui/coloring-details.tsx"),
    readSource("src/features/product-purchase/ui/purchase-panel.tsx"),
  ]);

  assert.match(catalog, /useTrackOpen\(!isPending && !isError && Boolean\(collections\)\)/u);
  assert.match(gallery, /useTrackOpen\(!isPending && !isError \? collection\?\.slug/u);
  assert.match(
    coloring,
    /useTrackOpen\([\s\S]*coloring\?\.collection\.slug[\s\S]*coloring\?\.number/u,
  );
  assert.match(purchase, /onClick=\{\(\) =>[\s\S]*analytics\.digitalOpened/u);
});
