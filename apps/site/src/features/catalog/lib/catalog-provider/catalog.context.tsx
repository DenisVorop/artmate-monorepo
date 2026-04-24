"use client";

import { createContext } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import type { SortValue } from "../catalog-state";

export type CatalogContextValue = {
  categories: readonly ProductCategory[];
  products: readonly Product[];
  filteredProducts: Product[];
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
  activeCategory?: ProductCategory;
  categoryId?: string;
  query: string;
  onlyBestsellers: boolean;
  sortBy: SortValue;
  countLabel: string;
  hasFilters: boolean;
  setQuery: (_query: string) => void;
  setCategory: (_categoryId?: string) => void;
  setOnlyBestsellers: (_value: boolean) => void;
  setSortBy: (_sortBy: SortValue) => void;
  clearQuery: () => void;
  clearCategory: () => void;
  clearBestsellers: () => void;
  clearAll: () => void;
};

export const CatalogContext = createContext<CatalogContextValue | null>(null);
