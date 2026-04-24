import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared/constants";

const title = "FAQ Artmate - ответы на\u00a0частые вопросы";
const description =
  "Ответы на\u00a0частые вопросы Artmate о\u00a0заказах, оплате, доставке, возвратах, книгах и\u00a0раскрашивании.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.faq,
  },
  openGraph: {
    title,
    description,
    url: routes.faq,
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
