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
    // The feed formats local wall-clock time; keep that fixture identical in every TZ.
    new Date(2026, 8, 16, 15, 0, 0),
  );
  assert.match(xml, /<yml_catalog date="2026-09-16 15:00">/);
  assert.equal(
    createHash("sha256").update(xml).digest("hex"),
    "d4bbd336b72f8994bf3c6271796f6eb6209a8250dc10c4230fc5b5797720274b",
  );
});

const box = ({ children }) => React.createElement("div", null, children);
const button = ({ children, ...props }) => {
  delete props.variant;
  delete props.size;
  return React.createElement("button", props, children);
};
const ui = {
  Button: button,
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

test("usage/review tabs exclude characteristics and fall back when instructions are removed", async () => {
  let selected = "process";
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
    usageInstructions: "Встряхните маркер.\nЗакройте колпачок.",
    reviews: "Отзывы покупателей",
  };
  const full = DetailsTabs(props);
  const markup = renderToStaticMarkup(full);
  assert.equal(full.props.value, "process");
  assert.doesNotMatch(markup, /Характеристики|Количество цветов/);
  assert.match(markup, /Как пользоваться/);
  assert.match(markup, /Встряхните маркер/);
  const nav = React.createElement(
    "a",
    { href: "#product-community-works" },
    "Работы пользователей",
  );
  const grouped = DetailsTabs({ ...props, navigation: nav });
  const row = React.Children.toArray(grouped.props.children)[0];
  assert.equal(row.type, "div");
  assert.equal(
    React.Children.toArray(row.props.children).at(-1).props.href,
    "#product-community-works",
  );

  full.props.onValueChange("reviews");
  assert.equal(DetailsTabs(props).props.value, "reviews");
  full.props.onValueChange("process");
  assert.equal(DetailsTabs({ ...props, usageInstructions: " " }).props.value, "reviews");
  const empty = DetailsTabs({ ...props, usageInstructions: "" });
  assert.equal(empty.props.value, "reviews");
  assert.doesNotMatch(renderToStaticMarkup(empty), /Характеристики|Как пользоваться/);
  const escaped = renderToStaticMarkup(
    DetailsTabs({ ...props, usageInstructions: "<script>alert(1)</script>" }),
  );
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
});

const makeCharacteristics = (count) =>
  Array.from({ length: count }, (_, index) => ({
    name: `Характеристика ${String(index + 1).padStart(2, "0")}`,
    value: `Значение ${String(index + 1).padStart(2, "0")}`,
    isHighlighted: index < 2,
  }));

function findElements(tree, predicate) {
  if (!React.isValidElement(tree)) return [];
  const result = predicate(tree) ? [tree] : [];
  for (const child of React.Children.toArray(tree.props.children)) {
    result.push(...findElements(child, predicate));
  }
  return result;
}

const classNames = (...values) => values.filter(Boolean).join(" ");
const loadCharacteristicsList = () =>
  load("src/entities/products/ui/characteristics-list.tsx", {
    "@/shared/lib/utils": { cn: classNames },
  });

function assertOrderedRows(markup, items) {
  assert.equal((markup.match(/<dt(?:\s|>)/g) ?? []).length, items.length);
  assert.equal((markup.match(/<dd(?:\s|>)/g) ?? []).length, items.length);
  for (const [index, item] of items.entries()) {
    assert.ok(markup.includes(item.name));
    assert.ok(markup.includes(item.value));
    if (index > 0) {
      assert.ok(markup.indexOf(items[index - 1].name) < markup.indexOf(item.name));
    }
  }
}

async function loadDetailsDrawer({ drawerOpen = false } = {}) {
  const drawerUi = {
    ...ui,
    Drawer: box,
    DrawerTrigger: box,
    // eslint-disable-next-line react/prop-types -- Primitive stub isolates the content contract.
    DrawerContent: ({ children, ...props }) =>
      drawerOpen
        ? React.createElement("div", { ...props, "data-test-drawer": true }, children)
        : null,
    DrawerHeader: box,
    DrawerFooter: box,
    // eslint-disable-next-line react/prop-types -- Primitive stub isolates the content contract.
    DrawerTitle: ({ children }) => React.createElement("h3", null, children),
    // eslint-disable-next-line react/prop-types -- Primitive stub isolates the content contract.
    DrawerDescription: ({ children }) => React.createElement("p", null, children),
    DrawerClose: box,
  };
  return load("src/entities/products/ui/details-drawer.tsx", { "@/shared/ui": drawerUi });
}

async function loadCharacteristics({ mobile, drawerOpen = false }) {
  return load("src/entities/products/ui/characteristics.tsx", {
    "@/shared/lib/device": { useIsMobile: () => mobile },
    "@/shared/lib/utils": { cn: classNames },
    "@/shared/ui/typography": await load("src/shared/ui/typography.tsx", {
      "../lib": { cn: classNames },
    }),
    "./characteristics-list": await loadCharacteristicsList(),
    "./details-drawer": await loadDetailsDrawer({ drawerOpen }),
  });
}

async function loadDescription({ mobile, drawerOpen = false }) {
  const expandable = (props) =>
    React.createElement("div", { "data-test-expandable": props.collapsible }, props.children);
  return load("src/entities/products/ui/description.tsx", {
    "@/shared/lib/device": { useIsMobile: () => mobile },
    "@/shared/ui": { ExpandableText: expandable },
    "@/shared/ui/typography": await load("src/shared/ui/typography.tsx", {
      "../lib": { cn: classNames },
    }),
    "./details-drawer": await loadDetailsDrawer({ drawerOpen }),
  });
}

test("mobile description uses the same full-width drawer trigger as characteristics", async () => {
  const { Description } = await loadDescription({ mobile: true });
  const { Characteristics } = await loadCharacteristics({ mobile: true });
  const longProduct = { ...product, description: "<p>Описание товара.</p>".repeat(50) };
  const descriptionMarkup = renderToStaticMarkup(
    React.createElement(Description, { product: longProduct }),
  );
  const characteristicsMarkup = renderToStaticMarkup(
    React.createElement(Characteristics, {
      characteristics: makeCharacteristics(20),
      productTitle: product.title,
      id: "characteristics",
    }),
  );
  assert.doesNotMatch(descriptionMarkup, /data-test-expandable/);
  const triggerClass = (markup) => markup.match(/<button[^>]*class="([^"]+)"/)[1];
  assert.equal(triggerClass(descriptionMarkup), triggerClass(characteristicsMarkup));
  assert.match(descriptionMarkup, /Показать полностью/);
  assert.doesNotMatch(descriptionMarkup, /Закрыть описание/);
  const short = renderToStaticMarkup(React.createElement(Description, { product }));
  assert.match(short, /data-test-expandable="false"/);
  assert.doesNotMatch(short, /Показать полностью/);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(Description, { product: { ...product, description: "" } }),
    ),
    "",
  );
});

test("mobile description drawer contains every paragraph, formatting and accessible close control", async () => {
  const { Description } = await loadDescription({ mobile: true, drawerOpen: true });
  const description =
    "<p>Абзац описания.</p>".repeat(50) + "<p><strong>Последний абзац</strong></p>";
  const markup = renderToStaticMarkup(
    React.createElement(Description, { product: { ...product, description } }),
  );
  const drawerMarkup = markup.slice(markup.indexOf('data-test-drawer="true"'));
  assert.match(drawerMarkup, /<h3>Описание<\/h3>/);
  assert.match(drawerMarkup, new RegExp(product.title));
  assert.match(drawerMarkup, /aria-label="Закрыть описание"/);
  assert.match(drawerMarkup, /overflow-y-auto/);
  assert.ok(drawerMarkup.includes(description));
  assert.doesNotMatch(drawerMarkup, /max-h-36|Свернуть/);
  const { Description: DesktopDescription } = await loadDescription({ mobile: false });
  const desktop = renderToStaticMarkup(
    React.createElement(DesktopDescription, { product: { ...product, description } }),
  );
  assert.match(desktop, /data-test-expandable="true"/);
  assert.doesNotMatch(desktop, /data-test-drawer/);
});

test("read-only characteristics list preserves all ordered rows and escapes long content", async () => {
  const { CharacteristicsList } = await loadCharacteristicsList();
  const items = makeCharacteristics(20);
  for (const columns of [1, 2]) {
    const markup = renderToStaticMarkup(
      React.createElement(CharacteristicsList, { characteristics: items, columns }),
    );
    assertOrderedRows(markup, items);
    assert.doesNotMatch(markup, /Все характеристики|Свернуть|<button/);
    if (columns === 2) assert.match(markup, /grid-cols-2/);
  }
  const escaped = renderToStaticMarkup(
    React.createElement(CharacteristicsList, {
      characteristics: [
        { name: "<em>Материал</em>", value: "<script>опасно</script>\n" + "Длинное ".repeat(50) },
      ],
    }),
  );
  assert.doesNotMatch(escaped, /<script>|<em>/);
  assert.match(escaped, /&lt;em&gt;Материал&lt;\/em&gt;/);
  assert.match(escaped, /&lt;script&gt;опасно&lt;\/script&gt;/);
  assert.match(escaped, /wrap-anywhere/);
  assert.match(escaped, /whitespace-pre-line/);
  assert.match(escaped, new RegExp("Длинное ".repeat(50)));
  const listSource = await source("src/entities/products/ui/characteristics-list.tsx");
  assert.doesNotMatch(listSource, /useState|useRef|scrollIntoView|aria-expanded|Свернуть/);
});

test("desktop shows every characteristic; mobile shows six and offers a drawer only for longer lists", async (t) => {
  for (const mobile of [false, true]) {
    const { Characteristics } = await loadCharacteristics({ mobile });
    for (const count of [0, 6, 7, 20]) {
      await t.test(`${mobile ? "mobile" : "desktop"}: ${count} characteristics`, () => {
        const items = makeCharacteristics(count);
        const markup = renderToStaticMarkup(
          React.createElement(Characteristics, {
            characteristics: items,
            productTitle: product.title,
            id: "product-characteristics",
          }),
        );
        if (!count) {
          assert.equal(markup, "");
          return;
        }
        assert.match(markup, /<section[^>]*id="product-characteristics"/);
        assert.match(markup, /<h2[^>]*>Характеристики<\/h2>/);
        const headingId = markup.match(/<h2[^>]*id="([^"]+)"/)[1];
        assert.ok(markup.includes(`aria-labelledby="${headingId}"`));
        assertOrderedRows(markup, mobile ? items.slice(0, 6) : items);
        if (mobile && count > 6) {
          assert.match(markup, new RegExp(`Все характеристики \\(${count}\\)`));
          assert.doesNotMatch(markup, /Характеристика 07|Характеристика 20/);
        } else {
          assert.doesNotMatch(markup, /Все характеристики|<button/);
        }
        assert.doesNotMatch(markup, /Свернуть/);
      });
    }
  }
});

test("mobile drawer contains the complete ordered list, product context and an accessible close control", async () => {
  const { Characteristics } = await loadCharacteristics({ mobile: true, drawerOpen: true });
  const items = makeCharacteristics(20);
  const markup = renderToStaticMarkup(
    React.createElement(Characteristics, {
      characteristics: items,
      productTitle: product.title,
      id: "product-characteristics",
    }),
  );
  const drawerMarkup = markup.slice(markup.indexOf('data-test-drawer="true"'));
  assertOrderedRows(drawerMarkup, items);
  assert.match(drawerMarkup, /<h3>Характеристики<\/h3>/);
  assert.match(drawerMarkup, new RegExp(product.title));
  assert.match(drawerMarkup, /aria-label="Закрыть характеристики"/);
  assert.match(drawerMarkup, /overflow-y-auto/);
  assert.doesNotMatch(drawerMarkup, /Свернуть/);
});

test("product navigation groups conditional anchors beside reviews, and works follow characteristics", async () => {
  let currentProduct = { ...product, characteristics: makeCharacteristics(20) };
  const components = Object.fromEntries(
    [
      "Description",
      "DetailsTabs",
      "Gallery",
      "Highlights",
      "Characteristics",
      "Related",
      "Summary",
    ].map((name) => [name, box]),
  );
  // Distinct identities allow testing the actual composition instead of matching source strings.
  for (const name of Object.keys(components)) components[name] = () => null;
  const CommunityWorks = () => null;
  let works = [];
  const { ProductDetails } = await load("src/features/product-details/ui/product-details.tsx", {
    "@/features/cart": { CartProductCard: box, useAddProductToCart: () => () => {} },
    "@/features/product-purchase": { ProductPurchase: box },
    "@/entities/community-work": { useCollectionCommunityWorks: () => ({ works }) },
    "@/entities/products": {
      ...components,
      useProductsData: () => ({ data: { products: [currentProduct] }, isError: false }),
      getProductById: (items) => items[0],
      getRelatedProducts: () => [],
    },
    "@/entities/reviews": { ReviewRatingSummary: box, useReviewsData: () => ({}) },
    "@/shared/ui": { ...ui, DataState: box, Separator: box },
    "../lib/use-track-product-view": { useTrackProductView: () => {} },
    "./breadcrumbs": { Breadcrumbs: box },
    "./marketplace-links": { MarketplaceLinks: box },
    "./community-works": { CommunityWorks },
  });
  const navigation = (tree) =>
    findElements(tree, (element) => element.type === components.DetailsTabs)[0].props.navigation;
  const tree = ProductDetails({ productId: product.id });
  const order = findElements(tree, (element) =>
    [components.Description, components.Characteristics, components.Related].includes(element.type),
  );
  assert.deepEqual(
    order.map((element) => element.type),
    [components.Description, components.Characteristics, components.Related],
  );
  assert.equal(order[1].props.id, "product-characteristics");
  assert.deepEqual(order[1].props.characteristics, currentProduct.characteristics);
  assert.equal(order[1].props.productTitle, product.title);
  assert.equal(
    findElements(navigation(tree), (element) => element.props.href === "#product-characteristics")
      .length,
    1,
  );
  const tabs = findElements(tree, (element) => element.type === components.DetailsTabs)[0];
  assert.equal(tabs.props.characteristics, undefined);

  currentProduct = { ...product, characteristics: [] };
  const empty = ProductDetails({ productId: product.id });
  assert.equal(
    findElements(navigation(empty), (element) => element.props.href === "#product-characteristics")
      .length,
    0,
  );

  assert.equal(findElements(empty, (element) => element.type === CommunityWorks).length, 0);
  currentProduct = { ...product, digitalCollection: { slug: "animals" } };
  const noWorks = ProductDetails({ productId: product.id });
  assert.equal(findElements(noWorks, (element) => element.type === CommunityWorks).length, 0);
  assert.equal(
    findElements(
      navigation(noWorks),
      (element) => element.props.href === "#product-community-works",
    ).length,
    0,
  );
  works = [{ publicId: "example" }];
  const withWorks = ProductDetails({ productId: product.id });
  assert.equal(
    findElements(withWorks, (element) => element.type === CommunityWorks)[0].props.works,
    works,
  );
  assert.equal(
    findElements(
      navigation(withWorks),
      (element) => element.props.href === "#product-community-works",
    ).length,
    1,
  );
  assert.deepEqual(
    findElements(withWorks, (element) =>
      [components.Description, components.Characteristics, CommunityWorks].includes(element.type),
    ).map((element) => element.type),
    [components.Description, components.Characteristics, CommunityWorks],
  );
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
