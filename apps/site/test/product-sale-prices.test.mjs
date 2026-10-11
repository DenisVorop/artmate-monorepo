import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const text = await readFile(new URL("../" + path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
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

const apiResult = {
  ApiResult: { prepareApi: (fn) => async () => ({ toDTO: async () => ({ data: await fn() }) }) },
};
const apiProduct = {
  id: "album",
  title: "Альбом",
  slug: "album",
  price: 79900,
  priceRub: 799,
  salePrice: 69900,
  salePriceRub: 699,
  images: [{ url: "/album.webp" }],
  tags: [],
  characteristics: [],
  createdAt: "2026-10-11",
  updatedAt: "2026-10-11",
};

test("catalog and landing use the sale price, preserve the ordinary price, and fetch fresh prices", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push(init);
    return {
      ok: true,
      json: async () =>
        url.includes("/landings")
          ? { id: "cats", slug: "cats", products: [apiProduct], faqItems: [] }
          : [apiProduct],
    };
  });
  const mocks = { "@/shared/lib/api-result": apiResult };
  const { getProductsData } = await load("src/shared/actions/products/products.actions.ts", mocks);
  const { getCatalogLandingPage } = await load(
    "src/shared/actions/catalog-landings/catalog-landings.actions.ts",
    mocks,
  );
  const catalog = (await getProductsData()).data;
  const landing = (await getCatalogLandingPage("cats")).data;
  for (const product of [catalog.products[0], landing.products[0]]) {
    assert.equal(product.price, 699);
    assert.equal(product.originalPrice, 799);
  }
  assert.ok(requests.every((init) => init.cache === "no-store"));
});

test("removing a sale restores the ordinary price and removes the comparison", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => [{ ...apiProduct, salePrice: null, salePriceRub: null }],
  }));
  const { getProductsData } = await load("src/shared/actions/products/products.actions.ts", {
    "@/shared/lib/api-result": apiResult,
  });
  const product = (await getProductsData()).data.products[0];
  assert.equal(product.price, 799);
  assert.equal(product.originalPrice, undefined);
});

test("price renders an accessible comparison and savings only for an active discount", async () => {
  const { ProductPrice } = await load("src/entities/products/ui/price.tsx", {
    "@/shared/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
      "@/shared/ui": { Badge: "span" },
  });
  const sale = renderToStaticMarkup(
    React.createElement(ProductPrice, { price: 699, originalPrice: 799, variant: "detail" }),
  );
  assert.match(sale, /Цена со скидкой/);
  assert.match(sale, /699/);
  assert.match(sale, /<s[^>]*>.*Обычная цена.*799/);
  assert.match(sale, /Экономия 100/);
  assert.match(sale, /−12%/);
  for (const originalPrice of [undefined, 699, 650]) {
    const normal = renderToStaticMarkup(
      React.createElement(ProductPrice, { price: 699, originalPrice, variant: "detail" }),
    );
    assert.doesNotMatch(normal, /<s\s|Экономия|Цена со скидкой|%/);
  }
});
