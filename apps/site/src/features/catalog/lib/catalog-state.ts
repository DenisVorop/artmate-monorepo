import Fuse, { type IFuseOptions } from "fuse.js";
import type { Product, ProductCategory } from "@/entities/products";
import { routes } from "@/shared/constants";

export type SortValue = "featured" | "newest" | "price-asc" | "price-desc";

export const sortOptions = [
  { value: "featured", label: "Рекомендуемые" },
  { value: "newest", label: "Новинки" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
] satisfies Array<{ value: SortValue; label: string }>;

export type FiltersState = {
  categoryId?: string;
  query: string;
  onlyBestsellers: boolean;
  onlyPixel: boolean;
  sortBy: SortValue;
};

type CatalogSearchItem = {
  product: Product;
  index: number;
};

const maxSearchSuggestions = 4;

const searchSuggestionOptions = {
  threshold: 0.36,
  ignoreLocation: true,
  ignoreDiacritics: true,
  keys: [
    {
      name: "title",
      weight: 0.85,
      getFn: ({ product }) => normalizeSearchText(product.title),
    },
    {
      name: "category",
      weight: 0.15,
      getFn: ({ product }) => normalizeSearchText(product.category ?? ""),
    },
    {
      name: "description",
      weight: 0.1,
      getFn: ({ product }) => normalizeSearchText(product.description),
    },
    {
      name: "slug",
      weight: 0.05,
      getFn: ({ product }) => normalizeSearchText(product.slug),
    },
  ],
} satisfies IFuseOptions<CatalogSearchItem>;

export type CatalogSearchResult = {
  products: Product[];
  suggestions: Product[];
};

export function normalizeCategoryId(
  categories: readonly ProductCategory[],
  categoryValue?: string,
) {
  return categories.find(
    (category) => category.id === categoryValue || category.slug === categoryValue,
  )?.id;
}

export function getCatalogHref(categories: readonly ProductCategory[], categoryId?: string) {
  const normalizedCategoryId = normalizeCategoryId(categories, categoryId);

  if (!normalizedCategoryId) {
    return routes.catalog;
  }

  const category = categories.find((item) => item.id === normalizedCategoryId);

  return category ? routes.catalogCategory(category.slug) : routes.catalog;
}

export function filterProducts(products: readonly Product[], filters: FiltersState) {
  return getCatalogSearchResult(products, filters).products;
}

export function getCatalogSearchResult(
  products: readonly Product[],
  filters: FiltersState,
): CatalogSearchResult {
  const normalizedQuery = normalizeSearchText(filters.query);
  let list = products.map((product, index) => ({ product, index }));

  if (filters.categoryId) {
    list = list.filter(({ product }) => product.categoryId === filters.categoryId);
  }

  if (filters.onlyBestsellers) {
    list = list.filter(({ product }) => product.isHit);
  }

  if (filters.onlyPixel) {
    list = list.filter(({ product }) => {
      const slug = normalizeSearchText(product.slug);
      const title = normalizeSearchText(product.title);
      const description = normalizeSearchText(product.description);

      return slug.includes("pixel") || title.includes("пиксел") || description.includes("пиксел");
    });
  }

  const searchableList = list;

  if (normalizedQuery) {
    list = list.filter(({ product }) =>
      normalizeSearchText(product.title).includes(normalizedQuery),
    );
  }

  const sortedProducts = sortCatalogItems(list, filters.sortBy);
  const suggestions =
    normalizedQuery && sortedProducts.length === 0
      ? new Fuse(searchableList, searchSuggestionOptions)
          .search(normalizedQuery)
          .map((result) => result.item.product)
          .slice(0, maxSearchSuggestions)
      : [];

  return {
    products: sortedProducts,
    suggestions,
  };
}

function sortCatalogItems(list: CatalogSearchItem[], sortBy: SortValue) {
  switch (sortBy) {
    case "newest":
      return list.sort((a, b) => b.index - a.index).map(({ product }) => product);
    case "price-asc":
      return list.sort((a, b) => a.product.price - b.product.price).map(({ product }) => product);
    case "price-desc":
      return list.sort((a, b) => b.product.price - a.product.price).map(({ product }) => product);
    case "featured":
    default:
      return list.map(({ product }) => product);
  }
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/\s+/g, " ");
}

export function formatCount(count: number) {
  if (count === 0) {
    return "Ничего не\u00a0найдено";
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const noun =
    lastDigit === 1 && lastTwoDigits !== 11
      ? "книга"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "книги"
        : "книг";

  return `${count} ${noun}`;
}
