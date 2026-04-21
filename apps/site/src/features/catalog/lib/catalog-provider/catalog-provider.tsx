"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, PRODUCTS, getProductCategory } from "@/entities/products";
import {
  filterProducts,
  formatCount,
  getHref,
  normalizeCategoryId,
  type SortValue,
} from "../catalog-state";
import { CatalogContext, type CatalogContextValue } from "./catalog.context";

type CatalogProviderProps = {
  initialCategoryId?: string;
  children: ReactNode;
};

export function CatalogProvider({ initialCategoryId, children }: CatalogProviderProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(() => normalizeCategoryId(initialCategoryId));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("featured");
  const [onlyBestsellers, setOnlyBestsellers] = useState(false);

  useEffect(() => {
    setCategoryId(normalizeCategoryId(initialCategoryId));
  }, [initialCategoryId]);

  const filteredProducts = useMemo(
    () =>
      filterProducts(PRODUCTS, {
        categoryId,
        query,
        sortBy,
        onlyBestsellers,
      }),
    [categoryId, onlyBestsellers, query, sortBy],
  );

  const setCategory = useCallback(
    (nextCategoryId?: string) => {
      const normalized = normalizeCategoryId(nextCategoryId);

      setCategoryId(normalized);
      router.replace(getHref(normalized), { scroll: false });
    },
    [router],
  );

  const clearQuery = useCallback(() => setQuery(""), []);
  const clearCategory = useCallback(() => setCategory(undefined), [setCategory]);
  const clearBestsellers = useCallback(() => setOnlyBestsellers(false), []);

  const clearAll = useCallback(() => {
    setCategoryId(undefined);
    setQuery("");
    setSortBy("featured");
    setOnlyBestsellers(false);
    router.replace(getHref(), { scroll: false });
  }, [router]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      categories: CATEGORIES,
      products: PRODUCTS,
      filteredProducts,
      activeCategory: getProductCategory(categoryId),
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
      filteredProducts,
      onlyBestsellers,
      query,
      setCategory,
      sortBy,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
