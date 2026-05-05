const defaultSiteUrl = "https://www.art-mate.ru";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "Artmate",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl),
  locale: "ru_RU",
  description:
    "Раскраски по\u00a0номерам Artmate для\u00a0взрослых и\u00a0детей: антистресс-альбомы A4 на\u00a0спирали, бумага 190 г/м², 25 иллюстраций и\u00a0сюжеты под\u00a0настроение.",
  ogImage: "/opengraph-image",
} as const;

export function getAbsoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}
