import { routes } from "@/shared/constants";

export const sourceLegalDocuments = {
  publicOffer: {
    contentType: "pdf",
    title: "Публичная оферта",
    description: "Условия продажи товаров Artmate, оформления заказа, оплаты, доставки и возврата.",
    href: routes.legal.publicOffer,
    updatedAt: "24.07.2026",
    fileHref: "/documents/legal/public-offer-2026-07-24.pdf",
  },
  personalDataConsent: {
    contentType: "pdf",
    title: "Согласие на обработку персональных данных",
    description:
      "Согласие пользователя на обработку персональных данных при использовании форм Artmate.",
    href: routes.legal.personalDataConsent,
    updatedAt: "24.07.2026",
    fileHref: "/documents/legal/personal-data-consent-2026-07-24.pdf",
  },
} as const;
