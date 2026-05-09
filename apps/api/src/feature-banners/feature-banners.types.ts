export const featureBannerAudiences = [
  "all",
  "authenticated",
  "anonymous",
  "telegram_unlinked",
] as const;

export const featureBannerTones = ["info", "success", "warning"] as const;

export type FeatureBannerAudience = (typeof featureBannerAudiences)[number];
export type FeatureBannerTone = (typeof featureBannerTones)[number];
