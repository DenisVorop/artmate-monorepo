import { routes } from "@/shared/constants";

export const sourceLegalDocuments = {
  loyaltyRules: {
    contentType: "pdf",
    title: "Правила клуба Artmate",
    description: "Условия участия в клубе, начисления и использования баллов.",
    href: routes.legal.loyaltyRules,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/loyalty-rules-2026-09-22-v4.pdf",
  },
  publicOffer: {
    contentType: "pdf",
    title: "Публичная оферта",
    description: "Условия продажи товаров Artmate, оформления заказа, оплаты, доставки и возврата.",
    href: routes.legal.publicOffer,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/public-offer-2026-09-22.pdf",
  },
  personalDataConsent: {
    contentType: "pdf",
    title: "Согласие на обработку персональных данных",
    description:
      "Согласие пользователя на обработку персональных данных при использовании форм Artmate.",
    href: routes.legal.personalDataConsent,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/personal-data-consent-2026-09-22.pdf",
  },
  privacyPolicy: {
    contentType: "pdf",
    title: "Политика конфиденциальности",
    description: "Правила обработки и защиты персональных данных пользователей Artmate.",
    href: routes.legal.privacyPolicy,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/privacy-policy-2026-09-22.pdf",
  },
  userAgreement: {
    contentType: "pdf",
    title: "Пользовательское соглашение",
    description: "Условия использования сайта и сервисов Artmate.",
    href: routes.legal.userAgreement,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/user-agreement-2026-09-22.pdf",
  },
  cookiePolicy: {
    contentType: "pdf",
    title: "Политика Cookie",
    description: "Как Artmate использует cookie и метрические программы.",
    href: routes.legal.cookiePolicy,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/cookie-policy-2026-09-22.pdf",
  },
  advertisingConsent: {
    contentType: "pdf",
    title: "Согласие на получение рекламы",
    description: "Условия получения рекламных сообщений Artmate и отзыва согласия.",
    href: routes.legal.advertisingConsent,
    updatedAt: "22.09.2026",
    fileHref: "/documents/legal/advertising-consent-2026-09-22.pdf",
  },
} as const;
