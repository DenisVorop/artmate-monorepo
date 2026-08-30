import type { SeoProduct } from "./types";

export function createColoringSeoTitle(collectionTitle: string, number: number) {
  return `Цифровая версия раскраски «${collectionTitle}». Картина ${number}`;
}

export function createColoringSeoDescription(collectionTitle: string, number: number) {
  return `Картина ${number} из цифровой версии раскраски «${collectionTitle}»: контур и цветной пример в палитре маркеров Artmate.`;
}

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
