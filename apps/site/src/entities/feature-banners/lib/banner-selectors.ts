import type { FeatureBanner } from "../model";

export const featureBannerSlugs = {
  siteDevelopment: "site-development",
  telegramLink: "telegram-link",
} as const;

export function getFeatureBannerCta(banner: FeatureBanner) {
  if (!banner.ctaHref || !banner.ctaLabel) {
    return undefined;
  }

  return {
    href: banner.ctaHref,
    label: banner.ctaLabel,
  };
}

export function getFeatureBannersBySlug(banners: readonly FeatureBanner[]) {
  return banners.reduce<Partial<Record<string, FeatureBanner>>>((acc, banner) => {
    acc[banner.slug] = banner;
    return acc;
  }, {});
}
