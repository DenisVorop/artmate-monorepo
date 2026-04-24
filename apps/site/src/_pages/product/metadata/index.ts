import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared/constants";

const title = "Альбом Artmate - раскраска по\u00a0номерам";
const description =
  "Подробная информация об\u00a0альбоме Artmate: фотографии, характеристики, отзывы и\u00a0похожие раскраски по\u00a0номерам.";

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
        alt: "Альбом Artmate - раскраска по\u00a0номерам",
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
