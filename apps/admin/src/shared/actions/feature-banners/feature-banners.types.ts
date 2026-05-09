export type FeatureBannerAudience =
  | "all"
  | "authenticated"
  | "anonymous"
  | "telegram_unlinked";

export type FeatureBannerTone = "info" | "success" | "warning";

export type FeatureBannerDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  audience: FeatureBannerAudience;
  tone: FeatureBannerTone;
  enabled: boolean;
  sortOrder: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateFeatureBannerInputDTO = {
  slug: string;
  title: string;
  description: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  audience?: FeatureBannerAudience;
  tone?: FeatureBannerTone;
  enabled?: boolean;
  sortOrder?: number;
};

export type UpdateFeatureBannerInputDTO = Partial<CreateFeatureBannerInputDTO>;
