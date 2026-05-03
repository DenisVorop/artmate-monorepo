const defaultSiteUrl = "https://www.art-mate.ru";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "Artmate",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl),
  locale: "ru_RU",
  description:
    "Раскраски по\u00a0номерам Artmate: альбомы A4 на\u00a0спирали, плотная бумага 190 г/м², сюжеты с\u00a0котиками, цветами, пейзажами и\u00a0поп-артом.",
  ogImage: "/opengraph-image",
} as const;

export function getAbsoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}
