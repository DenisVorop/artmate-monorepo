"use client";

import { createContext, type ReactNode } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import type { SortValue } from "../catalog-state";

export type CatalogContextValue = {
  categories: readonly ProductCategory[];
  products: readonly Product[];
  filteredProducts: Product[];
  renderProductCard?: (_product: Product, _index: number) => ReactNode;
  activeCategory?: ProductCategory;
  categoryId?: string;
  query: string;
  onlyBestsellers: boolean;
  onlyPixel: boolean;
  sortBy: SortValue;
  countLabel: string;
  hasFilters: boolean;
  setQuery: (_query: string) => void;
  setCategory: (_categoryId?: string) => void;
  setOnlyBestsellers: (_value: boolean) => void;
  setOnlyPixel: (_value: boolean) => void;
  setSortBy: (_sortBy: SortValue) => void;
  clearQuery: () => void;
  clearCategory: () => void;
  clearBestsellers: () => void;
  clearPixel: () => void;
  clearAll: () => void;
};

export const CatalogContext = createContext<CatalogContextValue | null>(null);
