import { z } from "zod";

export const workshopModerationStatuses = [
  "PENDING",
  "APPROVED",
  "CHANGES_REQUESTED",
  "HIDDEN",
] as const;

export const workshopModerationDecisions = [
  "APPROVE",
  "REQUEST_CHANGES",
  "HIDE",
] as const;

export const workshopModerationHistoryDecisions = [
  "SUBMITTED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "HIDDEN",
] as const;

const boundedIdSchema = z.string().trim().min(1).max(128);
const revisionIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
const boundedLabelSchema = z.string().trim().min(1).max(300);
const dateSchema = z.string().datetime({ offset: true });
const plainTextPattern = /^(?![\s\S]*(?:https?:\/\/|www\.|<|>))[\s\S]*$/i;
const symbolSchema = z.string().regex(/^(?:[1-9]|[A-J])$/);
const markerNumberSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(value),
  );

export const workshopModerationAssetVariantSchema = z.enum([
  "normalized",
  "web",
  "thumb",
  "official",
]);

const safeAuthorSchema = z
  .object({
    id: boundedIdSchema,
    name: z.string().trim().min(1).max(200),
    image: z.string().url().max(2048).optional(),
  })
  .strict();

const collectionIdentitySchema = z
  .object({
    id: boundedIdSchema,
    slug: z.string().trim().min(1).max(180),
    title: boundedLabelSchema,
  })
  .strict();

const coloringIdentitySchema = z
  .object({
    id: boundedIdSchema,
    number: z.number().int().min(1).max(9999),
    title: boundedLabelSchema,
  })
  .strict();

const officialColorSchema = z
  .object({
    id: boundedIdSchema.optional(),
    colorNumber: z.number().int().min(0).max(9999),
    pantone: z.string().trim().min(1).max(80),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    markerNumber: z.string().trim().min(1).max(12),
  })
  .strict();

export const workshopModerationQueueItemSchema = z
  .object({
    revisionId: revisionIdSchema,
    workId: revisionIdSchema,
    status: z.enum(workshopModerationStatuses),
    submittedAt: dateSchema,
    createdAt: dateSchema,
    author: safeAuthorSchema,
    workshopHandle: z.string().trim().min(1).max(100),
    collection: collectionIdentitySchema,
    coloring: coloringIdentitySchema,
    suspectedOfficialCopy: z.boolean(),
    isPublishedRevision: z.boolean(),
  })
  .strict();

export const workshopModerationQueueSchema = z
  .array(workshopModerationQueueItemSchema)
  .max(500);

export const workshopModerationDetailSchema = workshopModerationQueueItemSchema
  .extend({
    caption: z.string().trim().max(500).optional(),
    advertisingConsent: z.boolean(),
    advertisingConsentAt: dateSchema.optional(),
    publicationConsent: z.boolean(),
    publicationConsentAt: dateSchema.optional(),
    officialComparison: z
      .object({
        revisionId: revisionIdSchema,
        version: z.number().int().positive(),
        coloredUrl: z.string().url().max(2048),
        palette: z
          .object({
            label: z.string().trim().min(1).max(120),
            version: z.string().trim().min(1).max(80),
            colors: z
              .array(
                officialColorSchema.extend({
                  symbolPosition: z.number().int().min(1).max(19),
                  symbol: symbolSchema,
                }),
              )
              .max(19),
          })
          .strict(),
      })
      .strict(),
    materials: z
      .array(
        z
          .object({
            position: z.number().int().positive().max(19),
            type: z.enum(["ARTMATE_168", "CUSTOM"]),
            brand: z.string().trim().min(1).max(80),
            line: z.string().trim().min(1).max(80),
          })
          .strict(),
      )
      .max(19),
    symbolMappings: z
      .array(
        z
          .object({
            symbol: symbolSchema,
            markerNumber: markerNumberSchema,
            materialPosition: z.number().int().positive().max(19).optional(),
            officialColor: officialColorSchema.optional(),
          })
          .strict(),
      )
      .max(19),
    assets: z
      .object({
        normalized: z.string().url().max(2048),
        web: z.string().url().max(2048),
        thumb: z.string().url().max(2048),
      })
      .strict(),
    decisionHistory: z.array(
      z
        .object({
          id: revisionIdSchema,
          revisionId: revisionIdSchema,
          decision: z.enum(workshopModerationHistoryDecisions),
          actor: z
            .object({
              id: boundedIdSchema,
              name: z.string().trim().min(1).max(200),
            })
            .strict(),
          createdAt: dateSchema,
          reason: z.string().trim().max(1000).optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((detail, context) => {
    if (detail.advertisingConsent !== Boolean(detail.advertisingConsentAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Время рекламного согласия должно соответствовать признаку согласия",
        path: ["advertisingConsentAt"],
      });
    }

    if (detail.publicationConsent !== Boolean(detail.publicationConsentAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Время согласия на публикацию должно соответствовать признаку согласия",
        path: ["publicationConsentAt"],
      });
    }
  });

export const workshopModerationDecisionSchema = z
  .object({
    decision: z.enum(workshopModerationDecisions),
    reason: z
      .string()
      .trim()
      .max(1000)
      .regex(plainTextPattern, "Не добавляйте ссылки или HTML")
      .optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.decision !== "APPROVE" && !input.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите причину решения",
        path: ["reason"],
      });
    }
  });

export const workshopModerationStatusSchema = z.enum(
  workshopModerationStatuses,
);

export const workshopModerationRevisionIdSchema = revisionIdSchema;
export const workshopModerationVariantSchema =
  workshopModerationAssetVariantSchema;
