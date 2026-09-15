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

// The YML feed retains its current description policy until its separate revision.
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

export function createProductSeoDescription(
  product: Pick<SeoProduct, "description" | "title" | "characteristics">,
) {
  const description = normalizeSeoText(stripHtml(product.description ?? ""));
  const properties = product.characteristics
    ?.map(({ name, value }) => `${name}: ${value}`)
    .join(". ");
  const fallback = [product.title, properties].filter(Boolean).join(". ");
  const text = description || normalizeSeoText(stripHtml(fallback));

  if (text.length <= 180) return text;

  const excerpt = text.slice(0, 179);
  const wordBoundary = excerpt.lastIndexOf(" ");
  return `${(wordBoundary > 0 ? excerpt.slice(0, wordBoundary) : excerpt).trimEnd()}…`;
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
