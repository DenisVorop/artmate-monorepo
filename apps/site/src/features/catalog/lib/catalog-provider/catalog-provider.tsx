"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { getProductCategory, type Product, type ProductCategory } from "@/entities/products";
import { useQueryState, type SearchParams } from "@/shared/lib/query-state-manager";
import {
  formatCount,
  getCatalogFacets,
  getCatalogParams,
  getCatalogSearchResult,
  getCatalogHrefWithFilters,
  getCatalogCategories,
  getProductCatalogCategory,
  matchesCatalogCategory,
  type CatalogCategoryValue,
  normalizeCategoryId,
  readCatalogFilters,
  type FiltersState,
} from "../catalog-state";
import {
  CatalogContext,
  type CatalogContextValue,
  type CatalogProductPlacement,
} from "./catalog.context";

type CatalogProviderProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  renderProductCard?: (
    _product: Product,
    _index: number,
    _placement: CatalogProductPlacement,
  ) => ReactNode;
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
  const [params, { addMany }] = useQueryState<SearchParams>();
  const urlFilters = useMemo(() => readCatalogFilters(params, products), [params, products]);
  const urlSignature = JSON.stringify(getCatalogParams(urlFilters));
  const [filters, setFilters] = useState(urlFilters);
  const currentFilters = useRef(filters);
  const pendingSignature = useRef<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [categoryId, setCategoryId] = useState(() =>
    normalizeCategoryId(categories, initialCategoryId),
  );

  useEffect(() => {
    setCategoryId(normalizeCategoryId(categories, initialCategoryId));
  }, [categories, initialCategoryId]);
  useEffect(() => {
    if (pendingSignature.current && pendingSignature.current !== urlSignature) return;
    pendingSignature.current = null;
    currentFilters.current = urlFilters;
    setFilters(urlFilters);
  }, [urlFilters, urlSignature]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const updateFilters = useCallback(
    (patch: Partial<FiltersState>) => {
      clearTimeout(searchTimer.current);
      const next = { ...currentFilters.current, ...patch };
      currentFilters.current = next;
      setFilters(next);
      pendingSignature.current = JSON.stringify(getCatalogParams(next));
      const commit = () => addMany(getCatalogParams(next));
      if (Object.keys(patch).length === 1 && "query" in patch)
        searchTimer.current = setTimeout(commit, 250);
      else commit();
    },
    [addMany],
  );

  const setCategory = useCallback(
    (value?: CatalogCategoryValue) => {
      clearTimeout(searchTimer.current);
      const availableTags = new Set(
        products
          .filter((product) =>
            matchesCatalogCategory(product, { ...currentFilters.current, category: value }),
          )
          .flatMap((product) => product.tags.map((tag) => tag.slug)),
      );
      const next = {
        ...currentFilters.current,
        category: value,
        tagSlugs: currentFilters.current.tagSlugs.filter((slug) => availableTags.has(slug)),
      };
      currentFilters.current = next;
      setFilters(next);
      setCategoryId(undefined);
      pendingSignature.current = JSON.stringify(getCatalogParams(next));
      router.replace(getCatalogHrefWithFilters(next, params) as Route, {
        scroll: false,
      });
    },
    [params, products, router],
  );

  const setQuery = useCallback((query: string) => updateFilters({ query }), [updateFilters]);
  const toggleTag = useCallback(
    (slug: string) => {
      const selected = currentFilters.current.tagSlugs;
      updateFilters({
        tagSlugs: selected.includes(slug)
          ? selected.filter((value) => value !== slug)
          : [...selected, slug],
      });
    },
    [updateFilters],
  );
  const clearFilters = useCallback(
    () =>
      updateFilters({
        onlyBestsellers: false,
        onlyAvailable: false,
        minPrice: undefined,
        maxPrice: undefined,
        tagSlugs: [],
      }),
    [updateFilters],
  );
  const clearAll = useCallback(
    () =>
      updateFilters({
        query: "",
        onlyBestsellers: false,
        onlyAvailable: false,
        minPrice: undefined,
        maxPrice: undefined,
        tagSlugs: [],
      }),
    [updateFilters],
  );

  const searchResult = useMemo(
    () => getCatalogSearchResult(products, { ...filters, categoryId }),
    [categoryId, filters, products],
  );
  const facets = useMemo(
    () => getCatalogFacets(products, { ...filters, categoryId }),
    [categoryId, filters, products],
  );
  const selectedTags = useMemo(
    () => [
      ...new Map(
        products
          .flatMap((product) => product.tags)
          .filter((tag) => filters.tagSlugs.includes(tag.slug))
          .map((tag) => [tag.slug, tag]),
      ).values(),
    ],
    [filters.tagSlugs, products],
  );
  const filterCount =
    filters.tagSlugs.length +
    Number(filters.onlyBestsellers) +
    Number(filters.onlyAvailable) +
    Number(filters.minPrice !== undefined || filters.maxPrice !== undefined);
  const catalogCategories = getCatalogCategories(products);
  const routeCategory = getProductCategory(categories, categoryId);
  const routeProduct = products.find((product) => product.categoryId === routeCategory?.id);
  const activeCategoryValue =
    filters.category ??
    (routeCategory && routeProduct ? getProductCatalogCategory(routeProduct) : undefined);
  const value: CatalogContextValue = {
    ...filters,
    categories: catalogCategories,
    products,
    categoryId,
    facets,
    selectedTags,
    renderProductCard,
    filteredProducts: searchResult.products,
    suggestedProducts: searchResult.suggestions,
    activeCategory: catalogCategories.find((category) => category.id === activeCategoryValue),
    countLabel: formatCount(searchResult.products.length),
    hasFilters: Boolean(filterCount),
    filterCount,
    updateFilters,
    setQuery,
    setCategory,
    toggleTag,
    clearFilters,
    clearAll,
  };
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
