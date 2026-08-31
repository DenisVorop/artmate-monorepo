import { z } from "zod";

import type {
  CreateFeatureBannerInputDTO,
  FeatureBannerAudience,
} from "@/shared/actions/feature-banners";

const featureBannerAudienceValues = [
  "all",
  "authenticated",
  "anonymous",
  "telegram_unlinked",
] as const;
const featureBannerToneValues = ["info", "success", "warning"] as const;

export const featureBannerAudiencesSchema = z
  .array(z.enum(featureBannerAudienceValues))
  .min(1, "Выберите хотя бы одну аудиторию")
  .superRefine((audiences, context) => {
    if (new Set(audiences).size !== audiences.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Аудитории не должны повторяться",
      });
    }

    if (audiences.includes("all") && audiences.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Аудитория «Все» выбирается отдельно",
      });
    }
  });

export const featureBannerAudiencesFormSchema = z.object({
  audiences: featureBannerAudiencesSchema,
});

export const featureBannerFormSchema = z.object({
  audiences: featureBannerAudiencesSchema,
  ctaHref: z.string().max(2048).optional(),
  ctaLabel: z.string().max(80).optional(),
  description: z.string().trim().min(1).max(600),
  enabled: z.boolean(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  sortOrder: z.coerce.number().int().min(0),
  title: z.string().trim().min(1).max(160),
  tone: z.enum(featureBannerToneValues),
});

export type FeatureBannerFormValues = z.infer<typeof featureBannerFormSchema>;
export type FeatureBannerAudiencesFormValues = z.infer<
  typeof featureBannerAudiencesFormSchema
>;

export const defaultFeatureBannerFormValues: FeatureBannerFormValues = {
  audiences: ["all"],
  ctaHref: "",
  ctaLabel: "",
  description: "",
  enabled: false,
  slug: "",
  sortOrder: 100,
  title: "",
  tone: "info",
};

export function toCreateFeatureBannerInput(
  values: FeatureBannerFormValues,
): CreateFeatureBannerInputDTO {
  const ctaLabel = normalizeOptionalString(values.ctaLabel);
  const ctaHref = normalizeOptionalString(values.ctaHref);

  return {
    audiences: values.audiences,
    ctaHref,
    ctaLabel,
    description: values.description,
    enabled: values.enabled,
    slug: values.slug,
    sortOrder: values.sortOrder,
    title: values.title,
    tone: values.tone,
  };
}

export function getNextFeatureBannerAudiences(
  current: readonly FeatureBannerAudience[],
  audience: FeatureBannerAudience,
  checked: boolean,
): FeatureBannerAudience[] {
  if (!checked) {
    return current.filter((value) => value !== audience);
  }

  if (audience === "all") {
    return ["all"];
  }

  return [...new Set([...current.filter((value) => value !== "all"), audience])];
}

function normalizeOptionalString(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}
