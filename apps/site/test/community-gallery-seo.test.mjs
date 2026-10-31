import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL("../src/" + path, import.meta.url), "utf8");
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
const { routes } = await load("shared/constants/routes.ts");
const { GalleryStructuredData } = await load("shared/lib/seo/structured-data.tsx", {
  "@/shared/constants": {
    routes,
    getAbsoluteUrl: (path) => new URL(path, "https://artmate.example").toString(),
    siteConfig: { name: "Artmate", url: "https://artmate.example", logo: "/logo.svg" },
    companyDetails: { supportEmail: "support@example.test" },
    externalLinks: { social: {}, marketplaces: {} },
  },
  "./text": {},
  "./registry": { seoPages: { gallery: { title: "Галерея готовых работ Artmate" } } },
});
const work = {
  publicId: "public-work",
  author: { name: "Автор </script>", handle: "author" },
  official: { coloring: { title: "Кот у окна" } },
  submission: {
    assets: { web: "https://assets.example/photo.webp" },
    publishedAt: "2026-10-30T12:00:00Z",
  },
};
function render(props) {
  const html = renderToStaticMarkup(React.createElement(GalleryStructuredData, props));
  assert.equal(
    (html.match(/<\/script>/g) ?? []).length,
    1,
    "Author text cannot break out of the JSON-LD script",
  );
  return JSON.parse(/<script[^>]*>(.*?)<\/script>/.exec(html)[1])["@graph"];
}

test("gallery schema describes only supplied photos and matches the collection URL and breadcrumbs", () => {
  const [page, breadcrumbs] = render({
    url: "/gallery/kotiki-2",
    collection: { title: "Котики 2", slug: "cifrovaya-raskraska-kotiki-2" },
    works: [work],
  });
  assert.equal(page["@type"], "CollectionPage");
  assert.equal(page.url, "https://artmate.example/gallery/kotiki-2");
  assert.equal(page.mainEntity.numberOfItems, 1);
  const image = page.mainEntity.itemListElement[0].item;
  assert.equal(image["@type"], "ImageObject");
  assert.equal(image.contentUrl, work.submission.assets.web);
  assert.equal(image.author.name, work.author.name);
  assert.equal(image.url, "https://artmate.example/club/works/public-work");
  assert.deepEqual(
    breadcrumbs.itemListElement.map((item) => item.name),
    ["Главная", "Галерея", "Котики 2"],
  );
  assert.equal(page.breadcrumb["@id"], breadcrumbs["@id"]);
});

test("empty gallery schema does not invent photos or collection breadcrumbs", () => {
  const [page, breadcrumbs] = render({ url: "/gallery", works: [] });
  assert.equal(page.mainEntity.numberOfItems, 0);
  assert.deepEqual(page.mainEntity.itemListElement, []);
  assert.equal(breadcrumbs.itemListElement.length, 2);
});
