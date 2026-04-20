const defaultSiteUrl = "https://artmate.ru";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "Artmate",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl),
  locale: "ru_RU",
  description:
    "Раскраски по номерам Artmate: альбомы A4 на спирали, плотная бумага 190 г/м², сюжеты с котиками, цветами, пейзажами и поп-артом.",
  ogImage: "/opengraph-image",
} as const;

export function getAbsoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}
