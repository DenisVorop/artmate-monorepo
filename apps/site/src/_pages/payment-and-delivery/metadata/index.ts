import type { Metadata } from "next";

import { routes, siteConfig } from "@/shared/constants";

const title = "Оплата и доставка - Artmate";
const description =
  "Как оформить заказ Artmate, оплатить его через Ozon Pay и получить доставку в пункт выдачи Ozon.";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: routes.paymentAndDelivery,
  },
  openGraph: {
    title,
    description,
    url: routes.paymentAndDelivery,
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
