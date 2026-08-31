import type {
  FeatureBanner,
  FeatureBannerAudience,
  FeatureBannerTone,
} from "../model";

export const featureBannerAudiences: readonly FeatureBannerAudience[] = [
  "all",
  "authenticated",
  "anonymous",
  "telegram_unlinked",
];

export const featureBannerTones: readonly FeatureBannerTone[] = [
  "info",
  "success",
  "warning",
];

export function getFeatureBannerAudienceLabel(audience: FeatureBannerAudience) {
  switch (audience) {
    case "all":
      return "Все";
    case "authenticated":
      return "Авторизованные";
    case "anonymous":
      return "Гости";
    case "telegram_unlinked":
      return "Авторизованные без Telegram";
  }
}

export function getFeatureBannerToneLabel(tone: FeatureBannerTone) {
  switch (tone) {
    case "info":
      return "Инфо";
    case "success":
      return "Успех";
    case "warning":
      return "Важно";
  }
}

export function getFeatureBannerStatusLabel(banner: FeatureBanner) {
  if (banner.archivedAt) {
    return "Архив";
  }

  return banner.enabled ? "Включен" : "Выключен";
}
