import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared";

const title = "Каталог Artmate - товары для\u00a0творчества";
const description =
  "Выберите раскраски и\u00a0товары Artmate по\u00a0настроению, формату, цене и\u00a0уровню детализации для\u00a0спокойного творческого вечера.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.catalog,
  },
  openGraph: {
    title,
    description,
    url: routes.catalog,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Каталог Artmate - раскраски по\u00a0номерам",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [siteConfig.ogImage],
  },
};
