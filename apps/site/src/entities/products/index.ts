export {
  getProductById,
  getProductBySlug,
  getProductCategory,
  getProductCategoryBySlug,
  getRelatedProducts,
  emptyProductsData,
} from "./model";
export type { Product, ProductCategory, ProductHighlight, ProductsData } from "./model";
export { productsQuery } from "./model/query";
export type { ProductsDataResult } from "./model/query";
export { useProductsData } from "./model/use-products-data";
export { DetailsTabs } from "./ui/details-tabs";
export { Gallery } from "./ui/gallery";
export { Highlights } from "./ui/highlights";
export { ProductCard } from "./ui/product-card";
export { Related } from "./ui/related";
export { Summary } from "./ui/summary";
