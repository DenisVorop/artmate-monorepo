"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getProductCategory, type Product, type ProductCategory } from "@/entities/products";
import {
  formatCount,
  getCatalogHref,
  getCatalogSearchResult,
  normalizeCategoryId,
  type SortValue,
} from "../catalog-state";
import { CatalogContext, type CatalogContextValue } from "./catalog.context";

type CatalogProviderProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  renderProductCard?: (_product: Product, _index: number) => ReactNode;
  children: ReactNode;
};

export function CatalogProvider({
  categories,
  products,
  initialCategoryId,
  renderProductCard,
  children,
}: CatalogProviderProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(() =>
    normalizeCategoryId(categories, initialCategoryId),
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("featured");
  const [onlyBestsellers, setOnlyBestsellers] = useState(false);
  const [onlyPixel, setOnlyPixel] = useState(false);

  useEffect(() => {
    setCategoryId(normalizeCategoryId(categories, initialCategoryId));
  }, [categories, initialCategoryId]);

  const { products: filteredProducts, suggestions: suggestedProducts } = useMemo(
    () =>
      getCatalogSearchResult(products, {
        categoryId,
        query,
        sortBy,
        onlyBestsellers,
        onlyPixel,
      }),
    [categoryId, onlyBestsellers, onlyPixel, products, query, sortBy],
  );

  const setCategory = useCallback(
    (nextCategoryId?: string) => {
      const normalized = normalizeCategoryId(categories, nextCategoryId);

      setCategoryId(normalized);
      router.replace(getCatalogHref(categories, normalized), { scroll: false });
    },
    [categories, router],
  );

  const clearQuery = useCallback(() => setQuery(""), []);
  const clearCategory = useCallback(() => setCategory(undefined), [setCategory]);
  const clearBestsellers = useCallback(() => setOnlyBestsellers(false), []);
  const clearPixel = useCallback(() => setOnlyPixel(false), []);

  const clearAll = useCallback(() => {
    setCategoryId(undefined);
    setQuery("");
    setSortBy("featured");
    setOnlyBestsellers(false);
    setOnlyPixel(false);
    router.replace(getCatalogHref(categories), { scroll: false });
  }, [categories, router]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      categories,
      products,
      filteredProducts,
      suggestedProducts,
      renderProductCard,
      activeCategory: getProductCategory(categories, categoryId),
      categoryId,
      query,
      onlyBestsellers,
      onlyPixel,
      sortBy,
      countLabel: formatCount(filteredProducts.length),
      hasFilters: Boolean(categoryId || query.trim() || onlyBestsellers || onlyPixel),
      setQuery,
      setCategory,
      setOnlyBestsellers,
      setOnlyPixel,
      setSortBy,
      clearQuery,
      clearCategory,
      clearBestsellers,
      clearPixel,
      clearAll,
    }),
    [
      categoryId,
      clearAll,
      clearBestsellers,
      clearCategory,
      clearPixel,
      clearQuery,
      categories,
      filteredProducts,
      onlyBestsellers,
      onlyPixel,
      products,
      query,
      renderProductCard,
      setCategory,
      sortBy,
      suggestedProducts,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
