export {
  createBlogPostMetadata,
  createCategoryMetadata,
  createLegalMetadata,
  createPageMetadata,
  createProductMetadata,
  createRootMetadata,
} from "./metadata";
export { seoPages } from "./registry";
export { createCategoryDescription, createProductDescription, normalizeSeoText } from "./text";
export {
  BlogPostStructuredData,
  CatalogCategoryStructuredData,
  FaqStructuredData,
  ProductStructuredData,
  RootStructuredData,
} from "./structured-data";
export type {
  LegalSeoInput,
  SeoBlogArticleContent,
  SeoBlogPost,
  SeoCategory,
  SeoFaqSection,
  SeoPageKey,
  SeoProduct,
} from "./types";
