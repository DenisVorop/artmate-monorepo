import { CATEGORIES, type Product } from "@/entities/products";

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
  sortBy: SortValue;
};

export type SearchParams = {
  category?: string | string[];
};

export function normalizeCategoryId(categoryId?: string) {
  return CATEGORIES.some((category) => category.id === categoryId) ? categoryId : undefined;
}

export function resolveInitialCategoryId(searchParams?: SearchParams) {
  const category = Array.isArray(searchParams?.category)
    ? searchParams.category[0]
    : searchParams?.category;

  return normalizeCategoryId(category);
}

export function getHref(categoryId?: string) {
  if (!categoryId) {
    return "/catalog";
  }

  return `/catalog?category=${encodeURIComponent(categoryId)}`;
}

export function filterProducts(products: readonly Product[], filters: FiltersState) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("ru-RU");
  let list = [...products];

  if (filters.categoryId) {
    list = list.filter((product) => product.categoryId === filters.categoryId);
  }

  if (filters.onlyBestsellers) {
    list = list.filter((product) => product.bestseller);
  }

  if (normalizedQuery) {
    list = list.filter((product) => {
      const title = product.title.toLocaleLowerCase("ru-RU");
      const category = product.category.toLocaleLowerCase("ru-RU");
      const description = product.description.toLocaleLowerCase("ru-RU");

      return (
        title.includes(normalizedQuery) ||
        category.includes(normalizedQuery) ||
        description.includes(normalizedQuery)
      );
    });
  }

  switch (filters.sortBy) {
    case "newest":
      return list.reverse();
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "featured":
    default:
      return list;
  }
}

export function formatCount(count: number) {
  if (count === 0) {
    return "Ничего не найдено";
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
