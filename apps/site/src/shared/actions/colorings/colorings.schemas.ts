import { z } from "zod";

const coloringPaletteMaxColors = 19;
const coloringPaletteSymbolPattern = /^(?:[1-9]|[A-J])$/;

const publicColoringManifestItemSchema = z
  .object({
    collectionSlug: z.string(),
    number: z.number().int().min(1).max(99),
    lastModified: z.string().datetime({ offset: true }),
  })
  .strict();

const publicColoringThemeSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  })
  .strict();

const publicColoringCategorySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  })
  .strict();

const publicColoringProductSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    category: publicColoringCategorySchema.optional(),
  })
  .strict();

const publicColoringCollectionSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    product: publicColoringProductSchema,
  })
  .strict();

const publicColoringPaletteSchema = z
  .object({
    label: z.string(),
    version: z.string(),
    usedColorCount: z.number().int().min(1).max(168),
    colors: z
      .array(
        z
          .object({
            symbolPosition: z.number().int().min(1).max(coloringPaletteMaxColors),
            symbol: z.string().regex(coloringPaletteSymbolPattern),
            colorNumber: z.number().int().min(1).max(999),
            pantone: z.string(),
            hex: z.string().regex(/^#[0-9A-F]{6}$/),
            markerNumber: z.string().regex(/^\d{3}$/),
          })
          .strict(),
      )
      .max(coloringPaletteMaxColors),
  })
  .strict();

const publicColoringAssetSchema = z
  .object({
    url: z.string().url(),
    alt: z.string(),
  })
  .strict();

export const publicColoringSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1).max(99),
    title: z.string(),
    description: z.string(),
    publishedRevisionId: z.string(),
    publishedAt: z.string().datetime({ offset: true }),
    firstPublishedAt: z.string().datetime({ offset: true }),
    themes: z.array(publicColoringThemeSchema),
    collection: publicColoringCollectionSchema,
    palette: publicColoringPaletteSchema,
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    outline: publicColoringAssetSchema,
    colored: publicColoringAssetSchema,
  })
  .strict();

export const publicColoringsManifestSchema = z.array(publicColoringManifestItemSchema);
