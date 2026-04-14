export const routes = {
  home: "/",
  shop: "/shop",
  blog: "/blog",
  blogPost: (id: string) => `/blog/${id}`,
  gallery: "/gallery",
  checkout: "/checkout",
  contact: "/contact",
  faq: "/faq",
  product: (id: string) => `/product/${id}`,
  legal: {
    privacyPolicy: "/legal/privacy-policy",
    publicOffer: "/legal/public-offer",
    userAgreement: "/legal/user-agreement",
    personalDataConsent: "/legal/personal-data-consent",
    cookiePolicy: "/legal/cookie-policy",
    returnPolicy: "/legal/return-policy",
  },
} as const;
