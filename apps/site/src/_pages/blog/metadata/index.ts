import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared";

const title = "Блог Artmate - вдохновение и\u00a0советы";
const description =
  "Статьи Artmate о\u00a0раскрашивании, материалах, цветовых сочетаниях и\u00a0творческом отдыхе.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.blog,
  },
  openGraph: {
    title,
    description,
    url: routes.blog,
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
