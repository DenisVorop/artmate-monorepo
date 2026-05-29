"use client";

import {
  featureBannerSlugs,
  getFeatureBannersBySlug,
} from "../lib/banner-selectors";

import { useFeatureBanners } from "./use-feature-banners";

export function useDevelopmentBanner() {
  const { banners, isError, isPending } = useFeatureBanners();
  const bannersBySlug = getFeatureBannersBySlug(banners);
  const banner = bannersBySlug[featureBannerSlugs.siteDevelopment];

  return {
    banner,
    hasDevelopmentBanner: Boolean(banner),
    isError,
    isPending,
  };
}
