export type SeoKeywordGroup = "blog" | "catalog" | "common" | "products";
export type SeoKeywordValue = SeoKeywordGroup | string | null | undefined;

export type SeoImage = {
  alt?: string;
  height: number;
  url: string;
  width: number;
};

export type SeoPageConfig = {
  canonical?: string;
  description: string;
  image?: SeoImage;
  keywords?: readonly SeoKeywordValue[];
  noindex?: boolean;
  ogAlt?: string;
  title: string;
};

export type SeoPageKey =
  | "account"
  | "auth"
  | "blog"
  | "cart"
  | "catalog"
  | "checkout"
  | "checkoutSuccess"
  | "contacts"
  | "faq"
  | "home"
  | "paymentAndDelivery"
  | "product";

export type LegalSeoInput = {
  description: string;
  href: string;
  title: string;
};

export type SeoCategory = {
  image: string;
  slug: string;
  title: string;
};

export type SeoFaqSection = {
  items: readonly {
    answer: string;
    question: string;
  }[];
};

export type SeoProduct = {
  availability?: string;
  category?: string;
  categorySlug?: string;
  description?: string;
  id?: string;
  image: string;
  images?: readonly string[];
  price: number;
  sku?: string;
  slug: string;
  title: string;
};

export type SeoBlogArticleContent = {
  blocks: readonly SeoBlogArticleBlock[];
};

export type SeoBlogArticleBlock = {
  description?: string;
  items?: readonly {
    description: string;
    title: string;
  }[];
  text?: string;
  title?: string;
  type: string;
};

export type SeoBlogPost = {
  author?: {
    name: string;
  };
  category: string;
  createdAt?: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  publishedAt?: string;
  slug: string;
  tags: readonly string[];
  title: string;
  updatedAt?: string;
};

export type MetadataInput = SeoPageConfig & {
  ogType?: "article" | "website";
};
