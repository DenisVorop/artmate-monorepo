import type { SeoProduct } from "./types";

export function createCategoryDescription(categoryTitle: string) {
  return `Купить раскраски по номерам Artmate в категории «${categoryTitle}»: антистресс-альбомы A4 на спирали, 25 иллюстраций, бумага 190 г/м² для маркеров и карандашей.`;
}

export function createProductDescription(
  product: Pick<SeoProduct, "category" | "description" | "title">,
) {
  const description = normalizeSeoText(stripHtml(product.description ?? ""));

  if (description.length >= 90 && description.length <= 180) {
    return description;
  }

  const category = product.category ? ` из серии «${product.category}»` : "";

  return `Купить ${product.title}${category}: раскраска по номерам Artmate, альбом A4 на спирали с бумагой 190 г/м² для маркеров, карандашей и фломастеров.`;
}

export function normalizeSeoText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
