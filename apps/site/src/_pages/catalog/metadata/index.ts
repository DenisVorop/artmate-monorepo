import type { Metadata } from "next";
import { siteConfig } from "@/shared";

const title = "Каталог Artmate - раскраски по номерам";
const description =
  "Выберите раскраску Artmate по настроению, формату, цене и уровню детализации для спокойного творческого вечера.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: "/catalog",
  },
  openGraph: {
    title,
    description,
    url: "/catalog",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Каталог Artmate - раскраски по номерам",
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
