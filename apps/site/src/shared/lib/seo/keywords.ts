import type { SeoKeywordGroup, SeoKeywordValue } from "./types";

export const seoKeywords = {
  common: [
    "Artmate",
    "ARTMATE",
    "Артмейт",
    "раскраски Artmate",
    "раскраски по номерам Artmate",
    "купить раскраски Artmate",
    "раскраски по номерам",
    "раскраски антистресс",
    "арт-терапия",
    "творчество для взрослых и детей",
    "цифровой детокс",
  ],
  products: [
    "альбом раскраска по номерам",
    "раскраска A4 на спирали",
    "раскраска на металлической пружине",
    "раскраска с плотной бумагой",
    "бумага 190 г/м²",
    "25 иллюстраций",
    "односторонняя печать",
    "раскраски для маркеров",
    "раскраски для карандашей",
    "раскраски для фломастеров",
    "раскраски для взрослых",
    "раскраски для детей",
  ],
  catalog: [
    "каталог раскрасок Artmate",
    "серии раскрасок Artmate",
    "раскраски с разными сюжетами",
    "раскраски под настроение",
    "детализированные раскраски",
    "новинки раскрасок",
  ],
  blog: [
    "советы по раскрашиванию",
    "как раскрашивать по номерам",
    "идеи для творчества",
    "цветовые сочетания",
    "материалы для раскрашивания",
  ],
} satisfies Record<SeoKeywordGroup, readonly string[]>;

export function getSeoKeywords(
  ...items: readonly (readonly SeoKeywordValue[] | SeoKeywordValue)[]
) {
  const keywords = new Set<string>();

  for (const item of items) {
    if (!item) {
      continue;
    }

    if (typeof item === "string") {
      addKeyword(keywords, item);
      continue;
    }

    for (const keyword of item) {
      if (!keyword) {
        continue;
      }

      addKeyword(keywords, keyword);
    }
  }

  return [...keywords];
}

function addKeyword(keywords: Set<string>, keyword: SeoKeywordGroup | string) {
  const values = keyword in seoKeywords ? seoKeywords[keyword as SeoKeywordGroup] : [keyword];

  for (const value of values) {
    const normalized = normalizeSeoText(value);

    if (normalized) {
      keywords.add(normalized);
    }
  }
}

function normalizeSeoText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
