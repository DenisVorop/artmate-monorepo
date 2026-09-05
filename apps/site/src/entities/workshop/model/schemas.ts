import { z } from "zod";

export const workshopSymbolPattern = /^(?:[1-9]|[A-J])$/;
export const workshopMarkerNumberPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/;

const internalId = z.string().regex(/^[0-9a-f]{32}$/);
const publicId = z.string().regex(/^[0-9a-f]{24}$/);
const boundedId = z.string().min(1).max(128);
const boundedSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(180);
const boundedTitle = z.string().min(1).max(220);
const boundedText = z.string().max(2_000);
const boundedUrl = z.string().url().max(2_048);
const isoDate = z.string().datetime({ offset: true });
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const workshopAssetSchema = z
  .object({
    url: boundedUrl,
    alt: z.string().max(300),
    width: z.number().int().positive().max(8_192),
    height: z.number().int().positive().max(8_192),
  })
  .strict();

const officialMarkerColorSchema = z
  .object({
    id: boundedId,
    colorNumber: z.number().int().positive(),
    pantone: z.string().max(40),
    hex: hexColor,
    markerNumber: z.string().regex(workshopMarkerNumberPattern),
  })
  .strict();

export const workshopPaletteColorSchema = z
  .object({
    symbolPosition: z.number().int().min(1).max(19),
    markerColorId: boundedId,
    colorNumber: z.number().int().positive(),
    pantone: z.string().max(40),
    hex: hexColor,
    markerNumber: z.string().regex(workshopMarkerNumberPattern),
    symbol: z.string().regex(workshopSymbolPattern),
  })
  .strict();

export const workshopToolSchema = z
  .object({
    id: internalId,
    type: z.enum(["ARTMATE_168", "CUSTOM"]),
    brand: z.string().min(1).max(80),
    line: z.string().min(1).max(80),
    officialPalette: z.array(officialMarkerColorSchema).max(168).optional(),
  })
  .strict();

const workshopMaterialSchema = z
  .object({
    position: z.number().int().min(1).max(19),
    type: z.enum(["ARTMATE_168", "CUSTOM"]),
    brand: z.string().min(1).max(80),
    line: z.string().min(1).max(80),
  })
  .strict();

export const workshopMappingSchema = z
  .object({
    symbol: z.string().regex(workshopSymbolPattern),
    markerNumber: z
      .string()
      .refine((value) => value === "" || workshopMarkerNumberPattern.test(value)),
    materialPosition: z.number().int().min(1).max(19),
    officialColor: officialMarkerColorSchema.optional(),
  })
  .strict();

export const workshopCropSchema = z
  .object({
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    zoom: z.number().min(1).max(3),
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  })
  .strict();

export const workshopRevisionSchema = z
  .object({
    id: internalId,
    sequence: z.number().int().positive(),
    status: z.enum(["PENDING", "APPROVED", "CHANGES_REQUESTED", "HIDDEN"]),
    crop: workshopCropSchema,
    materials: z.array(workshopMaterialSchema).max(19),
    symbolMappings: z.array(workshopMappingSchema).max(19),
    caption: z.string().max(500).optional(),
    publicationConsent: z.boolean(),
    publicationConsentAt: isoDate.optional(),
    advertisingConsent: z.boolean(),
    advertisingConsentAt: isoDate.optional(),
    assets: z
      .object({
        normalized: boundedUrl.optional(),
        web: boundedUrl,
        thumb: boundedUrl,
      })
      .strict(),
    suspectedOfficialCopy: z.boolean(),
    moderationReason: z.string().max(1_000).optional(),
    submittedAt: isoDate,
    moderatedAt: isoDate.optional(),
    createdAt: isoDate,
  })
  .strict()
  .superRefine((revision, context) => {
    if (revision.publicationConsent !== Boolean(revision.publicationConsentAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Дата согласия на публикацию не соответствует его значению",
        path: ["publicationConsentAt"],
      });
    }

    if (revision.advertisingConsent !== Boolean(revision.advertisingConsentAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Дата рекламного согласия не соответствует его значению",
        path: ["advertisingConsentAt"],
      });
    }
  });

export const workshopWorkSchema = z
  .object({
    id: internalId,
    publicId,
    attemptNumber: z.number().int().positive(),
    isPublicationEnabled: z.boolean(),
    isIndexable: z.boolean(),
    currentRevision: workshopRevisionSchema.optional(),
    publishedRevision: workshopRevisionSchema.optional(),
    publishedAt: isoDate.optional(),
    createdAt: isoDate,
  })
  .strict();

const workshopCollectionSummarySchema = z
  .object({
    id: boundedId,
    slug: boundedSlug,
    title: boundedTitle,
    source: z.enum(["MANUAL", "PURCHASE", "ACTIVATION_CODE"]),
    hasPaidOrder: z.boolean(),
    addedAt: isoDate,
    cover: workshopAssetSchema,
    expectedColoringCount: z.number().int().positive().max(500),
    workCount: z.number().int().nonnegative().max(500),
  })
  .strict();

export const ownerWorkshopSchema = z
  .object({
    handle: z.string().min(1).max(80),
    isPublic: z.boolean(),
    isIndexable: z.boolean(),
    collections: z.array(workshopCollectionSummarySchema).max(500),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .strict();

const workshopColoringSchema = z
  .object({
    id: boundedId,
    number: z.number().int().min(1).max(500),
    title: boundedTitle,
    officialImage: workshopAssetSchema,
    work: workshopWorkSchema.optional(),
  })
  .strict();

export const ownerWorkshopCollectionSchema = workshopCollectionSummarySchema
  .extend({
    description: boundedText,
    colorings: z.array(workshopColoringSchema).max(500),
  })
  .strict();

const officialRevisionSchema = z
  .object({
    id: internalId,
    version: z.number().int().positive(),
    palette: z
      .object({
        label: z.string().min(1).max(120),
        version: z.string().min(1).max(80),
        colors: z.array(workshopPaletteColorSchema).max(19),
      })
      .strict(),
  })
  .strict();

export const ownerWorkshopColoringSchema = z
  .object({
    collection: z
      .object({
        id: boundedId,
        slug: boundedSlug,
        title: boundedTitle,
      })
      .strict(),
    coloring: z
      .object({
        id: boundedId,
        number: z.number().int().min(1).max(500),
        title: boundedTitle,
        description: boundedText,
        officialImage: workshopAssetSchema,
        officialRevision: officialRevisionSchema,
      })
      .strict(),
    work: workshopWorkSchema.optional(),
  })
  .strict();

export const workshopToolsSchema = z.array(workshopToolSchema).max(500);

export const workshopMarkerColorSchema = z
  .object({
    id: boundedId,
    colorNumber: z.number().int().positive(),
    pantone: z.string().max(40),
    hex: hexColor,
    catalogPosition: z.number().int().positive(),
    markerNumber: z.string().regex(workshopMarkerNumberPattern),
  })
  .strict();

export const workshopMarkerColorsSchema = z.array(workshopMarkerColorSchema).max(168);
