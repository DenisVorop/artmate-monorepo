import { z } from "zod";

import type { Product, ProductCategory } from "@/entities/products";
import type { SeoEntry, SeoSnapshot } from "@/entities/seo";
import type {
  CreateSeoEntryInputDTO,
  SeoJsonDTO,
  UpdateSeoEntryInputDTO,
} from "@/shared/actions/seo";

const sourceKinds = ["page", "product", "product_category", "custom"] as const;
const requiredTextSchema = (message: string) => z.string().trim().min(1, message);
const optionalTextSchema = z.string().trim();

export const seoEntryFormSchema = z.object({
  alias: optionalTextSchema,
  canonical: optionalTextSchema,
  categoryId: optionalTextSchema,
  comment: optionalTextSchema,
  description: optionalTextSchema,
  keywords: optionalTextSchema,
  ogDescription: optionalTextSchema,
  ogImage: optionalTextSchema,
  ogImageAlt: optionalTextSchema,
  ogTitle: optionalTextSchema,
  path: requiredTextSchema("Укажите path"),
  productId: optionalTextSchema,
  robotsFollow: z.boolean(),
  robotsIndex: z.boolean(),
  sourceKind: z.enum(sourceKinds),
  title: optionalTextSchema,
});

export type SeoEntryFormValues = z.infer<typeof seoEntryFormSchema>;
export type SeoSourceKind = (typeof sourceKinds)[number];

export const createSeoEntryDefaultValues = {
  alias: "",
  canonical: "",
  categoryId: "",
  comment: "",
  description: "",
  keywords: "",
  ogDescription: "",
  ogImage: "",
  ogImageAlt: "",
  ogTitle: "",
  path: "/",
  productId: "",
  robotsFollow: true,
  robotsIndex: true,
  sourceKind: "page",
  title: "",
} satisfies SeoEntryFormValues;

export type SeoRefreshCallback = () => void | Promise<void>;

export function getSeoEntryDefaultValues(entry: SeoEntry): SeoEntryFormValues {
  const snapshot = getEntrySnapshot(entry);
  const payload = snapshot?.payload ?? {};
  const source = entry.source ?? {};
  const openGraph = getRecord(payload.openGraph);
  const robots = getRecord(payload.robots);

  return {
    alias: getString(source.alias),
    canonical: getString(payload.canonical),
    categoryId: getString(source.categoryId),
    comment: "",
    description: getString(payload.description),
    keywords: getKeywordsValue(payload.keywords),
    ogDescription: getString(openGraph.description),
    ogImage: getString(openGraph.image),
    ogImageAlt: getString(openGraph.imageAlt),
    ogTitle: getString(openGraph.title),
    path: entry.path,
    productId: getString(source.productId),
    robotsFollow: getBoolean(robots.follow, true),
    robotsIndex: getBoolean(robots.index, true),
    sourceKind: getSourceKind(source.kind),
    title: getString(payload.title),
  };
}

export function getCreateSeoEntryInput(
  values: SeoEntryFormValues,
  products: readonly Product[],
  categories: readonly ProductCategory[],
): CreateSeoEntryInputDTO {
  return {
    path: values.path.trim(),
    source: getSource(values, products),
    payload: getPayload(values, categories),
    comment: getOptionalText(values.comment),
  };
}

export function getUpdateSeoEntryInput(
  values: SeoEntryFormValues,
  products: readonly Product[],
  categories: readonly ProductCategory[],
): UpdateSeoEntryInputDTO {
  return getCreateSeoEntryInput(values, products, categories);
}

export function getPublishSeoEntryInput(values: SeoEntryFormValues) {
  return {
    comment: getOptionalText(values.comment),
  };
}

function getEntrySnapshot(entry: SeoEntry): SeoSnapshot | undefined {
  return entry.draftSnapshot ?? entry.publishedSnapshot;
}

function getSource(
  values: SeoEntryFormValues,
  products: readonly Product[],
): SeoJsonDTO {
  const product = products.find((item) => item.id === values.productId);

  return removeEmptyValues({
    kind: values.sourceKind,
    alias: values.alias.trim(),
    productId: values.sourceKind === "product" ? values.productId : "",
    categoryId:
      values.sourceKind === "product"
        ? product?.categoryId ?? values.categoryId
        : values.sourceKind === "product_category"
          ? values.categoryId
          : "",
  });
}

function getPayload(
  values: SeoEntryFormValues,
  categories: readonly ProductCategory[],
): SeoJsonDTO {
  const category = categories.find((item) => item.id === values.categoryId);

  return removeEmptyValues({
    title: values.title.trim(),
    description: values.description.trim(),
    keywords: getKeywords(values.keywords),
    canonical: values.canonical.trim(),
    robots: {
      index: values.robotsIndex,
      follow: values.robotsFollow,
    },
    openGraph: removeEmptyValues({
      title: values.ogTitle.trim(),
      description: values.ogDescription.trim(),
      image: values.ogImage.trim() || category?.image,
      imageAlt: values.ogImageAlt.trim(),
    }),
  });
}

function getKeywords(value: string) {
  const keywords = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return keywords.length > 0 ? keywords : undefined;
}

function getKeywordsValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => getString(item))
      .filter(Boolean)
      .join(", ");
  }

  return getString(value);
}

function removeEmptyValues(value: Record<string, unknown>): SeoJsonDTO {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null || item === "") {
        return false;
      }

      if (Array.isArray(item)) {
        return item.length > 0;
      }

      if (typeof item === "object") {
        return Object.keys(item).length > 0;
      }

      return true;
    }),
  );
}

function getRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function getSourceKind(value: unknown): SeoSourceKind {
  return sourceKinds.includes(value as SeoSourceKind)
    ? (value as SeoSourceKind)
    : "page";
}

function getOptionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}
