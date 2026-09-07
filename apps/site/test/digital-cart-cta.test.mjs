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
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected test module import: ${specifier}`);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

function element(type, props) {
  return { type, props: props ?? {} };
}

function findElements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!node || typeof node !== "object") return [];

  return [
    ...(predicate(node) ? [node] : []),
    ...findElements(node.props?.children, predicate),
  ];
}

function getText(node) {
  if (Array.isArray(node)) return node.map(getText).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node?.props ? getText(node.props.children) : "";
}

const product = {
  id: "product-1",
  title: "Раскраска по номерам «Котики 2»",
  slug: "cats-2",
  categorySlug: "animals",
  image: "https://example.test/cats-2.webp",
};

const coloring = {
  number: 1,
  title: "Кот",
  description: "Описание картины",
  publishedRevisionId: "revision-1",
  colored: {},
  outline: {},
  width: 1200,
  height: 1600,
  palette: { colors: [] },
  themes: [],
  collection: {
    slug: "cats-2",
    title: "Котики 2",
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      category: { id: "category-1", slug: "animals", title: "Животные" },
    },
  },
};

test("digital hub and collection lists contain no cart, price, or stock UI", async () => {
  const listSources = await Promise.all(
    [
      "src/_pages/coloring-collections/index.tsx",
      "src/_pages/coloring-collection/index.tsx",
      "src/features/coloring-collections-catalog/ui/catalog.tsx",
      "src/features/coloring-collection-gallery/ui/gallery.tsx",
    ].map(readSource),
  );
  const cartIndex = await readSource("src/features/cart/index.ts");

  for (const source of listSources) {
    assert.doesNotMatch(
      source,
      /ProductCartCta|productAction|useProductsData|getProductById|useCartData|useAddCartItemMutation|\bprice\b|isOutOfStock/,
    );
  }
  assert.doesNotMatch(cartIndex, /ProductCartCta/);
  await assert.rejects(
    () => readSource("src/features/cart/ui/product-cart-cta.tsx"),
    (error) => error.code === "ENOENT",
  );
});

test("coloring detail always renders its physical album link and treats product data as enrichment", async () => {
  const source = await readSource("src/features/coloring-details/ui/coloring-details.tsx");
  let productsResult = { data: { products: [product] }, isError: false, isPending: false };
  const { ColoringDetails } = evaluateTypeScript(source, {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "@/entities/coloring": {
      useColoringData: () => ({ coloring, isError: false, isPending: false, refetch() {} }),
    },
    "@/entities/products": {
      getProductById: (items, id) => items.find((item) => item.id === id),
      useProductsData: () => productsResult,
    },
    "@/shared/ui": { Button: "Button", DataState: "DataState" },
    "../lib/use-track-open": { useTrackOpen() {} },
    "./comparison-viewer": { ComparisonViewer: "ComparisonViewer" },
    "./hero": { Hero: "Hero" },
    "./palette-section": { PaletteSection: "PaletteSection" },
    "./physical-album-callout": { PhysicalAlbumCallout: "PhysicalAlbumCallout" },
  });
  const render = () =>
    ColoringDetails({
      collectionSlug: "cats-2",
      number: 1,
      publishedRevisionId: "revision-1",
    });

  let callouts = findElements(render(), (node) => node.type === "PhysicalAlbumCallout");
  assert.equal(callouts.length, 1);
  assert.strictEqual(callouts[0].props.product, coloring.collection.product);
  assert.equal(callouts[0].props.coverImage, product.image);

  productsResult = { data: { products: [] }, isError: false, isPending: false };
  callouts = findElements(render(), (node) => node.type === "PhysicalAlbumCallout");
  assert.equal(callouts.length, 1);
  assert.strictEqual(callouts[0].props.product, coloring.collection.product);
  assert.equal(callouts[0].props.coverImage, undefined);

  productsResult = { data: undefined, isError: true, isPending: false };
  callouts = findElements(render(), (node) => node.type === "PhysicalAlbumCallout");
  assert.equal(callouts.length, 1);
  assert.strictEqual(callouts[0].props.product, coloring.collection.product);
  assert.equal(callouts[0].props.coverImage, undefined);
});

test("physical album callout shows the cover and exactly one quiet product link", async () => {
  const source = await readSource(
    "src/features/coloring-details/ui/physical-album-callout.tsx",
  );
  const { PhysicalAlbumCallout } = evaluateTypeScript(source, {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "next/image": "Image",
    "lucide-react": { ArrowUpRight: "ArrowUpRight" },
    "@/shared/constants": {
      routes: {
        product: (categorySlug, slug) => `/catalog/raskraski/${categorySlug}/${slug}`,
      },
    },
    "@/shared/lib": { shouldBypassNextImageOptimization: () => false },
    "@/shared/ui/link": { Link: "Link" },
  });
  const tree = PhysicalAlbumCallout({
    coverImage: product.image,
    product: coloring.collection.product,
  });
  const links = findElements(tree, (node) => node.type === "Link");
  const images = findElements(tree, (node) => node.type === "Image");

  assert.equal(links.length, 1);
  assert.equal(getText(links[0]), "Купить печатный альбом");
  assert.equal(links[0].props.href, "/catalog/raskraski/animals/cats-2");
  assert.equal(images.length, 1);
  assert.equal(images[0].props.src, product.image);
  assert.match(getText(tree), /Печатный альбом/);
  assert.match(getText(tree), new RegExp(product.title));
  assert.doesNotMatch(source, /\bprice\b|isOutOfStock|ProductCartCta|useCartData/);

  const quietTree = PhysicalAlbumCallout({ product: coloring.collection.product });
  const quietLinks = findElements(quietTree, (node) => node.type === "Link");
  assert.equal(quietLinks.length, 1);
  assert.equal(getText(quietLinks[0]), "Купить печатный альбом");
  assert.equal(quietLinks[0].props.href, "/catalog/raskraski/animals/cats-2");
  assert.equal(findElements(quietTree, (node) => node.type === "Image").length, 0);
});
