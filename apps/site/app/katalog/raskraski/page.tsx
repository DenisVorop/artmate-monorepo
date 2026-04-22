import type { Metadata } from "next";

import { CatalogPage } from "@/pages/catalog";
import { routes, siteConfig } from "@/shared";

const title = "Раскраски Artmate - каталог раскрасок по\u00a0номерам";
const description =
  "Выберите раскраску Artmate по\u00a0теме, настроению, цене и\u00a0уровню детализации для\u00a0спокойного творческого вечера.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.raskraski,
  },
  openGraph: {
    title,
    description,
    url: routes.raskraski,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: title,
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

export default function Page() {
  return <CatalogPage />;
}
