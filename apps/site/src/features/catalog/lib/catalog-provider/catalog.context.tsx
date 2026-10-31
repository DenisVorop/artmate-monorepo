"use client";

import { createContext, type ReactNode } from "react";
import type { Product, ProductTag } from "@/entities/products";
import type {
  CatalogCategory,
  CatalogCategoryValue,
  CatalogFacet,
  FiltersState,
} from "../catalog-state";

export type CatalogProductPlacement = "catalog" | "catalog_search_suggestions";
export type CatalogContextValue = FiltersState & {
  categories: readonly CatalogCategory[];
  products: readonly Product[];
  filteredProducts: Product[];
  suggestedProducts: Product[];
  facets: CatalogFacet[];
  selectedTags: ProductTag[];
  activeCategory?: CatalogCategory;
  categoryId?: string;
  countLabel: string;
  hasFilters: boolean;
  filterCount: number;
  updateFilters: (_patch: Partial<FiltersState>) => void;
  setQuery: (_query: string) => void;
  setCategory: (_categoryId?: CatalogCategoryValue) => void;
  getCategoryHref: (_category?: CatalogCategoryValue) => string;
  toggleTag: (_slug: string) => void;
  clearFilters: () => void;
  clearAll: () => void;
  renderProductCard?: (
    _product: Product,
    _index: number,
    _placement: CatalogProductPlacement,
  ) => ReactNode;
};
export const CatalogContext = createContext<CatalogContextValue | null>(null);
