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
      jsx: ts.JsxEmit.ReactJSX,
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
      "@/shared/lib/cookie-consent": { getCookieConsentSnapshot: () => true },
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

test("product CTA emits the diagnostic and the named digital collection goal on each click", async () => {
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
      { event: "digital_collection_link_click", source: "product", collection_slug: "flowers" },
      {
        event: "digital_open_from_product",
        product_id: "product-1",
        collection_slug: "flowers",
      },
      { event: "digital_collection_link_click", source: "product", collection_slug: "flowers" },
    ]);
  });
});

test("digital picture actions have separate names and keep only public picture context", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const { useViewerAnalytics } = evaluateTypeScript(
    await readSource("src/features/coloring-variants/lib/analytics.ts"),
    { "@/shared/lib/analytics": sharedAnalytics },
  );

  await withWindow((analyticsWindow) => {
    const analytics = useViewerAnalytics("forest", 7);
    analytics.pictureViewed();
    analytics.paletteSelected("original");
    analytics.comparisonOpened();
    analytics.comparisonMoved(56.8);
    analytics.comparisonClosed();
    analytics.leftShown();
    analytics.rightShown();
    analytics.imageRetried();
    analytics.paletteSelected("buyer@example.test");
    analytics.comparisonMoved(101);
    useViewerAnalytics("https://example.test/private", 7).pictureViewed();

    const picture = { collection_slug: "forest", coloring_number: 7 };
    assert.deepEqual(analyticsWindow.dataLayer, [
      { event: "digital_picture_image_view", ...picture },
      { event: "digital_palette_selected", ...picture, palette_id: "original" },
      { event: "digital_compare_open", ...picture },
      { event: "digital_compare_moved", ...picture, percent: 57 },
      { event: "digital_compare_close", ...picture },
      { event: "digital_show_left", ...picture },
      { event: "digital_show_right", ...picture },
      { event: "digital_image_retry", ...picture },
    ]);
  });
});

test("an image view waits for the viewport, image bytes and a visible tab", async () => {
  const cleanups = [];
  let intersection;
  class TestImage extends EventTarget {
    complete = false;
    naturalWidth = 0;
  }
  const image = new TestImage();
  const document = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  const original = {};
  const globals = {
    document,
    HTMLImageElement: TestImage,
    IntersectionObserver: class {
      constructor(callback) {
        intersection = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    original[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  try {
    const { useVisibleImage } = evaluateTypeScript(
      await readSource("src/shared/lib/hooks/use-visible-image.ts"),
      {
        "@/shared/lib/cookie-consent": { useCookieConsent: () => ({ isAccepted: true }) },
        react: {
          useEffect: (run) => cleanups.push(run()),
          useRef: (current) => ({ current }),
        },
      },
    );
    let views = 0;
    useVisibleImage({ current: image }, "picture-7", () => views++);
    intersection([{ target: image, isIntersecting: true, intersectionRatio: 0.5 }]);
    assert.equal(views, 0);
    image.complete = true;
    image.naturalWidth = 320;
    image.dispatchEvent(new Event("load"));
    assert.equal(views, 0);
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    intersection([{ target: image, isIntersecting: true, intersectionRatio: 0.75 }]);
    assert.equal(views, 1);
  } finally {
    for (const cleanup of cleanups) cleanup?.();
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("materials viewer goal preserves exact payload, SSR safety and per-visit deduplication", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const analytics = await loadAdapter(
    "src/features/coloring-variants/lib/analytics.ts",
    sharedAnalytics,
  );
  assert.doesNotThrow(() => analytics.opened("forest", 1, "ssr-view"));

  await withWindow((analyticsWindow) => {
    const goals = [];
    analyticsWindow.document.getElementById = () => ({ getAttribute: () => "12345" });
    analyticsWindow.ym = (...args) => goals.push(args);
    analytics.opened(" forest ", 1, "materials-view-1");
    analytics.opened("forest", 1, "materials-view-1");
    analytics.opened("forest", 1, "materials-view-2");
    for (const number of [0, -1, 1.5, NaN, Infinity]) {
      analytics.opened("forest", number, `invalid-${number}`);
    }
    analytics.opened("", 1, "invalid-slug");
    analytics.opened("buyer@example.test", 1, "invalid-pii");
    analytics.opened("forest", 1, "");
    const params = { collection_slug: "forest", coloring_number: 1 };
    assert.deepEqual(analyticsWindow.dataLayer, [
      { event: "digital_coloring_open", ...params },
      { event: "digital_coloring_open", ...params },
    ]);
    assert.deepEqual(goals, [
      [12345, "reachGoal", "digital_coloring_open", params],
      [12345, "reachGoal", "digital_coloring_open", params],
    ]);
  });
});

test("materials viewer tracks only ready data and a fresh mount creates a new view", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const adapter = evaluateTypeScript(
    await readSource("src/features/coloring-variants/lib/analytics.ts"),
    {
      "@/shared/lib/analytics": sharedAnalytics,
    },
  );
  let viewRef;
  const hook = evaluateTypeScript(
    await readSource("src/features/coloring-variants/lib/use-track-open.ts"),
    {
      "./analytics": adapter,
      react: {
        useRef: (value) => {
          viewRef ??= { current: value };
          return viewRef;
        },
        useEffect: (effect) => effect(),
      },
    },
  );
  let state;
  const jsx = (type, props) => ({ type, props });
  const { ColoringVariants } = evaluateTypeScript(
    await readSource("src/features/coloring-variants/ui/coloring-variants.tsx"),
    {
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/entities/coloring-variants": { useColoringVariantsData: () => state },
      "@/shared/ui": { Button: "Button", DataState: "DataState" },
      "../lib/use-track-open": hook,
      "../lib/analytics": adapter,
      "./palette-viewer": { PaletteViewer: "PaletteViewer" },
    },
  );
  await withWindow(({ dataLayer }) => {
    const coloring = { collection: { slug: "forest" }, number: 1, token: "materials-2" };
    const render = () =>
      ColoringVariants({ collectionSlug: "forest", number: 1, token: coloring.token });
    for (const unavailable of [
      { coloring, isPending: true, isError: false },
      { coloring, isPending: false, isError: true },
      { coloring: undefined, isPending: false, isError: false },
    ]) {
      state = unavailable;
      render();
    }
    assert.deepEqual(dataLayer, []);
    state = { coloring, isPending: false, isError: false };
    assert.equal(render().type, "PaletteViewer");
    render();
    assert.equal(dataLayer.length, 1);
    viewRef = undefined;
    render();
    assert.equal(dataLayer.length, 2);
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
