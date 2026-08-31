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
  audiences: FeatureBannerAudience[];
  tone: FeatureBannerTone;
  enabled: boolean;
  sortOrder: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};
