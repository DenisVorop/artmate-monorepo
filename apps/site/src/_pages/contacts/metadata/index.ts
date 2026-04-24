import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared/constants";

const title = "Контакты Artmate - свяжитесь с\u00a0нами";
const description =
  "Свяжитесь с\u00a0командой Artmate по\u00a0вопросам заказов, доставки, возвратов, сотрудничества и\u00a0выбора раскрасок.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.contacts,
  },
  openGraph: {
    title,
    description,
    url: routes.contacts,
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
