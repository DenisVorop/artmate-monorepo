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
  | "product"
  | "raskraski";

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

export type SeoProduct = {
  category?: string;
  description?: string;
  image: string;
  images?: readonly string[];
  price: number;
  slug: string;
  title: string;
};

export type SeoBlogPost = {
  category: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  slug: string;
  tags: readonly string[];
  title: string;
};

export type MetadataInput = SeoPageConfig & {
  ogType?: "article" | "website";
};
