import type { Metadata } from "next";
import { siteConfig } from "@/shared";

const title = "Artmate - раскраски по\u00a0номерам для\u00a0отдыха и\u00a0творчества";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description: siteConfig.description,
    url: "/",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Artmate - раскраски по\u00a0номерам",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
};
