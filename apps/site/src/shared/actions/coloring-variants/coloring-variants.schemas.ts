import { z } from "zod";

const coloringPaletteMaxColors = 19;
const coloringPaletteSymbolPattern = /^(?:[1-9]|[A-J])$/;

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

const publicColoringAssetSchema = z
  .object({
    url: z.string().url(),
    alt: z.string(),
  })
  .strict();

const publicColoringCardSchema = publicColoringAssetSchema.extend({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const publicColoringColorSchema = z
  .object({
    symbolPosition: z.number().int().min(1).max(coloringPaletteMaxColors),
    symbol: z.string().regex(coloringPaletteSymbolPattern),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict();

const publicColoringOriginalSchema = z
  .object({
    id: z.literal("original"),
    label: z.literal("Оригинал"),
    image: publicColoringAssetSchema,
    outline: publicColoringAssetSchema,
    card: publicColoringCardSchema,
    colors: z.array(publicColoringColorSchema).min(1).max(coloringPaletteMaxColors),
  })
  .strict();

const publicColoringVariantSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    kind: z.enum(["MARKER", "PENCIL", "PAINT", "OTHER"]),
    totalColors: z.number().int().positive(),
    product: publicColoringProductSchema.optional(),
    image: publicColoringAssetSchema,
    outline: publicColoringAssetSchema,
    card: publicColoringCardSchema,
    colors: z
      .array(publicColoringColorSchema.extend({ code: z.string().min(1) }))
      .min(1)
      .max(coloringPaletteMaxColors),
  })
  .strict();

export const publicColoringVariantsSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1).max(99),
    title: z.string(),
    description: z.string(),
    token: z.string().min(1),
    defaultPaletteId: z.string().min(1),
    publishedAt: z.string().datetime({ offset: true }),
    themes: z.array(publicColoringThemeSchema),
    collection: publicColoringCollectionSchema,
    original: publicColoringOriginalSchema,
    variants: z.array(publicColoringVariantSchema),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
  })
  .strict();
