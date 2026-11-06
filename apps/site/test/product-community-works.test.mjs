import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
async function load(path, mocks) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => mocks[id] ?? require(id),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const element = (type, props) => ({ type, props });
const { routes } = await load("shared/constants/routes.ts", {});
const { getGalleryCollectionSlug } = await load("entities/community-work/lib/selectors.ts", {});
const { CommunityWorks } = await load("features/product-details/ui/community-works.tsx", {
  "react/jsx-runtime": { jsx: element, jsxs: element },
  "@/entities/community-work": { CommunityWorkCard: "CommunityWorkCard", getGalleryCollectionSlug },
  "@/features/likes": { LikeButton: "LikeButton" },
  "@/shared/constants": { routes },
  "@/shared/ui/link": { Link: "Link" },
  "@/shared/ui": { Button: "Button", Card: "Card", CardContent: "CardContent" },
  "@/shared/ui/skeleton": { Skeleton: "Skeleton" },
  "@/shared/ui/typography": { SectionTitle: "SectionTitle" },
  "../lib/use-works-scroll": { useWorksScroll: () => ({ trackRef: {}, endRef: {} }) },
});
function render(extra) {
  return CommunityWorks({
    collectionSlug: "cifrovaya-raskraska-kotiki-2",
    works: [],
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: async () => {},
    ...extra,
  });
}
function find(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => find(child, type));
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)];
}

test("product renders without requesting works on the server or waiting for a pending feed", async (t) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  t.after(() => client.clear());
  let requests = 0;
  let finishRequest;
  const response = new Promise((resolve) => {
    finishRequest = resolve;
  });
  const schemas = await load("entities/community-work/model/schemas.ts", {});
  const { communityWorkQuery } = await load("entities/community-work/model/query.ts", {
    "@/shared/actions/workshops": {
      getCommunityWorksForCollection: () => {
        requests++;
        return response;
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
    "./schemas": schemas,
  });
  const { useCollectionCommunityWorks } = await load(
    "entities/community-work/model/use-collection-community-works.ts",
    {
      "./query": { communityWorkQuery },
    },
  );
  const product = {
    id: "album",
    title: "Раскраска «Котики»",
    price: 799,
    images: [],
    characteristics: [],
    digitalCollection: { slug: "cats" },
  };
  const empty = () => null;
  const purchase = (props) =>
    React.createElement("button", null, `В корзину · ${props.product.price} ₽`);
  const summary = (props) => React.createElement("h1", null, props.product.title);
  const { ProductDetails } = await load("features/product-details/ui/product-details.tsx", {
    "@/features/cart": { CartProductCard: empty, useAddProductToCart: () => empty },
    "@/features/product-purchase": { ProductPurchase: purchase },
    "@/features/product-cashback": { ProductCashback: empty },
    "@/entities/community-work": { useCollectionCommunityWorks },
    "@/entities/products": {
      Characteristics: empty,
      Description: empty,
      DetailsTabs: empty,
      Gallery: empty,
      Highlights: empty,
      Related: empty,
      Summary: summary,
      getProductById: () => product,
      getRelatedProducts: () => [],
      useProductsData: () => ({ data: { products: [product] }, isError: false }),
    },
    "@/entities/reviews": { useReviewsData: () => ({}), ReviewRatingSummary: empty },
    "@/shared/ui": { Button: empty, DataState: empty, Separator: empty },
    "../lib/use-track-product-view": { useTrackProductView: empty },
    "./breadcrumbs": { Breadcrumbs: empty },
    "./marketplace-links": { MarketplaceLinks: empty },
    "./community-works": {
      CommunityWorks: () => React.createElement("section", { id: "product-community-works" }),
    },
  });
  const renderProduct = () =>
    renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ProductDetails, { productId: product.id }),
      ),
    );
  const assertProduct = (markup) => {
    assert.match(markup, /Раскраска «Котики»/);
    assert.match(markup, /В корзину · 799 ₽/);
    assert.doesNotMatch(markup, /product-community-works/);
  };
  assertProduct(renderProduct());
  assert.equal(requests, 0);
  const options = communityWorkQuery.forCollection("cats");
  const pending = client.fetchInfiniteQuery(options);
  assert.equal(client.getQueryState(options.queryKey).fetchStatus, "fetching");
  assertProduct(renderProduct());
  assert.equal(requests, 1);
  finishRequest({ works: [], nextCursor: null });
  await pending;
});

test("empty works hide the entire section", () => {
  assert.equal(render(), null);
});
test("every loaded work stays in the horizontal feed without an expand button", () => {
  const works = Array.from({ length: 18 }, (_, i) => ({
    publicId: `work-${i}`,
    official: { coloring: { title: `Картина ${i + 1}` } },
  }));
  const tree = render({ works });
  assert.deepEqual(
    find(tree, "CommunityWorkCard").map((node) => node.props.work),
    works,
  );
  assert.equal(find(tree, "Button").length, 0);
  assert.equal(find(tree, "Skeleton").length, 0);
  const track = find(tree, "div").find((node) => node.props.role === "region");
  assert.equal(track.props["aria-label"], "Лента работ пользователей");
  assert.ok(
    find(tree, "CommunityWorkCard").every((node) => node.props.href === "/gallery/kotiki-2"),
  );
  const galleryCard = find(track, "Link");
  assert.equal(galleryCard.length, 1);
  assert.equal(galleryCard[0].props.href, "/gallery/kotiki-2");
  assert.equal(
    track.props.children.at(-1),
    galleryCard[0],
    "The gallery link is the last card in the feed",
  );
  assert.equal(find(galleryCard[0], "Card").length, 1);
});
test("a next-page failure keeps previous works and offers only retry", async () => {
  let retries = 0;
  const tree = render({
    works: [{ publicId: "one", official: { coloring: { title: "Картина" } } }],
    hasNextPage: true,
    isFetchNextPageError: true,
    fetchNextPage: async () => retries++,
  });
  assert.equal(find(tree, "CommunityWorkCard").length, 1);
  const button = find(tree, "Button")[0];
  assert.equal(button.props.children, "Повторить");
  button.props.onClick();
  assert.equal(retries, 1);
});
test("horizontal end observer loads automatically, disconnects and stops after the final page or an error", async (t) => {
  let effect;
  let refs;
  let refIndex;
  let callback;
  let options;
  let observed;
  let disconnected = false;
  let requests = 0;
  const previousObserver = globalThis.IntersectionObserver;
  t.after(() => {
    if (previousObserver === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = previousObserver;
  });
  globalThis.IntersectionObserver = class {
    constructor(cb, opts) {
      callback = cb;
      options = opts;
    }
    observe(node) {
      observed = node;
    }
    disconnect() {
      disconnected = true;
    }
  };
  const { useWorksScroll: renderScrollHook } = await load(
    "features/product-details/lib/use-works-scroll.ts",
    {
      react: {
        useRef: () => ({ current: refs[refIndex++] }),
        useEffect: (fn) => {
          effect = fn;
        },
      },
    },
  );
  const call = (extra = {}) => {
    refs = [{ id: "track" }, { id: "end" }];
    refIndex = 0;
    renderScrollHook({
      count: 12,
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: async () => requests++,
      ...extra,
    });
    return effect();
  };
  const cleanup = call();
  assert.equal(options.root, refs[0]);
  assert.equal(observed, refs[1]);
  callback([{ isIntersecting: false }]);
  assert.equal(requests, 0);
  callback([{ isIntersecting: true }]);
  assert.equal(requests, 1);
  cleanup();
  assert.equal(disconnected, true);
  for (const extra of [
    { hasNextPage: false },
    { isFetchingNextPage: true },
    { isFetchNextPageError: true },
    { count: 0 },
  ]) {
    assert.equal(call(extra), undefined);
  }
});
