import type { FeatureBannerDTO } from "@/shared/actions/feature-banners";

export type FeatureBanner = FeatureBannerDTO;
export type FeatureBannerAudience = FeatureBanner["audiences"][number];
export type FeatureBannerTone = FeatureBanner["tone"];
