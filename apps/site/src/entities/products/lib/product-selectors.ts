import type { Product, ProductCategory } from "../model/types";

export function getProductCategory(categories: readonly ProductCategory[], categoryId?: string) {
  return categories.find((category) => category.id === categoryId);
}

export function getProductCategoryBySlug(categories: readonly ProductCategory[], slug?: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductById(products: readonly Product[], id: string) {
  return products.find((product) => product.id === id);
}

export function getProductBySlug(products: readonly Product[], slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(products: readonly Product[], product: Product, limit = 4) {
  const candidates = products.filter((candidate) => candidate.id !== product.id);
  const sameCategory = candidates.filter((candidate) => candidate.categoryId === product.categoryId);
  const otherCategories = candidates.filter(
    (candidate) => candidate.categoryId !== product.categoryId,
  );
  const sameCategoryLimit =
    sameCategory.length > 0 && otherCategories.length > 0 ? Math.max(limit - 1, 0) : limit;

  return [...sameCategory.slice(0, sameCategoryLimit), ...otherCategories].slice(0, limit);
}
