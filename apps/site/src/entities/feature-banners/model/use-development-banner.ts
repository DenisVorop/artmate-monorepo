"use client";

import {
  featureBannerSlugs,
  getFeatureBannersBySlug,
} from "../lib/banner-selectors";

import { useFeatureBanners } from "./use-feature-banners";

type UseDevelopmentBannerInput = {
  enabled: boolean;
  owner: string;
};

export function useDevelopmentBanner(input: UseDevelopmentBannerInput) {
  const { banners, isError, isPending } = useFeatureBanners(input);
  const bannersBySlug = getFeatureBannersBySlug(banners);
  const banner = bannersBySlug[featureBannerSlugs.siteDevelopment];

  return {
    banner,
    hasDevelopmentBanner: Boolean(banner),
    isError,
    isPending,
  };
}
