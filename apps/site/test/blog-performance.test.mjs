import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "exports", output)((name) => mocks[name] ?? require(name), mod.exports);
  return mod.exports;
}

// Primitives keep the test focused on actual Next Image output.
const block = ({ children }) => React.createElement("div", null, children);
// Link stub preserves the card's article destination.
const link = ({ href, children }) => React.createElement("a", { href }, children);
const mocks = {
  "@/shared/ui": Object.fromEntries(
    [
      "AspectRatio",
      "Badge",
      "Button",
      "Card",
      "CardContent",
      "CardDescription",
      "CardFooter",
      "CardTitle",
    ].map((name) => [name, block]),
  ),
  "@/shared/constants": { routes: { blogPost: (slug) => `/blog/${slug}` } },
  "@/shared/ui/link": { Link: link },
};
const { PostCard } = await load("entities/blog/ui/post-card.tsx", mocks);
const { FeaturedPost } = await load("entities/blog/ui/featured-post.tsx", mocks);
const { List } = await load("features/blog/ui/list.tsx", {
  "@/entities/blog": { PostCard, FeaturedPost },
});
const posts = [1, 2].map((id) => ({
  id: String(id),
  slug: `article-${id}`,
  title: `Статья ${id}`,
  image: `/test-cover-${id}.webp`,
}));

for (const featured of [false, true]) {
  test(`blog server HTML gives priority only to ${featured ? "the featured article" : "the first card"}`, () => {
    const html = renderToStaticMarkup(
      React.createElement(List, {
        posts,
        featuredPost: featured
          ? {
              ...posts[0],
              id: "featured",
              slug: "featured",
              title: "Главная статья",
              image: "/test-featured.webp",
            }
          : undefined,
      }),
    );
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
    assert.equal(images.length, featured ? 3 : 2);
    assert.match(images[0], /loading="eager"/);
    assert.match(images[0], /fetchPriority="high"/i);
    for (const image of images.slice(1)) {
      assert.match(image, /loading="lazy"/);
      assert.doesNotMatch(image, /fetchPriority="high"/i);
    }
    const preloads = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('as="image"'));
    assert.equal(preloads.length, 1);
    assert.match(preloads[0], /fetchPriority="high"/i);
    assert.ok(preloads[0].includes(featured ? "test-featured.webp" : "test-cover-1.webp"));
    assert.match(html, /href="\/blog\/article-1"/);
    assert.doesNotMatch(images[0], /sizes="(?:50vw|100vw)"/);
  });
}
