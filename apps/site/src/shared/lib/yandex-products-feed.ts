import { companyDetails, getAbsoluteUrl, routes, siteConfig } from "@/shared/constants";

import { createProductDescription } from "./seo/text";

type YandexFeedCategory = {
  id: string;
  title: string;
};

type YandexFeedProduct = {
  id: string;
  title: string;
  slug: string;
  price: number;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  images: string[];
  description: string;
  isOutOfStock: boolean;
};

type YandexProductsFeedInput = {
  categories: readonly YandexFeedCategory[];
  products: readonly YandexFeedProduct[];
};

const currencyId = "RUR";
const fallbackCategory = {
  id: "artmate-raskraski",
  title: "Раскраски по номерам",
} satisfies YandexFeedCategory;
const fallbackCategoryNumericId = "1";
const maxCategoryNumericId = 2_147_483_647;
const xmlEscapedCharsPattern = /[<>&"']/g;

export function createYandexProductsFeed(input: YandexProductsFeedInput, generatedAt = new Date()) {
  const categoryIds = createCategoryIdMap(input.categories);
  const categoriesXml = createCategoriesXml(input.categories, categoryIds);
  const offersXml = input.products.flatMap((product) => createOfferXml(product, categoryIds));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<yml_catalog date="${formatYmlDate(generatedAt)}">`,
    "  <shop>",
    createElement("name", siteConfig.name, 4),
    createElement("company", companyDetails.legalName, 4),
    createElement("url", siteConfig.url, 4),
    "    <currencies>",
    `      <currency id="${currencyId}" rate="1"/>`,
    "    </currencies>",
    "    <categories>",
    ...categoriesXml,
    "    </categories>",
    "    <offers>",
    ...offersXml,
    "    </offers>",
    "  </shop>",
    "</yml_catalog>",
    "",
  ].join("\n");
}

function createCategoriesXml(
  categories: readonly YandexFeedCategory[],
  categoryIds: ReadonlyMap<string, string>,
) {
  const uniqueCategories = new Map<string, YandexFeedCategory>();

  for (const category of categories) {
    if (category.id === fallbackCategory.id) {
      continue;
    }

    uniqueCategories.set(category.id, category);
  }

  return [
    createElement("category", fallbackCategory.title, 6, {
      id: fallbackCategoryNumericId,
    }),
    ...[...uniqueCategories.values()]
      .sort((a, b) => a.title.localeCompare(b.title, "ru-RU"))
      .map((category) =>
        createElement("category", category.title, 6, {
          id: categoryIds.get(category.id) ?? fallbackCategoryNumericId,
          parentId: fallbackCategoryNumericId,
        }),
      ),
  ];
}

function createOfferXml(
  product: YandexFeedProduct,
  categoryIds: ReadonlyMap<string, string>,
) {
  if (!Number.isFinite(product.price) || product.price <= 0) {
    return [];
  }

  const pictures = product.images.flatMap((image) => {
    const pictureUrl = getSafeAbsoluteUrl(image);

    return pictureUrl ? [createElement("picture", pictureUrl, 8)] : [];
  });

  if (pictures.length === 0) {
    return [];
  }

  const categoryId = product.categoryId
    ? categoryIds.get(product.categoryId) ?? fallbackCategoryNumericId
    : fallbackCategoryNumericId;
  const productUrl = getAbsoluteUrl(routes.product(product.categorySlug, product.slug));
  const description = createOfferDescription(product);

  return [
    `      <offer id="${escapeXmlAttribute(product.id)}" available="${product.isOutOfStock ? "false" : "true"}">`,
    createElement("name", product.title, 8),
    createElement("vendor", siteConfig.name, 8),
    createElement("url", productUrl, 8),
    createElement("price", formatPrice(product.price), 8),
    createElement("currencyId", currencyId, 8),
    createElement("categoryId", categoryId, 8),
    ...pictures,
    createElement("description", description, 8),
    createElement("param", "Раскраска по номерам", 8, { name: "Тип" }),
    createElement("param", "A4", 8, { name: "Формат" }),
    createElement("param", "Спираль", 8, { name: "Крепление" }),
    createElement("param", "190", 8, { name: "Плотность бумаги", unit: "г/м²" }),
    createElement("param", "25", 8, { name: "Количество иллюстраций" }),
    "      </offer>",
  ];
}

function createCategoryIdMap(categories: readonly YandexFeedCategory[]) {
  const ids = new Map<string, string>([
    [fallbackCategory.id, fallbackCategoryNumericId],
  ]);
  const usedIds = new Set(ids.values());

  for (const category of [...categories].sort((a, b) => a.id.localeCompare(b.id))) {
    if (ids.has(category.id)) {
      continue;
    }

    const numericId = createStableNumericCategoryId(category.id, usedIds);
    ids.set(category.id, numericId);
    usedIds.add(numericId);
  }

  return ids;
}

function createStableNumericCategoryId(value: string, usedIds: ReadonlySet<string>) {
  let numericId = (hashString(value) % (maxCategoryNumericId - 1)) + 2;

  while (usedIds.has(String(numericId))) {
    numericId = numericId >= maxCategoryNumericId ? 2 : numericId + 1;
  }

  return String(numericId);
}

function hashString(value: string) {
  let hash = 0x811c9dc5;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}

function createElement(
  name: string,
  value: number | string,
  indentSize: number,
  attributes: Record<string, string> = {},
) {
  const indent = " ".repeat(indentSize);
  const serializedAttributes = Object.entries(attributes)
    .map(([attributeName, attributeValue]) => {
      return ` ${attributeName}="${escapeXmlAttribute(attributeValue)}"`;
    })
    .join("");

  return `${indent}<${name}${serializedAttributes}>${escapeXmlText(String(value))}</${name}>`;
}

function formatPrice(price: number) {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

function formatYmlDate(date: Date) {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getSafeAbsoluteUrl(value: string) {
  try {
    return new URL(value, `${siteConfig.url}/`).toString();
  } catch {
    return undefined;
  }
}

function createOfferDescription(product: YandexFeedProduct) {
  const description = normalizeXmlText(decodeCommonHtmlEntities(stripHtml(product.description)));

  if (description.length >= 90) {
    return description;
  }

  return createProductDescription(product);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeCommonHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»");
}

function escapeXmlText(value: string) {
  return normalizeXmlText(value).replace(xmlEscapedCharsPattern, escapeXmlChar);
}

function escapeXmlAttribute(value: string) {
  return normalizeXmlText(value).replace(xmlEscapedCharsPattern, escapeXmlChar);
}

function normalizeXmlText(value: string) {
  return Array.from(value)
    .map((char) => (isValidXmlChar(char) ? char : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidXmlChar(char: string) {
  const code = char.codePointAt(0) ?? 0;

  return code === 0x9 || code === 0xa || code === 0xd || code >= 0x20;
}

function escapeXmlChar(char: string) {
  switch (char) {
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case "&":
      return "&amp;";
    case "\"":
      return "&quot;";
    case "'":
      return "&apos;";
    default:
      return char;
  }
}
