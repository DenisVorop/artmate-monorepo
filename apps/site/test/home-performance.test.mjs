import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { QueryClient, dehydrate } = require("@tanstack/react-query");

async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "exports", output)((name) => mocks[name] ?? require(name), mod.exports);
  return mod.exports;
}

test("Ozon card requests a responsive CDN rendition and preserves signed query parameters", async () => {
  const { ozonImageLoader } = await load("shared/lib/image-url.ts");
  const source = "https://ir.ozone.ru/s3/multimedia-1-s/13242365452.jpg?test=1";
  assert.equal(
    ozonImageLoader({ src: source, width: 384 }),
    "https://ir.ozone.ru/s3/multimedia-1-s/wc512/13242365452.jpg?test=1",
  );
  assert.equal(
    ozonImageLoader({ src: ozonImageLoader({ src: source, width: 384 }), width: 750 }),
    "https://ir.ozone.ru/s3/multimedia-1-s/wc1000/13242365452.jpg?test=1",
  );
});

test("home hydration includes one featured work per collection, not all twelve fetched works", async (t) => {
  const slugs = ["cats", "animals", "flowers", "princesses"];
  const requests = [];
  const { communityWorkQuery } = await load("entities/community-work/model/query.ts", {
    "@/shared/actions/workshops": {
      getCommunityWorksForCollection: async (slug) => {
        requests.push(slug);
        return {
          works: Array.from({ length: slug === "flowers" ? 0 : 12 }, (_, index) => ({
            publicId: `${slug}-${index}`,
          })),
          nextCursor: "next-page",
        };
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
    "./schemas": { collectionWorksPageSchema: { parse: (value) => value } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  t.after(() => client.clear());
  await client.prefetchQuery(communityWorkQuery.featuredForCollections(slugs));
  await client.prefetchQuery(communityWorkQuery.featuredForCollections(slugs));
  assert.deepEqual(requests, slugs);
  assert.deepEqual(
    dehydrate(client).queries[0].state.data.map((work) => work.publicId),
    ["cats-0", "animals-0", "princesses-0"],
  );
});

test("public thumbnail is present in server HTML and loads lazily without a base64 action round trip", async () => {
  const { PublicAssetImage } = await load("entities/community-work/ui/public-asset-image.tsx", {
    "../lib/image": await load("entities/community-work/lib/image.ts"),
    "next/image": {
      default: ({ src, alt, loading, className }) =>
        React.createElement("img", { src, alt, loading, className }),
    },
  });
  const src = "https://api.artmate.ru/club/works/123/assets/thumb";
  const html = renderToStaticMarkup(
    React.createElement(PublicAssetImage, { src, alt: "Работа участника" }),
  );
  assert.match(html, /loading="lazy"/);
  assert.ok(html.includes(`src="${src}"`));
  assert.doesNotMatch(html, /data:image|animate-pulse/);
  const responsive = renderToStaticMarkup(
    React.createElement(PublicAssetImage, {
      src: src.replace("thumb", "web"),
      alt: "Работа участника",
      sizes: "50vw",
    }),
  );
  assert.match(responsive, /<source type="image\/webp"/);
  assert.match(responsive, /width=320 320w/);
  assert.match(responsive, /sizes="50vw"/);
});
