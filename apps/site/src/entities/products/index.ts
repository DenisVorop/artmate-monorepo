export {
  CATEGORIES,
  PRODUCTS,
  PRODUCT_HIGHLIGHTS,
  PRODUCT_HOW_IT_WORKS,
  PRODUCT_SPECS,
  getProductById,
  getProductBySlug,
  getProductCategory,
  getProductCategoryBySlug,
  getRelatedProducts,
} from "./model";
export type { Product, ProductCategory } from "./model";
export { DetailsTabs } from "./ui/details-tabs";
export { Gallery } from "./ui/gallery";
export { Highlights } from "./ui/highlights";
export { ProductCard } from "./ui/product-card";
export { Related } from "./ui/related";
export { Summary } from "./ui/summary";
