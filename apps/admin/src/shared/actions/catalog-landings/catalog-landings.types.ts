import type { ProductDTO } from "@/shared/actions/products";

export const catalogLandingStatuses = ["draft", "published", "archived"] as const;
export type CatalogLandingStatusDTO = (typeof catalogLandingStatuses)[number];

export const catalogLandingProductSources = ["manual", "tags", "mixed"] as const;
export type CatalogLandingProductSourceDTO = (typeof catalogLandingProductSources)[number];

export const catalogLandingTagRuleModes = ["required", "optional", "excluded"] as const;
export type CatalogLandingTagRuleModeDTO = (typeof catalogLandingTagRuleModes)[number];

export const catalogLandingProductOverrideModes = ["included", "excluded"] as const;
export type CatalogLandingProductOverrideModeDTO =
  (typeof catalogLandingProductOverrideModes)[number];

export type CatalogLandingTagRuleDTO = {
  tagId: string;
  mode: CatalogLandingTagRuleModeDTO;
  tag: ProductDTO["tags"][number];
};

export type CatalogLandingProductOverrideDTO = {
  productId: string;
  mode: CatalogLandingProductOverrideModeDTO;
  sortOrder: number;
  product: ProductDTO;
};

export type CatalogLandingFaqItemDTO = {
  id: string;
  question: string;
  answerHtml: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogLandingPageDTO = {
  id: string;
  slug: string;
  status: CatalogLandingStatusDTO;
  isIndexable: boolean;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introHtml?: string;
  seoTitle?: string;
  seoHtml?: string;
  productSource: CatalogLandingProductSourceDTO;
  minProducts: number;
  tagRules: CatalogLandingTagRuleDTO[];
  productOverrides: CatalogLandingProductOverrideDTO[];
  faqItems: CatalogLandingFaqItemDTO[];
  products: ProductDTO[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogLandingTagRuleInputDTO = {
  tagId: string;
  mode: CatalogLandingTagRuleModeDTO;
};

export type CatalogLandingProductOverrideInputDTO = {
  productId: string;
  mode: CatalogLandingProductOverrideModeDTO;
  sortOrder: number;
};

export type CatalogLandingFaqItemInputDTO = {
  question: string;
  answerHtml: string;
  sortOrder: number;
};

export type CreateCatalogLandingPageInputDTO = {
  slug: string;
  status?: CatalogLandingStatusDTO;
  isIndexable?: boolean;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introHtml?: string;
  seoTitle?: string;
  seoHtml?: string;
  productSource?: CatalogLandingProductSourceDTO;
  minProducts?: number;
  tagRules?: CatalogLandingTagRuleInputDTO[];
  productOverrides?: CatalogLandingProductOverrideInputDTO[];
  faqItems?: CatalogLandingFaqItemInputDTO[];
};

export type UpdateCatalogLandingPageInputDTO = Partial<CreateCatalogLandingPageInputDTO>;
