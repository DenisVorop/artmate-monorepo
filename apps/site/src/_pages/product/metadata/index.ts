import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared";

const title = "Альбом Artmate - раскраска по номерам";
const description =
  "Подробная информация об альбоме Artmate: фотографии, характеристики, отзывы и похожие раскраски по номерам.";

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
        alt: "Альбом Artmate - раскраска по номерам",
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
