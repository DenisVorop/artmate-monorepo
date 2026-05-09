import { z } from "zod";

import type { CreateFeatureBannerInputDTO } from "@/shared/actions/feature-banners";

const featureBannerAudienceValues = [
  "all",
  "authenticated",
  "anonymous",
  "telegram_unlinked",
] as const;
const featureBannerToneValues = ["info", "success", "warning"] as const;

export const featureBannerFormSchema = z.object({
  audience: z.enum(featureBannerAudienceValues),
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

export const defaultFeatureBannerFormValues: FeatureBannerFormValues = {
  audience: "all",
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
    audience: values.audience,
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

function normalizeOptionalString(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}
