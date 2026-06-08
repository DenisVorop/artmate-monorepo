import { z } from "zod";

import {
  catalogLandingProductSources,
  catalogLandingStatuses,
  type CatalogLandingPageDTO,
  type CreateCatalogLandingPageInputDTO,
  type UpdateCatalogLandingPageInputDTO,
} from "@/shared/actions/catalog-landings";

const requiredTextSchema = (message: string) => z.string().trim().min(1, message);
const optionalTextSchema = z.string().trim();

export const landingFaqFormSchema = z.object({
  answerHtml: optionalTextSchema,
  question: optionalTextSchema,
});

export const catalogLandingFormSchema = z.object({
  excludedProductIds: z.array(z.string()),
  excludedTagIds: z.array(z.string()),
  faqItems: z.array(landingFaqFormSchema),
  h1: requiredTextSchema("Укажите H1"),
  includedProductIds: z.array(z.string()),
  introHtml: optionalTextSchema,
  isIndexable: z.boolean(),
  metaDescription: requiredTextSchema("Укажите meta description"),
  metaTitle: requiredTextSchema("Укажите meta title"),
  minProducts: z.number().int().min(0).max(100),
  optionalTagIds: z.array(z.string()),
  productSource: z.enum(catalogLandingProductSources),
  requiredTagIds: z.array(z.string()),
  seoHtml: optionalTextSchema,
  seoTitle: optionalTextSchema,
  slug: requiredTextSchema("Укажите slug"),
  status: z.enum(catalogLandingStatuses),
});

export type CatalogLandingFormValues = z.infer<typeof catalogLandingFormSchema>;

export const createCatalogLandingDefaultValues = {
  excludedProductIds: [],
  excludedTagIds: [],
  faqItems: [{ answerHtml: "", question: "" }],
  h1: "",
  includedProductIds: [],
  introHtml: "",
  isIndexable: true,
  metaDescription: "",
  metaTitle: "",
  minProducts: 2,
  optionalTagIds: [],
  productSource: "tags",
  requiredTagIds: [],
  seoHtml: "",
  seoTitle: "",
  slug: "",
  status: "draft",
} satisfies CatalogLandingFormValues;

export function getCatalogLandingDefaultValues(
  landing: CatalogLandingPageDTO,
): CatalogLandingFormValues {
  return {
    excludedProductIds: landing.productOverrides
      .filter((override) => override.mode === "excluded")
      .map((override) => override.productId),
    excludedTagIds: landing.tagRules
      .filter((rule) => rule.mode === "excluded")
      .map((rule) => rule.tagId),
    faqItems:
      landing.faqItems.length > 0
        ? landing.faqItems.map((item) => ({
            answerHtml: item.answerHtml,
            question: item.question,
          }))
        : [{ answerHtml: "", question: "" }],
    h1: landing.h1,
    includedProductIds: landing.productOverrides
      .filter((override) => override.mode === "included")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((override) => override.productId),
    introHtml: landing.introHtml ?? "",
    isIndexable: landing.isIndexable,
    metaDescription: landing.metaDescription,
    metaTitle: landing.metaTitle,
    minProducts: landing.minProducts,
    optionalTagIds: landing.tagRules
      .filter((rule) => rule.mode === "optional")
      .map((rule) => rule.tagId),
    productSource: landing.productSource,
    requiredTagIds: landing.tagRules
      .filter((rule) => rule.mode === "required")
      .map((rule) => rule.tagId),
    seoHtml: landing.seoHtml ?? "",
    seoTitle: landing.seoTitle ?? "",
    slug: landing.slug,
    status: landing.status,
  };
}

export function getCreateCatalogLandingInput(
  values: CatalogLandingFormValues,
): CreateCatalogLandingPageInputDTO {
  return getCatalogLandingInput(values);
}

export function getUpdateCatalogLandingInput(
  values: CatalogLandingFormValues,
): UpdateCatalogLandingPageInputDTO {
  return getCatalogLandingInput(values);
}

function getCatalogLandingInput(
  values: CatalogLandingFormValues,
): CreateCatalogLandingPageInputDTO {
  const excludedProductIds = new Set(values.excludedProductIds);
  const excludedTagIds = new Set(values.excludedTagIds);
  const requiredTagIds = values.requiredTagIds.filter((tagId) => !excludedTagIds.has(tagId));
  const requiredTagIdsSet = new Set(requiredTagIds);
  const optionalTagIds = values.optionalTagIds.filter(
    (tagId) => !excludedTagIds.has(tagId) && !requiredTagIdsSet.has(tagId),
  );

  return {
    faqItems: values.faqItems.flatMap((item, index) => {
      const question = item.question.trim();
      const answerHtml = item.answerHtml.trim();

      return question && answerHtml
        ? [
            {
              answerHtml,
              question,
              sortOrder: index,
            },
          ]
        : [];
    }),
    h1: values.h1.trim(),
    introHtml: getOptionalText(values.introHtml),
    isIndexable: values.isIndexable,
    metaDescription: values.metaDescription.trim(),
    metaTitle: values.metaTitle.trim(),
    minProducts: values.minProducts,
    productOverrides: [
      ...values.includedProductIds
        .filter((productId) => !excludedProductIds.has(productId))
        .map((productId, index) => ({
          mode: "included" as const,
          productId,
          sortOrder: index,
        })),
      ...values.excludedProductIds.map((productId) => ({
        mode: "excluded" as const,
        productId,
        sortOrder: 0,
      })),
    ],
    productSource: values.productSource,
    seoHtml: getOptionalText(values.seoHtml),
    seoTitle: getOptionalText(values.seoTitle),
    slug: values.slug.trim(),
    status: values.status,
    tagRules: [
      ...requiredTagIds.map((tagId) => ({
        mode: "required" as const,
        tagId,
      })),
      ...optionalTagIds.map((tagId) => ({
        mode: "optional" as const,
        tagId,
      })),
      ...values.excludedTagIds.map((tagId) => ({
        mode: "excluded" as const,
        tagId,
      })),
    ],
  };
}

function getOptionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}
