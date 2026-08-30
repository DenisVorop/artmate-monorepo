import { filterXSS } from "xss";

import {
  companyDetails,
  externalLinks,
  getAbsoluteUrl,
  routes,
  siteConfig,
} from "@/shared/constants";

import {
  createCategoryDescription,
  createColoringSeoDescription,
  createColoringSeoTitle,
  createProductDescription,
  normalizeSeoText,
} from "./text";
import type {
  SeoBlogArticleContent,
  SeoBlogPost,
  SeoCategory,
  SeoColoring,
  SeoColoringCollection,
  SeoColoringCollectionSummary,
  SeoFaqSection,
  SeoProduct,
} from "./types";

const organizationId = `${siteConfig.url}#organization`;
const websiteId = `${siteConfig.url}#website`;
const structuredDataLogo = {
  "@type": "ImageObject",
  url: getAbsoluteUrl(siteConfig.logo),
  width: 123,
  height: 58,
};
const servedCountryStructuredData = {
  "@type": "Country",
  name: "Россия",
};

const rootStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: siteConfig.name,
    alternateName: ["ARTMATE", "Артмейт"],
    url: siteConfig.url,
    logo: structuredDataLogo,
    areaServed: servedCountryStructuredData,
    sameAs: [
      externalLinks.social.telegramOfficial,
      externalLinks.marketplaces.ozon,
      externalLinks.marketplaces.wildberries,
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: companyDetails.supportEmail,
        areaServed: servedCountryStructuredData,
        availableLanguage: ["ru"],
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "ru-RU",
    description: siteConfig.description,
    publisher: {
      "@id": organizationId,
    },
  },
];

type ProductStructuredDataProps = {
  category?: SeoCategory;
  product: SeoProduct;
  url: string;
};

type CatalogCategoryStructuredDataProps = {
  category: SeoCategory;
  products: readonly SeoProduct[];
  url: string;
};

type CatalogLandingStructuredDataProps = {
  description: string;
  products: readonly SeoProduct[];
  title: string;
  url: string;
};

type FaqStructuredDataProps = {
  sections: readonly SeoFaqSection[];
};

type BlogPostStructuredDataProps = {
  content: SeoBlogArticleContent;
  post: SeoBlogPost;
};

type ColoringStructuredDataProps = {
  coloring: SeoColoring;
};

type ColoringCollectionsStructuredDataProps = {
  collections: readonly SeoColoringCollectionSummary[];
};

type ColoringCollectionStructuredDataProps = {
  collection: SeoColoringCollection;
};

export function RootStructuredData() {
  return <StructuredData data={rootStructuredData} />;
}

export function ProductStructuredData({ category, product, url }: ProductStructuredDataProps) {
  return <StructuredData data={getProductStructuredData(product, url, category)} />;
}

export function CatalogCategoryStructuredData({
  category,
  products,
  url,
}: CatalogCategoryStructuredDataProps) {
  return <StructuredData data={getCatalogCategoryStructuredData(category, products, url)} />;
}

export function CatalogLandingStructuredData({
  description,
  products,
  title,
  url,
}: CatalogLandingStructuredDataProps) {
  return (
    <StructuredData data={getCatalogLandingStructuredData(title, description, products, url)} />
  );
}

export function FaqStructuredData({ sections }: FaqStructuredDataProps) {
  const items = sections.flatMap((section) => section.items);

  if (items.length === 0) {
    return null;
  }

  return <StructuredData data={getFaqStructuredData(sections)} />;
}

export function BlogPostStructuredData({ content, post }: BlogPostStructuredDataProps) {
  return <StructuredData data={getBlogPostStructuredData(post, content)} />;
}

export function ColoringStructuredData({ coloring }: ColoringStructuredDataProps) {
  return <StructuredData data={getColoringStructuredData(coloring)} />;
}

export function ColoringCollectionsStructuredData({
  collections,
}: ColoringCollectionsStructuredDataProps) {
  return <StructuredData data={getColoringCollectionsStructuredData(collections)} />;
}

export function ColoringCollectionStructuredData({
  collection,
}: ColoringCollectionStructuredDataProps) {
  return <StructuredData data={getColoringCollectionStructuredData(collection)} />;
}

function StructuredData({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

function serializeJsonLd(data: unknown) {
  return filterXSS(JSON.stringify(data), {
    escapeHtml: escapeJsonLdHtml,
    stripIgnoreTag: false,
    stripIgnoreTagBody: false,
    whiteList: {},
  }).replace(/[\u2028\u2029]/g, (char) => {
    switch (char) {
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}

function escapeJsonLdHtml(value: string) {
  return value.replace(/[<>&]/g, (char) => {
    switch (char) {
      case "<":
        return "\\u003C";
      case ">":
        return "\\u003E";
      case "&":
        return "\\u0026";
      default:
        return char;
    }
  });
}

function getProductStructuredData(product: SeoProduct, url: string, category?: SeoCategory) {
  const productUrl = getAbsoluteUrl(url);
  const productId = `${productUrl}#product`;
  const breadcrumbId = `${productUrl}#breadcrumbs`;
  const productCategoryTitle = product.category ?? category?.title ?? "Раскраски по номерам";
  const productImages =
    product.images && product.images.length > 0 ? product.images : [product.image];

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": productId,
      name: product.title,
      description: createProductDescription(product),
      image: productImages.map(getAbsoluteUrl),
      brand: {
        "@type": "Brand",
        name: siteConfig.name,
      },
      category: productCategoryTitle,
      countryOfOrigin: {
        "@type": "Country",
        name: "Россия",
      },
      material: "Бумага 190 г/м²",
      sku: product.sku ?? product.id ?? product.slug,
      url: productUrl,
      breadcrumb: {
        "@id": breadcrumbId,
      },
      offers: {
        "@type": "Offer",
        availability: getProductAvailability(product),
        hasMerchantReturnPolicy: getMerchantReturnPolicyStructuredData(),
        itemCondition: "https://schema.org/NewCondition",
        price: product.price,
        priceCurrency: "RUB",
        seller: {
          "@type": "Organization",
          "@id": organizationId,
          name: siteConfig.name,
          url: siteConfig.url,
        },
        url: productUrl,
      },
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Каталог", url: routes.catalog },
        category
          ? { name: category.title, url: routes.catalogCategory(category.slug) }
          : product.categorySlug && product.category
            ? { name: product.category, url: routes.catalogCategory(product.categorySlug) }
            : undefined,
        { name: product.title, url },
      ].filter(Boolean) as BreadcrumbItem[],
      breadcrumbId,
    ),
  ];
}

function getCatalogCategoryStructuredData(
  category: SeoCategory,
  products: readonly SeoProduct[],
  url: string,
) {
  const categoryUrl = getAbsoluteUrl(url);
  const itemListId = `${categoryUrl}#item-list`;
  const breadcrumbId = `${categoryUrl}#breadcrumb`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category.title} - раскраски по номерам Artmate`,
      description: createCategoryDescription(category.title),
      url: categoryUrl,
      breadcrumb: {
        "@id": breadcrumbId,
      },
      isPartOf: {
        "@type": "WebSite",
        name: siteConfig.name,
        url: siteConfig.url,
      },
      mainEntity: {
        "@id": itemListId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.title,
        url: getAbsoluteUrl(routes.product(category.slug, product.slug)),
        image: getAbsoluteUrl(product.image),
      })),
      numberOfItems: products.length,
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Каталог", url: routes.catalog },
        { name: category.title, url },
      ],
      breadcrumbId,
    ),
  ];
}

function getCatalogLandingStructuredData(
  title: string,
  description: string,
  products: readonly SeoProduct[],
  url: string,
) {
  const landingUrl = getAbsoluteUrl(url);
  const itemListId = `${landingUrl}#item-list`;
  const breadcrumbId = `${landingUrl}#breadcrumb`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: landingUrl,
      breadcrumb: {
        "@id": breadcrumbId,
      },
      isPartOf: {
        "@type": "WebSite",
        name: siteConfig.name,
        url: siteConfig.url,
      },
      mainEntity: {
        "@id": itemListId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.title,
        url: getAbsoluteUrl(routes.product(product.categorySlug, product.slug)),
        image: getAbsoluteUrl(product.image),
      })),
      numberOfItems: products.length,
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Каталог", url: routes.catalog },
        { name: title, url },
      ],
      breadcrumbId,
    ),
  ];
}

function getFaqStructuredData(sections: readonly SeoFaqSection[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sections.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    ),
  };
}

function getBlogPostStructuredData(post: SeoBlogPost, content: SeoBlogArticleContent) {
  const postUrl = getAbsoluteUrl(routes.blogPost(post.slug));
  const articleId = `${postUrl}#article`;
  const breadcrumbId = `${postUrl}#breadcrumbs`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": articleId,
      headline: post.title,
      description: post.metaDescription ?? post.excerpt,
      image: [getAbsoluteUrl(post.image)],
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt ?? post.publishedAt ?? post.createdAt,
      author: getBlogPostAuthorStructuredData(post),
      publisher: {
        "@type": "Organization",
        "@id": organizationId,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: structuredDataLogo,
      },
      articleSection: post.category,
      keywords: post.tags,
      inLanguage: "ru-RU",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": postUrl,
      },
      url: postUrl,
      breadcrumb: {
        "@id": breadcrumbId,
      },
      articleBody: getArticleBody(content),
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Блог", url: routes.blog },
        { name: post.title, url: routes.blogPost(post.slug) },
      ],
      breadcrumbId,
    ),
  ];
}

function getColoringStructuredData(coloring: SeoColoring) {
  const pagePath = routes.coloring(coloring.collection.slug, coloring.number);
  const pageUrl = getAbsoluteUrl(pagePath);
  const coloringName = `Картина ${coloring.number}`;
  const seoTitle = createColoringSeoTitle(coloring.collection.title, coloring.number);
  const seoDescription = createColoringSeoDescription(coloring.collection.title, coloring.number);
  const artworkId = `${pageUrl}#artwork`;
  const outlineImageId = `${pageUrl}#outline-image`;
  const coloredImageId = `${pageUrl}#colored-image`;
  const breadcrumbId = `${pageUrl}#breadcrumbs`;
  const category = coloring.collection.product.category;
  const product = coloring.collection.product;
  const collection = {
    "@type": "CreativeWork",
    name: coloring.collection.title,
    url: getAbsoluteUrl(routes.coloringCollection(coloring.collection.slug)),
    isPartOf: {
      "@type": "Product",
      name: product.title,
      url: getAbsoluteUrl(routes.product(category?.slug, product.slug)),
    },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: seoTitle,
        description: seoDescription,
        inLanguage: "ru-RU",
        datePublished: coloring.firstPublishedAt,
        dateModified: coloring.publishedAt,
        mainEntity: { "@id": artworkId },
        primaryImageOfPage: { "@id": coloredImageId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "VisualArtwork",
        "@id": artworkId,
        name: seoTitle,
        description: seoDescription,
        datePublished: coloring.firstPublishedAt,
        dateModified: coloring.publishedAt,
        image: [{ "@id": outlineImageId }, { "@id": coloredImageId }],
        isPartOf: collection,
      },
      {
        "@type": "ImageObject",
        "@id": outlineImageId,
        contentUrl: coloring.outline.url,
        width: coloring.width,
        height: coloring.height,
        caption: coloring.outline.alt,
      },
      {
        "@type": "ImageObject",
        "@id": coloredImageId,
        contentUrl: coloring.colored.url,
        width: coloring.width,
        height: coloring.height,
        caption: coloring.colored.alt,
      },
      getBreadcrumbStructuredData(
        [
          { name: "Главная", url: routes.home },
          { name: "Цифровые версии", url: routes.colorings },
          {
            name: coloring.collection.title,
            url: routes.coloringCollection(coloring.collection.slug),
          },
          { name: coloringName, url: pagePath },
        ],
        breadcrumbId,
        false,
      ),
    ],
  };
}

function getColoringCollectionsStructuredData(
  collections: readonly SeoColoringCollectionSummary[],
) {
  const pageUrl = getAbsoluteUrl(routes.colorings);
  const itemListId = `${pageUrl}#item-list`;
  const breadcrumbId = `${pageUrl}#breadcrumbs`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": pageUrl,
      name: "Цифровые версии раскрасок Artmate",
      description:
        "Тематики цифровых раскрасок с готовыми иллюстрациями в палитре маркеров Artmate.",
      url: pageUrl,
      inLanguage: "ru-RU",
      mainEntity: { "@id": itemListId },
      breadcrumb: { "@id": breadcrumbId },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      numberOfItems: collections.length,
      itemListElement: collections.map((collection, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: collection.title,
        url: getAbsoluteUrl(routes.coloringCollection(collection.slug)),
        image: collection.cover.url,
      })),
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Цифровые версии", url: routes.colorings },
      ],
      breadcrumbId,
    ),
  ];
}

function getColoringCollectionStructuredData(collection: SeoColoringCollection) {
  const path = routes.coloringCollection(collection.slug);
  const pageUrl = getAbsoluteUrl(path);
  const itemListId = `${pageUrl}#item-list`;
  const breadcrumbId = `${pageUrl}#breadcrumbs`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": pageUrl,
      name: collection.title,
      description:
        collection.description ??
        `Цифровые версии иллюстраций «${collection.title}» в палитре маркеров Artmate.`,
      url: pageUrl,
      image: collection.cover.url,
      dateModified: collection.lastModified,
      inLanguage: "ru-RU",
      mainEntity: { "@id": itemListId },
      breadcrumb: { "@id": breadcrumbId },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      numberOfItems: collection.colorings.length,
      itemListElement: collection.colorings.map((coloring, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `Картина ${coloring.number}`,
        url: getAbsoluteUrl(routes.coloring(collection.slug, coloring.number)),
        image: coloring.card.url,
      })),
    },
    getBreadcrumbStructuredData(
      [
        { name: "Главная", url: routes.home },
        { name: "Цифровые версии", url: routes.colorings },
        { name: collection.title, url: path },
      ],
      breadcrumbId,
    ),
  ];
}

function getBlogPostAuthorStructuredData(post: SeoBlogPost) {
  if (post.author?.name) {
    return {
      "@type": "Person",
      name: post.author.name,
    };
  }

  return {
    "@type": "Organization",
    "@id": organizationId,
    name: siteConfig.name,
    url: siteConfig.url,
  };
}

type BreadcrumbItem = {
  name: string;
  url: string;
};

function getBreadcrumbStructuredData(
  items: readonly BreadcrumbItem[],
  id?: string,
  includeContext = true,
) {
  return {
    ...(includeContext ? { "@context": "https://schema.org" } : {}),
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.url),
    })),
  };
}

function getMerchantReturnPolicyStructuredData() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "RU",
    merchantReturnDays: 7,
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    returnMethod: "https://schema.org/ReturnByMail",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    url: getAbsoluteUrl(routes.legal.returnPolicy),
  };
}

function getProductAvailability(product: SeoProduct) {
  if (product.availability) {
    return product.availability;
  }

  return product.isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
}

function getArticleBody(content: SeoBlogArticleContent) {
  return normalizeSeoText(
    content.blocks
      .flatMap((block) => {
        if (block.type === "heading" || block.type === "paragraph" || block.type === "quote") {
          return block.text ?? "";
        }

        if (block.type === "highlights" || block.type === "steps") {
          return block.items?.map((item) => `${item.title}. ${item.description}`).join(" ") ?? "";
        }

        if (block.type === "cta") {
          return [block.title, block.description].filter(Boolean).join(". ");
        }

        return "";
      })
      .join(" "),
  );
}
