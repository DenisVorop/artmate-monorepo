import { z } from "zod";

const collectionAssetSchema = z
  .object({
    url: z.string().url(),
    alt: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const collectionCategorySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  })
  .strict();

const collectionProductSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    category: collectionCategorySchema.optional(),
  })
  .strict();

export const publicColoringCollectionSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string().optional(),
    coloringCount: z.number().int().nonnegative(),
    expectedColoringCount: z.number().int().positive(),
    cover: collectionAssetSchema,
    product: collectionProductSchema,
    lastModified: z.string().datetime({ offset: true }),
  })
  .strict();

const publicColoringCollectionItemSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1).max(99),
    title: z.string(),
    position: z.number().int().nonnegative(),
    publishedRevisionId: z.string(),
    card: collectionAssetSchema,
  })
  .strict();

export const publicColoringCollectionsSchema = z.array(publicColoringCollectionSummarySchema);

export const publicColoringCollectionSchema = publicColoringCollectionSummarySchema.extend({
  colorings: z.array(publicColoringCollectionItemSchema),
});
