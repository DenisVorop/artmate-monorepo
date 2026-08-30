import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    return require(specifier);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

const siteUrl = "https://artmate.example";
const routes = {
  home: "/",
  catalog: "/catalog",
  colorings: "/raskraski",
  coloringCollection: (slug) => `/raskraski/digital/${slug}`,
  coloring: (collectionSlug, number) =>
    `/raskraski/digital/${collectionSlug}/${String(number).padStart(2, "0")}`,
  product: (categorySlug, productSlug) =>
    categorySlug
      ? `/catalog/raskraski/${categorySlug}/${productSlug}`
      : `/catalog/raskraski/${productSlug}`,
};
const coloring = {
  id: "coloring-1",
  number: 1,
  title: "Лиса и сова",
  description: "Раскраска с лесными героями",
  publishedRevisionId: "revision-2",
  publishedAt: "2026-08-29T10:00:00.000Z",
  firstPublishedAt: "2026-08-28T10:00:00.000Z",
  themes: [{ id: "theme-1", slug: "forest", title: "Лес" }],
  collection: {
    id: "collection-1",
    slug: "forest",
    title: "Загадочный лес",
    product: {
      id: "product-1",
      slug: "forest-album",
      title: "Лесной альбом",
      category: { id: "category-1", slug: "albums", title: "Альбомы" },
    },
  },
  palette: { label: "Artmate", version: "2026.1", usedColorCount: 12, colors: [] },
  width: 1200,
  height: 1600,
  outline: {
    url: "https://api.example.test/colorings/forest/01/assets/revision-2/outline/content",
    alt: "Контур лисы и совы",
  },
  colored: {
    url: "https://api.example.test/colorings/forest/01/assets/revision-2/colored/content",
    alt: "Лиса и сова в цвете",
  },
};
const constantsMock = {
  companyDetails: { supportEmail: "support@example.test" },
  externalLinks: {
    marketplaces: { ozon: "https://ozon.example", wildberries: "https://wb.example" },
    social: { telegramOfficial: "https://t.me/example" },
  },
  getAbsoluteUrl: (path) => new URL(path, siteUrl).toString(),
  routes,
  siteConfig: {
    description: "Artmate",
    locale: "ru_RU",
    logo: "/logo.svg",
    name: "Artmate",
    ogImage: "/og.png",
    url: siteUrl,
  },
};

async function loadMetadata() {
  return evaluateTypeScript(await readSource("src/shared/lib/seo/metadata.ts"), {
    "@/shared/constants": constantsMock,
    "./keywords": { getSeoKeywords: () => [] },
    "./registry": { seoPages: {} },
    "./text": {
      createCategoryDescription: () => "category",
      createColoringSeoDescription: (collectionTitle, number) =>
        `Картина ${number} из цифровой версии раскраски «${collectionTitle}»: контур и цветной пример в палитре маркеров Artmate.`,
      createColoringSeoTitle: (collectionTitle, number) =>
        `Цифровая версия раскраски «${collectionTitle}». Картина ${number}`,
      createProductDescription: () => "product",
    },
  });
}

async function loadStructuredData() {
  return evaluateTypeScript(await readSource("src/shared/lib/seo/structured-data.tsx"), {
    "@/shared/constants": constantsMock,
    "./text": {
      createCategoryDescription: () => "category",
      createColoringSeoDescription: (collectionTitle, number) =>
        `Картина ${number} из цифровой версии раскраски «${collectionTitle}»: контур и цветной пример в палитре маркеров Artmate.`,
      createColoringSeoTitle: (collectionTitle, number) =>
        `Цифровая версия раскраски «${collectionTitle}». Картина ${number}`,
      createProductDescription: () => "product",
      normalizeSeoText: (value) => value,
    },
  });
}

test("createColoringMetadata uses its own canonical and only the intrinsic colored social image", async () => {
  const { createColoringMetadata } = await loadMetadata();
  const metadata = createColoringMetadata(coloring);

  assert.equal(metadata.title.absolute, "Цифровая версия раскраски «Загадочный лес». Картина 1");
  assert.equal(
    metadata.description,
    "Картина 1 из цифровой версии раскраски «Загадочный лес»: контур и цветной пример в палитре маркеров Artmate.",
  );
  assert.equal(
    metadata.alternates.canonical,
    routes.coloring(coloring.collection.slug, coloring.number),
  );
  assert.equal(metadata.openGraph.url, routes.coloring(coloring.collection.slug, coloring.number));
  assert.equal(metadata.openGraph.title, metadata.title.absolute);
  assert.equal(metadata.twitter.title, metadata.title.absolute);
  assert.deepEqual(metadata.openGraph.images, [
    {
      url: coloring.colored.url,
      width: coloring.width,
      height: coloring.height,
      alt: coloring.colored.alt,
    },
  ]);
  assert.deepEqual(metadata.twitter.images, metadata.openGraph.images);
  assert.doesNotMatch(JSON.stringify(metadata), /outline/);
});

test("coloring metadata does not change legacy social image shapes", async () => {
  const { createProductMetadata } = await loadMetadata();
  const product = {
    image: "https://api.example.test/uploads/products/album.webp",
    price: 1990,
    slug: "forest-album",
    title: "Лесной альбом",
  };
  const category = {
    image: "https://api.example.test/uploads/categories/albums.webp",
    slug: "albums",
    title: "Альбомы",
  };
  const metadata = createProductMetadata(product, category);

  assert.deepEqual(metadata.openGraph.images, [
    {
      url: product.image,
      width: 900,
      height: 1200,
      alt: product.title,
    },
  ]);
  assert.deepEqual(metadata.twitter.images, [product.image]);
});

test("ColoringStructuredData emits the bounded five-node public graph", async () => {
  const { ColoringStructuredData } = await loadStructuredData();
  const markup = renderToStaticMarkup(ColoringStructuredData({ coloring }));
  const json = markup.match(/<script[^>]*>(.*)<\/script>/)?.[1];

  assert.ok(json);
  const data = JSON.parse(json);
  assert.equal(data["@context"], "https://schema.org");
  assert.deepEqual(
    data["@graph"].map((node) => node["@type"]),
    ["WebPage", "VisualArtwork", "ImageObject", "ImageObject", "BreadcrumbList"],
  );

  const [webPage, artwork, outline, coloredImage, breadcrumbs] = data["@graph"];
  const coloringUrl = `${siteUrl}${routes.coloring(coloring.collection.slug, coloring.number)}`;
  const productUrl = `${siteUrl}${routes.product(
    coloring.collection.product.category.slug,
    coloring.collection.product.slug,
  )}`;
  const collectionUrl = `${siteUrl}${routes.coloringCollection(coloring.collection.slug)}`;

  assert.equal(webPage.url, coloringUrl);
  assert.equal(webPage.name, "Цифровая версия раскраски «Загадочный лес». Картина 1");
  assert.equal(artwork.name, webPage.name);
  assert.equal(webPage.datePublished, coloring.firstPublishedAt);
  assert.equal(webPage.dateModified, coloring.publishedAt);
  assert.equal(artwork.datePublished, coloring.firstPublishedAt);
  assert.equal(artwork.dateModified, coloring.publishedAt);
  assert.deepEqual(artwork.isPartOf, {
    "@type": "CreativeWork",
    name: coloring.collection.title,
    url: collectionUrl,
    isPartOf: {
      "@type": "Product",
      name: coloring.collection.product.title,
      url: productUrl,
    },
  });
  assert.deepEqual(
    [outline.contentUrl, coloredImage.contentUrl],
    [coloring.outline.url, coloring.colored.url],
  );
  assert.deepEqual(
    [outline.width, outline.height, outline.caption],
    [coloring.width, coloring.height, coloring.outline.alt],
  );
  assert.deepEqual(breadcrumbs.itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: `${siteUrl}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Цифровые версии",
      item: `${siteUrl}${routes.colorings}`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: coloring.collection.title,
      item: collectionUrl,
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Картина 1",
      item: coloringUrl,
    },
  ]);

  const serialized = JSON.stringify(data);
  assert.equal((serialized.match(/https:\/\/api\.example\.test\/colorings/g) ?? []).length, 2);
  assert.doesNotMatch(serialized, /Offer|private|checksum|status/i);
});

test("ColoringStructuredData links an uncategorized product through its canonical fallback", async () => {
  const { ColoringStructuredData } = await loadStructuredData();
  const uncategorized = {
    ...coloring,
    collection: {
      ...coloring.collection,
      product: { ...coloring.collection.product, category: undefined },
    },
  };
  const markup = renderToStaticMarkup(ColoringStructuredData({ coloring: uncategorized }));
  const data = JSON.parse(markup.match(/<script[^>]*>(.*)<\/script>/)[1]);
  const artwork = data["@graph"].find((node) => node["@type"] === "VisualArtwork");

  assert.deepEqual(artwork.isPartOf, {
    "@type": "CreativeWork",
    name: coloring.collection.title,
    url: `${siteUrl}${routes.coloringCollection(coloring.collection.slug)}`,
    isPartOf: {
      "@type": "Product",
      name: coloring.collection.product.title,
      url: `${siteUrl}${routes.product(undefined, coloring.collection.product.slug)}`,
    },
  });
  assert.match(JSON.stringify(data), /catalog\/raskraski\/forest-album/);
});

test("ColoringCollectionStructuredData links list items by public number, not position", async () => {
  const { ColoringCollectionStructuredData } = await loadStructuredData();
  const collection = {
    cover: { url: "https://api.example.test/cover.webp", width: 900, height: 1200 },
    lastModified: coloring.publishedAt,
    product: coloring.collection.product,
    slug: coloring.collection.slug,
    title: coloring.collection.title,
    colorings: [
      {
        card: {
          url: "https://api.example.test/colorings/forest/07/card/content",
          width: 480,
          height: 640,
        },
        number: 7,
        position: 42,
        title: coloring.title,
      },
    ],
  };
  const markup = renderToStaticMarkup(ColoringCollectionStructuredData({ collection }));
  const data = JSON.parse(markup.match(/<script[^>]*>(.*)<\/script>/)[1]);
  const itemList = data.find((node) => node["@type"] === "ItemList");

  assert.deepEqual(itemList.itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Картина 7",
      url: `${siteUrl}/raskraski/digital/forest/07`,
      image: collection.colorings[0].card.url,
    },
  ]);
});

test("coloring route shares builder semantics for metadata and page, renders JSON-LD, and hydrates", async () => {
  const source = await readSource(
    "app/(site)/raskraski/digital/[collectionSlug]/[number]/page.tsx",
  );

  assert.match(source, /export async function generateMetadata/);
  assert.equal(
    (
      source.match(
        /new ColoringDataBuilder\(\)[\s\S]*?\.withColoring\(collectionSlug, number\)[\s\S]*?\.build\(\)/g,
      ) ?? []
    ).length,
    2,
  );
  assert.equal((source.match(/parseColoringNumber\(numberSegment\)/g) ?? []).length, 2);
  assert.match(source, /if \(coloring === null\) \{\s*return \{\};\s*\}/);
  assert.match(source, /return createColoringMetadata\(coloring\)/);
  assert.match(source, /<ColoringStructuredData coloring=\{coloring\}/);
  assert.match(source, /<HydrationBoundary state=\{dehydrateQueryClient\(queryClient\)\}>/);
  assert.match(source, /if \(coloring === null\) \{\s*notFound\(\);\s*\}/);
  assert.doesNotMatch(source, /catch\s*\(/);
});

async function loadSitemap(actionResults) {
  const source = await readSource("app/sitemap.ts");
  const actions = {
    getBlogPosts: async () => actionResults.blog,
    getCatalogLandingPages: async () => actionResults.landings,
    getProductsData: async () => actionResults.products,
    getPublicColoringsManifest: async () => actionResults.colorings,
    getPublicColoringCollections: async () => actionResults.collections,
  };

  return evaluateTypeScript(source, {
    "@/entities/products": { getProductCategory: () => undefined },
    "@/shared/actions/blog": { getBlogPosts: actions.getBlogPosts },
    "@/shared/actions/catalog-landings": {
      getCatalogLandingPages: actions.getCatalogLandingPages,
    },
    "@/shared/actions/colorings": {
      getPublicColoringsManifest: actions.getPublicColoringsManifest,
    },
    "@/shared/actions/coloring-collections": {
      getPublicColoringCollections: actions.getPublicColoringCollections,
    },
    "@/shared/actions/products": { getProductsData: actions.getProductsData },
    "@/shared/constants": {
      getAbsoluteUrl: constantsMock.getAbsoluteUrl,
      routes: {
        ...routes,
        blog: "/blog",
        blogPost: (slug) => `/blog/${slug}`,
        catalogCategory: (slug) => `/catalog/raskraski/${slug}`,
        catalogLanding: (slug) => `/catalog/podborki/${slug}`,
        contacts: "/contacts",
        faq: "/faq",
        legal: {
          cookiePolicy: "/legal/cookies",
          personalDataConsent: "/legal/consent",
          privacyPolicy: "/legal/privacy",
          publicOffer: "/legal/offer",
          returnPolicy: "/legal/returns",
          userAgreement: "/legal/agreement",
        },
        paymentAndDelivery: "/payment-and-delivery",
      },
    },
    "@/shared/lib/api-result": {
      ensureApiResult: (result) => {
        if (result.status === "error") {
          throw new Error(result.error.message);
        }

        return result;
      },
    },
  }).default;
}

const successfulSitemapActions = {
  blog: { status: "success", data: { items: [] } },
  landings: { status: "success", data: [] },
  products: { status: "success", data: { categories: [], products: [] } },
  colorings: {
    status: "success",
    data: [
      { collectionSlug: "forest", number: 1, lastModified: "2026-08-29T12:34:56.000Z" },
      { collectionSlug: "forest", number: 12, lastModified: "2026-08-28T01:02:03.000Z" },
    ],
  },
  collections: {
    status: "success",
    data: [
      {
        slug: "forest",
        lastModified: "2026-08-29T14:00:00.000Z",
      },
    ],
  },
};

test("sitemap adds only public manifest coloring routes with API modification dates", async () => {
  const sitemap = await loadSitemap(successfulSitemapActions);
  const result = await sitemap();
  const coloringRoutes = result.filter((entry) => entry.url.includes("/raskraski/"));

  assert.deepEqual(coloringRoutes, [
    {
      url: `${siteUrl}/raskraski/digital/forest`,
      lastModified: new Date("2026-08-29T14:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/raskraski/digital/forest/01`,
      lastModified: new Date("2026-08-29T12:34:56.000Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/raskraski/digital/forest/12`,
      lastModified: new Date("2026-08-28T01:02:03.000Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ]);
});

test("sitemap rejects manifest errors instead of silently omitting coloring routes", async () => {
  const sitemap = await loadSitemap({
    ...successfulSitemapActions,
    colorings: { status: "error", error: { message: "manifest unavailable", status: 503 } },
  });

  await assert.rejects(() => sitemap(), /manifest unavailable/);
});
