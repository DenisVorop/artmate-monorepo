import type { ApiProductDTO, Product } from "@/shared/actions/products";

export type CatalogLandingStatus = "draft" | "published" | "archived";
export type CatalogLandingProductSource = "manual" | "tags" | "mixed";

export type CatalogLandingFaqItem = {
  id: string;
  question: string;
  answerHtml: string;
  sortOrder: number;
};

export type CatalogLandingPage = {
  id: string;
  slug: string;
  status: CatalogLandingStatus;
  isIndexable: boolean;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introHtml?: string;
  seoTitle?: string;
  seoHtml?: string;
  productSource: CatalogLandingProductSource;
  minProducts: number;
  faqItems: CatalogLandingFaqItem[];
  products: Product[];
  createdAt: string;
  updatedAt: string;
};

export type ApiCatalogLandingFaqItemDTO = {
  id: string;
  question: string;
  answerHtml: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiCatalogLandingPageDTO = {
  id: string;
  slug: string;
  status: CatalogLandingStatus;
  isIndexable: boolean;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introHtml?: string;
  seoTitle?: string;
  seoHtml?: string;
  productSource: CatalogLandingProductSource;
  minProducts: number;
  faqItems: ApiCatalogLandingFaqItemDTO[];
  products: ApiProductDTO[];
  createdAt: string;
  updatedAt: string;
};
