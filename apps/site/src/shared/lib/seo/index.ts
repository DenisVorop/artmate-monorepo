export {
  createBlogPostMetadata,
  createCatalogLandingMetadata,
  createCategoryMetadata,
  createColoringCollectionMetadata,
  createColoringCollectionsMetadata,
  createColoringMetadata,
  createLegalMetadata,
  createPageMetadata,
  createProductMetadata,
  createRootMetadata,
} from "./metadata";
export { seoPages } from "./registry";
export { Seo } from "./service";
export {
  createCategoryDescription,
  createColoringSeoDescription,
  createColoringSeoTitle,
  createProductDescription,
  normalizeSeoText,
} from "./text";
export {
  BlogPostStructuredData,
  CatalogLandingStructuredData,
  CatalogCategoryStructuredData,
  ColoringCollectionStructuredData,
  ColoringCollectionsStructuredData,
  ColoringStructuredData,
  FaqStructuredData,
  ProductStructuredData,
  RootStructuredData,
} from "./structured-data";
export type {
  LegalSeoInput,
  SeoBlogArticleContent,
  SeoBlogPost,
  SeoCatalogLanding,
  SeoCategory,
  SeoColoring,
  SeoColoringCollection,
  SeoColoringCollectionSummary,
  SeoFaqSection,
  SeoPageKey,
  SeoProduct,
} from "./types";
