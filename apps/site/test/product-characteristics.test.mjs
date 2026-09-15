import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
function evaluate(text, mocks = {}) {
  const compiled = ts.transpileModule(text, {
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
const load = async (path, mocks) => evaluate(await source(path), mocks);
const textHelpers = await load("src/shared/lib/seo/text.ts");
const constants = {
  companyDetails: { legalName: "Artmate", supportEmail: "support@example.test" },
  externalLinks: { social: { telegramOfficial: "https://t.me/example" }, marketplaces: {} },
  getAbsoluteUrl: (path) => new URL(path, "https://artmate.example").toString(),
  routes: {
    home: "/",
    catalog: "/catalog",
    legal: { returnPolicy: "/legal/return-policy" },
    catalogCategory: (slug) => "/catalog/raskraski/" + slug,
    product: (category, slug) => "/catalog/raskraski/" + (category ? category + "/" : "") + slug,
  },
  siteConfig: {
    name: "Artmate",
    url: "https://artmate.example",
    logo: "/logo.svg",
    locale: "ru_RU",
  },
};
const characteristics = [
  { name: "Количество цветов", value: "168", isHighlighted: true },
  { name: "Основа", value: "Водная", isHighlighted: false },
  { name: "Наконечник", value: "Гибкая нейлоновая кисть", isHighlighted: true },
];
const product = {
  id: "markers",
  slug: "markers",
  title: "Акриловые маркеры Artmate, 168 цветов",
  image: "https://artmate.example/markers.webp",
  images: ["https://artmate.example/markers.webp"],
  price: 2999,
  description: "Акриловые маркеры на водной основе.",
  characteristics,
  isOutOfStock: false,
};
const noAlbumClaims = /бумага 190|бумаги|г\/м²|альбом A4|25 иллюстраций|25 картин/i;

test("product SEO uses actual content, truncates long descriptions and never invents album properties", () => {
  assert.equal(textHelpers.createProductSeoDescription(product), product.description);
  const long = "<p>Акриловая краска &amp; водная основа.</p> ".repeat(20);
  const description = textHelpers.createProductSeoDescription({ ...product, description: long });
  assert.ok(description.length <= 180);
  assert.match(description, /^Акриловая краска & водная основа/);
  assert.doesNotMatch(description, /<p>|&amp;|альбом/);
  const fallback = textHelpers.createProductSeoDescription({ ...product, description: "" });
  assert.match(fallback, /Количество цветов: 168/);
  assert.doesNotMatch(fallback, noAlbumClaims);
  assert.equal(textHelpers.createProductSeoDescription({ title: "Новый товар" }), "Новый товар");
});

test("metadata/OG/Twitter/JSON-LD share product content, preserve URLs and expose only actual properties", async () => {
  const { createProductMetadata } = await load("src/shared/lib/seo/metadata.ts", {
    "@/shared/constants": constants,
    "./text": textHelpers,
    "./registry": { seoPages: {} },
    "./keywords": await load("src/shared/lib/seo/keywords.ts"),
  });
  const metadata = createProductMetadata(product);
  assert.equal(metadata.description, product.description);
  assert.equal(metadata.openGraph.description, product.description);
  assert.equal(metadata.twitter.description, product.description);
  assert.equal(metadata.alternates.canonical, "/catalog/raskraski/markers");
  assert.doesNotMatch(JSON.stringify(metadata), noAlbumClaims);
  const { ProductStructuredData } = await load("src/shared/lib/seo/structured-data.tsx", {
    "@/shared/constants": constants,
    "./text": textHelpers,
  });
  const markup = renderToStaticMarkup(
    React.createElement(ProductStructuredData, {
      product,
      url: "/catalog/raskraski/markers",
    }),
  );
  const data = JSON.parse(markup.match(/<script[^>]*>(.*?)<\/script>/s)[1])[0];
  assert.equal(data.description, metadata.description);
  assert.deepEqual(
    data.additionalProperty,
    characteristics.map(({ name, value }) => ({
      "@type": "PropertyValue",
      name,
      value,
    })),
  );
  assert.equal(data.material, undefined);
  assert.equal(data.countryOfOrigin, undefined);
  assert.equal(data.category, undefined);
  assert.equal(data.offers.price, 2999);
});

test("manually configured SEO continues to override product fallbacks", async () => {
  const { Seo } = await load("src/shared/lib/seo/service.ts", {
    "@/shared/constants": constants,
    "@/shared/actions/seo": {
      getResolvedSeoMetadata: async () => ({
        found: true,
        metadata: {
          title: "Ручной заголовок",
          description: "Описание редактора",
          keywords: ["Ручное слово"],
        },
      }),
    },
  });
  const result = await Seo.getMetadata({
    path: "/catalog/raskraski/markers",
    fallback: {
      title: product.title,
      description: textHelpers.createProductSeoDescription(product),
    },
  });
  assert.equal(result.title.absolute, "Ручной заголовок");
  assert.equal(result.description, "Описание редактора");
  assert.equal(result.openGraph.description, "Описание редактора");
  assert.equal(result.twitter.description, "Описание редактора");
  assert.deepEqual(result.keywords, ["Ручное слово"]);
});

test("site SEO leaves existing YML XML unchanged for empty, short and long descriptions", async () => {
  const { createYandexProductsFeed } = await load("src/shared/lib/yandex-products-feed.ts", {
    "@/shared/constants": constants,
    "./seo/text": textHelpers,
  });
  const xml = createYandexProductsFeed(
    {
      categories: [],
      products: [
        { ...product, id: "empty", description: "" },
        { ...product, id: "short" },
        { ...product, id: "long", description: "Реальное описание товара. ".repeat(20) },
      ],
    },
    new Date("2026-09-16T12:00:00.000Z"),
  );
  assert.equal(
    createHash("sha256").update(xml).digest("hex"),
    "d4bbd336b72f8994bf3c6271796f6eb6209a8250dc10c4230fc5b5797720274b",
  );
});

const box = ({ children }) => React.createElement("div", null, children);
const ui = {
  Card: box,
  CardContent: box,
  CardTitle: box,
  Tabs: box,
  TabsList: box,
  TabsContent: box,
  // eslint-disable-next-line react/prop-types -- Presentation stub for isolated component tests.
  TabsTrigger: ({ children }) => React.createElement("button", null, children),
};

test("highlights preserve delivery and use at most two marked values from the same ordered array", async () => {
  const { Highlights } = await load("src/entities/products/ui/highlights.tsx", {
    "@/shared/ui": ui,
  });
  const markup = renderToStaticMarkup(React.createElement(Highlights, { characteristics }));
  assert.match(markup, /Оформление заказа через корзину сайта/);
  assert.match(markup, /Количество цветов/);
  assert.match(markup, /168/);
  assert.match(markup, /Гибкая нейлоновая кисть/);
  assert.doesNotMatch(markup, /Водная|25 картин/);
  const capped = renderToStaticMarkup(
    React.createElement(Highlights, {
      characteristics: [
        ...characteristics,
        { name: "Третья", value: "Лишняя", isHighlighted: true },
      ],
    }),
  );
  assert.doesNotMatch(capped, /Лишняя/);
  const empty = renderToStaticMarkup(React.createElement(Highlights, { characteristics: [] }));
  assert.match(empty, /Доставка/);
  assert.doesNotMatch(empty, /Комплект|Сюжеты/);
});

test("tabs hide empty sections, fall back from a removed active tab and render escaped ordered content", async () => {
  let selected = "details";
  const { DetailsTabs } = await load("src/entities/products/ui/details-tabs.tsx", {
    "@/shared/ui": ui,
    react: {
      ...React,
      useState: () => [
        selected,
        (value) => {
          selected = value;
        },
      ],
    },
  });
  const props = {
    characteristics,
    usageInstructions: "Встряхните маркер.\nЗакройте колпачок.",
    reviews: "Отзывы покупателей",
  };
  const full = DetailsTabs(props);
  const markup = renderToStaticMarkup(full);
  assert.equal(full.props.value, "details");
  assert.match(markup, /Характеристики/);
  assert.match(markup, /Как пользоваться/);
  assert.ok(markup.indexOf("Количество цветов") < markup.indexOf("Основа"));
  full.props.onValueChange("process");
  assert.equal(DetailsTabs({ ...props, usageInstructions: " " }).props.value, "details");
  const empty = DetailsTabs({ ...props, characteristics: [], usageInstructions: "" });
  assert.equal(empty.props.value, "reviews");
  assert.doesNotMatch(renderToStaticMarkup(empty), /Характеристики|Как пользоваться/);
  const escaped = renderToStaticMarkup(
    DetailsTabs({ ...props, usageInstructions: "<script>alert(1)</script>" }),
  );
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
});

test("catalog API mapping keeps each product's fields without universal defaults", async (t) => {
  const apiProducts = [
    {
      ...product,
      priceRub: 2999,
      images: [{ url: product.image }],
      tags: [],
      usageInstructions: "Встряхните маркер.",
    },
    {
      ...product,
      id: "empty",
      priceRub: 100,
      images: [{ url: product.image }],
      tags: [],
      characteristics: [],
      usageInstructions: undefined,
    },
  ];
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => apiProducts }));
  const { getProductsData } = await load("src/shared/actions/products/products.actions.ts", {
    "@/shared/lib/api-result": {
      ApiResult: {
        prepareApi: (fn) => async () => ({ toDTO: async () => ({ data: await fn() }) }),
      },
    },
  });
  const { data } = await getProductsData();
  assert.deepEqual(data.products[0].characteristics, characteristics);
  assert.equal(data.products[0].usageInstructions, "Встряхните маркер.");
  assert.deepEqual(data.products[1].characteristics, []);
  assert.equal(data.products[1].usageInstructions, undefined);
  assert.equal(data.productSpecs, undefined);
  assert.equal(data.productHighlights, undefined);
});
