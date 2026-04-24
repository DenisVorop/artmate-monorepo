export {
  getProductById,
  getProductBySlug,
  getProductCategory,
  getProductCategoryBySlug,
  getRelatedProducts,
} from "./lib";
export type { Product, ProductCategory, ProductHighlight, ProductsData } from "./model";
export { productsQuery, useProductsData } from "./model";
export type { ProductsDataResult } from "./model";
export { DetailsTabs } from "./ui/details-tabs";
export { Gallery } from "./ui/gallery";
export { Highlights } from "./ui/highlights";
export { ProductCard } from "./ui/product-card";
export { Related } from "./ui/related";
export { Summary } from "./ui/summary";
