import type { Metadata } from "next";
import { routes, siteConfig } from "@/shared";

const title = "Контакты Artmate - свяжитесь с нами";
const description =
  "Свяжитесь с командой Artmate по вопросам заказов, доставки, возвратов, сотрудничества и выбора раскрасок.";

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
