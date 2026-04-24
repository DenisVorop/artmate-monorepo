"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getProductCategory, type Product, type ProductCategory } from "@/entities/products";
import {
  filterProducts,
  formatCount,
  getCatalogHref,
  normalizeCategoryId,
  type SortValue,
} from "../catalog-state";
import { CatalogContext, type CatalogContextValue } from "./catalog.context";

type CatalogProviderProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  children: ReactNode;
};

export function CatalogProvider({
  categories,
  products,
  initialCategoryId,
  children,
}: CatalogProviderProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(() => normalizeCategoryId(categories, initialCategoryId));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("featured");
  const [onlyBestsellers, setOnlyBestsellers] = useState(false);

  useEffect(() => {
    setCategoryId(normalizeCategoryId(categories, initialCategoryId));
  }, [categories, initialCategoryId]);

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, {
        categoryId,
        query,
        sortBy,
        onlyBestsellers,
      }),
    [categoryId, onlyBestsellers, products, query, sortBy],
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

  const clearAll = useCallback(() => {
    setCategoryId(undefined);
    setQuery("");
    setSortBy("featured");
    setOnlyBestsellers(false);
    router.replace(getCatalogHref(categories), { scroll: false });
  }, [categories, router]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      categories,
      products,
      filteredProducts,
      activeCategory: getProductCategory(categories, categoryId),
      categoryId,
      query,
      onlyBestsellers,
      sortBy,
      countLabel: formatCount(filteredProducts.length),
      hasFilters: Boolean(categoryId || query.trim() || onlyBestsellers),
      setQuery,
      setCategory,
      setOnlyBestsellers,
      setSortBy,
      clearQuery,
      clearCategory,
      clearBestsellers,
      clearAll,
    }),
    [
      categoryId,
      clearAll,
      clearBestsellers,
      clearCategory,
      clearQuery,
      categories,
      filteredProducts,
      onlyBestsellers,
      products,
      query,
      setCategory,
      sortBy,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
