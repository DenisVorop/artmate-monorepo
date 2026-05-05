import {
  companyDetails,
  externalLinks,
  getAbsoluteUrl,
  routes,
  siteConfig,
} from "@/shared/constants";

import { createCategoryDescription, createProductDescription, normalizeSeoText } from "./text";
import type {
  SeoBlogArticleContent,
  SeoBlogPost,
  SeoCategory,
  SeoFaqSection,
  SeoProduct,
} from "./types";

const rootStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: ["ARTMATE", "Артмейт"],
    url: siteConfig.url,
    logo: getAbsoluteUrl(siteConfig.logo),
    sameAs: [externalLinks.social.telegramOfficial],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: companyDetails.supportEmail,
        availableLanguage: ["ru"],
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "ru-RU",
    description: siteConfig.description,
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

type FaqStructuredDataProps = {
  sections: readonly SeoFaqSection[];
};

type BlogPostStructuredDataProps = {
  content: SeoBlogArticleContent;
  post: SeoBlogPost;
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

function StructuredData({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function getProductStructuredData(product: SeoProduct, url: string, category?: SeoCategory) {
  const productUrl = getAbsoluteUrl(url);
  const productCategoryTitle = product.category ?? category?.title ?? "Раскраски по номерам";
  const productImages =
    product.images && product.images.length > 0 ? product.images : [product.image];

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: createProductDescription(product),
      image: productImages.map(getAbsoluteUrl),
      brand: {
        "@type": "Brand",
        name: siteConfig.name,
      },
      category: productCategoryTitle,
      itemCondition: "https://schema.org/NewCondition",
      sku: product.sku ?? product.id ?? product.slug,
      url: productUrl,
      offers: {
        "@type": "Offer",
        availability: product.availability ?? "https://schema.org/InStock",
        hasMerchantReturnPolicy: getMerchantReturnPolicyStructuredData(),
        price: product.price,
        priceCurrency: "RUB",
        seller: {
          "@type": "Organization",
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

  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      image: [getAbsoluteUrl(post.image)],
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt ?? post.publishedAt ?? post.createdAt,
      author: {
        "@type": "Person",
        name: post.author?.name ?? siteConfig.name,
      },
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
        logo: {
          "@type": "ImageObject",
          url: getAbsoluteUrl(siteConfig.logo),
        },
      },
      articleSection: post.category,
      keywords: post.tags,
      mainEntityOfPage: postUrl,
      url: postUrl,
      articleBody: getArticleBody(content),
    },
    getBreadcrumbStructuredData([
      { name: "Главная", url: routes.home },
      { name: "Блог", url: routes.blog },
      { name: post.title, url: routes.blogPost(post.slug) },
    ]),
  ];
}

type BreadcrumbItem = {
  name: string;
  url: string;
};

function getBreadcrumbStructuredData(items: readonly BreadcrumbItem[], id?: string) {
  return {
    "@context": "https://schema.org",
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
