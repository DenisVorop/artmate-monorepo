import type { FeatureBanner } from "../model";

export function getFeatureBannerCta(banner: FeatureBanner) {
  if (!banner.ctaHref || !banner.ctaLabel) {
    return undefined;
  }

  return {
    href: banner.ctaHref,
    label: banner.ctaLabel,
  };
}
