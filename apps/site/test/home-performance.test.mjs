import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

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

test("home LCP banner is in server HTML with a high-priority responsive preload", async () => {
  const { OfferBanner } = await load("_pages/home/ui/offer-banner.tsx", {
    "@/features/home-offer": { HomeOffer: () => React.createElement("span", null, "−12%") },
    "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
    "./constants": { homeLinks: { albums: "/catalog/raskraski" } },
    "./home.module.css": { default: {} },
  });
  const html = renderToStaticMarkup(React.createElement(OfferBanner));
  const image = html.match(/<img\b[^>]*alt="Кот в очках[^>]*>/)?.[0];
  const preload = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes("cats-glasses-banner.webp"));
  assert.ok(image, "The LCP image must be discoverable before hydration");
  assert.match(image, /loading="eager"/);
  assert.match(image, /fetchPriority="high"/i);
  assert.match(image, /srcSet=/i);
  assert.ok(preload, "React should preload the responsive LCP image from server HTML");
  assert.match(preload, /rel="preload"/);
  assert.match(preload, /as="image"/);
  assert.match(preload, /fetchPriority="high"/i);
});

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

test("a cold home preview keeps the page and work cards visible inside the app suspense boundary", async () => {
  const pending = new Promise(() => {});
  const PendingPreview = () => {
    throw pending;
  };
  const work = {
    publicId: "work-1",
    official: { collection: { slug: "cats" }, coloring: { title: "Котик" } },
  };
  const preview = {
    selectedWork: work,
    isOpen: true,
    triggerRef: { current: null },
    onOpenChange() {},
  };
  const loading = await load("features/home-community/ui/preview-loading.tsx", {
    "@/shared/ui": {
      // eslint-disable-next-line react/prop-types -- Primitive stub isolates the suspense boundary.
      ResponsiveMediaViewer: ({ children }) =>
        React.createElement("section", { role: "dialog" }, children),
    },
    "@/shared/ui/skeleton": { Skeleton: () => React.createElement("div") },
  });
  const { HomeCommunity } = await load("features/home-community/ui/community.tsx", {
    "@/features/likes": { LikeButton: () => null },
    react: { ...React, lazy: () => PendingPreview },
    "next/dynamic": { default: () => PendingPreview },
    "@/entities/community-work": {
      useFeaturedCollectionWorks: () => ({ works: [work] }),
      CommunityWorkCard: () => React.createElement("button", null, "Открыть изображение: Котик"),
    },
    "@/shared/lib/schedule-idle-preload": { scheduleIdlePreload() {} },
    "../lib/constants": { homeCommunityCollectionSlugs: ["cats"] },
    "../lib/use-image-preview": { useImagePreview: () => preview },
    "./preview-loading": loading,
  });
  const { HomeCommunitySection } = await load("features/home-community/ui/community-section.tsx", {
    "@/shared/ui/typography": {
      // eslint-disable-next-line react/prop-types -- Presentation stub for isolated component tests.
      SectionTitle: ({ children }) => React.createElement("h2", null, children),
    },
    // eslint-disable-next-line react/prop-types -- Primitive stub for isolated component tests.
    "@/shared/ui": { Button: ({ children }) => React.createElement("div", null, children) },
    "@/shared/ui/link": {
      // eslint-disable-next-line react/prop-types -- Primitive stub for isolated component tests.
      Link: ({ href, children }) => React.createElement("a", { href }, children),
    },
    "@/shared/constants": { routes: { gallery: "/gallery" } },
    "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
  });
  const shell = renderToString(
    React.createElement(
      HomeCommunitySection,
      null,
      React.createElement(React.Suspense, { fallback: null }, React.createElement(PendingPreview)),
    ),
  );
  assert.match(shell, /Работы участников/);
  assert.match(shell, /<a href="\/gallery">Все работы<\/a>/);
  const html = renderToString(
    React.createElement(
      React.Suspense,
      { fallback: React.createElement("p", { "data-app-fallback": true }, "Страница скрыта") },
      React.createElement(HomeCommunitySection, null, React.createElement(HomeCommunity)),
    ),
  );
  assert.match(html, /Работы участников/);
  assert.match(html, /Открыть изображение: Котик/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /Открываем фотографию…/);
  assert.doesNotMatch(html, /data-app-fallback/);
});
