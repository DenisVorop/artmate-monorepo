import { companyDetails, externalLinks, getAbsoluteUrl, siteConfig } from "@/shared/constants";

import { createProductDescription } from "./text";
import type { SeoProduct } from "./types";

const rootStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: ["ARTMATE", "Артмейт"],
    url: siteConfig.url,
    logo: getAbsoluteUrl(siteConfig.ogImage),
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
  product: SeoProduct;
  url: string;
};

export function RootStructuredData() {
  return <StructuredData data={rootStructuredData} />;
}

export function ProductStructuredData({ product, url }: ProductStructuredDataProps) {
  return <StructuredData data={getProductStructuredData(product, url)} />;
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

function getProductStructuredData(product: SeoProduct, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: createProductDescription(product),
    image: product.images && product.images.length > 0 ? product.images : [product.image],
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    category: product.category ?? "Раскраски по номерам",
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
      url: getAbsoluteUrl(url),
    },
  };
}
