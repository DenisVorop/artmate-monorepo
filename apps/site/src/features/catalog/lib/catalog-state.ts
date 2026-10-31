import Fuse, { type IFuseOptions } from "fuse.js";
import type { Product, ProductCategory, ProductTag } from "@/entities/products";
import { routes } from "@/shared/constants";
import type { SearchParams } from "@/shared/lib/query-state-manager";

export type SortValue = "featured" | "newest" | "price-asc" | "price-desc";
export const sortOptions = [
  { value: "featured", label: "Рекомендуем" },
  { value: "newest", label: "Новинки" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
] satisfies Array<{ value: SortValue; label: string }>;

export type CatalogCategoryValue = "colorings" | "markers";
export type CatalogCategory = { id: CatalogCategoryValue; title: string; count: number };

export function getProductCatalogCategory(product: Product): CatalogCategoryValue | undefined {
  if (product.categorySlug === "markery" || product.categoryId === "markers") return "markers";
  if (
    product.tags.some(
      (tag) => tag.group === "format" && ["po-nomeram", "pikselnye"].includes(tag.slug),
    )
  )
    return "colorings";
  return undefined;
}

export function getCatalogCategories(products: readonly Product[]): CatalogCategory[] {
  const categories = [
    { id: "colorings", title: "Раскраски" },
    { id: "markers", title: "Маркеры" },
  ] satisfies Array<Omit<CatalogCategory, "count">>;
  return categories.map((category) => ({
    ...category,
    count: products.filter((product) => getProductCatalogCategory(product) === category.id).length,
  }));
}

export function matchesCatalogCategory(
  product: Product,
  filters: Pick<CatalogFilters, "category" | "categoryId">,
) {
  return (
    (!filters.categoryId || product.categoryId === filters.categoryId) &&
    (!filters.category || getProductCatalogCategory(product) === filters.category)
  );
}

export type FiltersState = {
  category?: CatalogCategoryValue;
  query: string;
  onlyBestsellers: boolean;
  onlyAvailable: boolean;
  minPrice?: number;
  maxPrice?: number;
  tagSlugs: string[];
  sortBy: SortValue;
};
export type CatalogFilters = FiltersState & { categoryId?: string };
export type CatalogSearchResult = { products: Product[]; suggestions: Product[] };
export type CatalogFacet = {
  group: ProductTag["group"];
  title: string;
  options: Array<ProductTag & { count: number }>;
};
export const tagGroups = [{ group: "format", title: "Формат" }] satisfies Array<{
  group: ProductTag["group"];
  title: string;
}>;

export function normalizeCategoryId(categories: readonly ProductCategory[], value?: string) {
  return categories.find((category) => category.id === value || category.slug === value)?.id;
}

export function readCatalogFilters(
  params: SearchParams,
  products: readonly Product[],
): FiltersState {
  const text = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const price = (key: string) => {
    const value = text(key);
    const number = Number(value);
    return value.trim() && Number.isFinite(number) && number >= 0 ? number : undefined;
  };
  const knownTags = new Set(
    products.flatMap((product) =>
      product.tags
        .filter((tag) => tagGroups.some(({ group }) => tag.group === group))
        .map((tag) => tag.slug),
    ),
  );
  return {
    category: ["colorings", "markers"].includes(text("category"))
      ? (text("category") as CatalogCategoryValue)
      : undefined,
    query: text("q"),
    onlyBestsellers: text("hits") === "1",
    onlyAvailable: text("available") === "1",
    minPrice: price("min"),
    maxPrice: price("max"),
    tagSlugs: [
      ...new Set(
        text("tags")
          .split(",")
          .filter((slug) => knownTags.has(slug)),
      ),
    ],
    sortBy: sortOptions.find((option) => option.value === text("sort"))?.value ?? "featured",
  };
}

export function getCatalogParams(filters: FiltersState): Record<string, string | string[]> {
  return {
    category: filters.category || [],
    q: filters.query || [],
    hits: filters.onlyBestsellers ? "1" : [],
    available: filters.onlyAvailable ? "1" : [],
    min: filters.minPrice === undefined ? [] : String(filters.minPrice),
    max: filters.maxPrice === undefined ? [] : String(filters.maxPrice),
    tags: filters.tagSlugs.length ? [...filters.tagSlugs].sort().join(",") : [],
    sort: filters.sortBy === "featured" ? [] : filters.sortBy,
  };
}

export function getCatalogHrefWithFilters(filters: FiltersState, existingParams: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...existingParams, ...getCatalogParams(filters) })) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) for (const entry of value) params.append(key, entry);
  }
  params.delete("category");
  const search = params.toString();
  const href =
    filters.category === "colorings"
      ? routes.catalogColorings
      : filters.category === "markers"
        ? routes.catalogMarkers
        : routes.catalog;
  return search ? `${href}?${search}` : href;
}

function matchesFilters(
  product: Product,
  filters: CatalogFilters,
  selectedTags: readonly ProductTag[],
) {
  if (!matchesCatalogCategory(product, filters)) return false;
  if (filters.onlyBestsellers && !product.isHit) return false;
  if (filters.onlyAvailable && product.isOutOfStock) return false;
  if (filters.minPrice !== undefined && product.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false;
  return tagGroups.every(({ group }) => {
    const options = selectedTags.filter((tag) => tag.group === group);
    return (
      !options.length ||
      product.tags.some((tag) => options.some((option) => option.slug === tag.slug))
    );
  });
}

function searchText(product: Product, includeCharacteristics = false) {
  return normalizeSearchText(
    [
      product.title,
      product.category,
      ...product.tags.map((tag) => tag.title),
      ...(includeCharacteristics
        ? product.characteristics.map((item) => `${item.name} ${item.value}`)
        : []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}
const searchSuggestionOptions = {
  threshold: 0.36,
  ignoreLocation: true,
  ignoreDiacritics: true,
  keys: [
    { name: "title", weight: 0.85 },
    { name: "category", weight: 0.15 },
    { name: "tags.title", weight: 0.1 },
  ],
} satisfies IFuseOptions<Product>;

export function getCatalogSearchResult(
  products: readonly Product[],
  filters: CatalogFilters,
): CatalogSearchResult {
  const selectedTags = products
    .flatMap((product) => product.tags)
    .filter((tag) => filters.tagSlugs.includes(tag.slug));
  const candidates = products.filter((product) => matchesFilters(product, filters, selectedTags));
  const words = normalizeSearchText(filters.query).split(" ").filter(Boolean);
  let list = candidates.filter((product) =>
    words.every((word) => searchText(product).includes(word)),
  );
  if (words.length && !list.length) {
    list = candidates.filter((product) =>
      words.every((word) => searchText(product, true).includes(word)),
    );
  }
  switch (filters.sortBy) {
    case "newest":
      list = list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case "price-asc":
      list = list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list = list.sort((a, b) => b.price - a.price);
      break;
  }
  return {
    products: list,
    suggestions:
      words.length && !list.length
        ? new Fuse(candidates, searchSuggestionOptions)
            .search(normalizeSearchText(filters.query))
            .map(({ item }) => item)
            .slice(0, 4)
        : [],
  };
}

export function getCatalogFacets(
  products: readonly Product[],
  filters: CatalogFilters,
): CatalogFacet[] {
  const scoped = products.filter((product) => matchesCatalogCategory(product, filters));
  const tags = [
    ...new Map(scoped.flatMap((product) => product.tags).map((tag) => [tag.slug, tag])).values(),
  ];
  return tagGroups.flatMap(({ group, title }) => {
    const options = tags
      .filter((tag) => tag.group === group)
      .sort((a, b) => a.title.localeCompare(b.title, "ru-RU"));
    if (
      !options.length ||
      (options.length === 1 &&
        scoped.every((product) => product.tags.some((tag) => tag.slug === options[0]?.slug)))
    )
      return [];
    const otherGroups = filters.tagSlugs.filter(
      (slug) => !options.some((tag) => tag.slug === slug),
    );
    const candidates = getCatalogSearchResult(products, {
      ...filters,
      tagSlugs: otherGroups,
    }).products;
    return [
      {
        group,
        title,
        options: options.map((tag) => ({
          ...tag,
          count: candidates.filter((product) => product.tags.some((item) => item.slug === tag.slug))
            .length,
        })),
      },
    ];
  });
}

export function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/\s+/g, " ");
}
export function formatCount(count: number) {
  const lastDigit = count % 10,
    lastTwoDigits = count % 100;
  const noun =
    lastDigit === 1 && lastTwoDigits !== 11
      ? "товар"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "товара"
        : "товаров";
  return `${count} ${noun}`;
}
