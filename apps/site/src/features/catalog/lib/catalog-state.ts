import { CATEGORIES, type Product } from "@/entities/products";
import { routes } from "@/shared";

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

export function normalizeCategoryId(categoryValue?: string) {
  return CATEGORIES.find(
    (category) => category.id === categoryValue || category.slug === categoryValue,
  )?.id;
}

export function getCatalogHref(categoryId?: string) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);

  if (!normalizedCategoryId) {
    return routes.raskraski;
  }

  const category = CATEGORIES.find((item) => item.id === normalizedCategoryId);

  return category ? routes.catalogCategory(category.slug) : routes.raskraski;
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
