import { z } from "zod";

const publicId = z.string().regex(/^[0-9a-f]{24}$/);
const boundedSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(180);
const boundedTitle = z.string().min(1).max(220);
const boundedUrl = z.string().url().max(2_048);
const isoDate = z.string().datetime({ offset: true });

export const communityAuthorSchema = z
  .object({
    handle: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    image: boundedUrl.optional(),
  })
  .strict();

const publicMaterialSchema = z
  .object({
    position: z.number().int().min(1).max(19),
    type: z.enum(["ARTMATE_168", "CUSTOM"]),
    brand: z.string().min(1).max(80),
    line: z.string().min(1).max(80),
  })
  .strict();

const publicMappingSchema = z
  .object({
    symbol: z.string().regex(/^(?:[1-9]|[A-J])$/),
    markerNumber: z
      .string()
      .max(12)
      .refine((value) => value === "" || /^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(value)),
    materialPosition: z.number().int().min(1).max(19),
    officialColor: z
      .object({
        colorNumber: z.number().int().positive(),
        pantone: z.string().max(40),
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        markerNumber: z.string().min(1).max(12),
      })
      .strict()
      .optional(),
  })
  .strict();

export const publicCommunityWorkSchema = z
  .object({
    revisionId: z.string().regex(/^[0-9a-f]{32}$/),
    publicId,
    author: communityAuthorSchema,
    official: z
      .object({
        collection: z.object({ slug: boundedSlug, title: boundedTitle }).strict(),
        coloring: z
          .object({
            number: z.number().int().min(1).max(500),
            title: boundedTitle,
          })
          .strict(),
        coloredUrl: boundedUrl,
        palette: z
          .object({
            label: z.string().min(1).max(120),
            version: z.string().min(1).max(80),
            colors: z
              .array(
                z
                  .object({
                    symbolPosition: z.number().int().min(1).max(19),
                    symbol: z.string().regex(/^(?:[1-9]|[A-J])$/),
                    colorNumber: z.number().int().positive(),
                    pantone: z.string().max(40),
                    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
                    markerNumber: z.string().min(1).max(12),
                  })
                  .strict(),
              )
              .max(19),
          })
          .strict(),
      })
      .strict(),
    submission: z
      .object({
        caption: z.string().max(500).optional(),
        materials: z.array(publicMaterialSchema).max(19),
        symbolMappings: z.array(publicMappingSchema).max(19),
        assets: z.object({ web: boundedUrl, thumb: boundedUrl }).strict(),
        publishedAt: isoDate,
      })
      .strict(),
    relatedProduct: z
      .object({
        slug: boundedSlug,
        title: boundedTitle,
        categorySlug: boundedSlug.optional(),
      })
      .strict(),
  })
  .strict();

export const communityWorkSummarySchema = publicCommunityWorkSchema;
export const communityWorksSchema = z.array(publicCommunityWorkSchema).max(500);

export const communityWorkReportSchema = z
  .object({
    status: z.literal("OPEN"),
    createdAt: isoDate,
  })
  .strict();

export const publicWorkshopSchema = z
  .object({
    handle: z.string().min(1).max(80),
    author: z
      .object({
        name: z.string().min(1).max(120),
        image: boundedUrl.optional(),
      })
      .strict(),
    works: communityWorksSchema,
  })
  .strict();
