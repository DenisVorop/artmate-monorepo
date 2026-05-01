export const routes = {
  home: "/",
  auth: "/auth",
  authOAuth: (provider: string) => `/auth/oauth/${provider}`,
  account: "/account",
  cart: "/cart",
  catalog: "/katalog",
  raskraski: "/katalog/raskraski",
  catalogCategory: (categorySlug: string) => `/katalog/raskraski/${categorySlug}`,
  blog: "/blog",
  blogPost: (id: string) => `/blog/${id}`,
  gallery: "/gallery",
  checkout: "/checkout",
  checkoutSuccess: "/checkout/success",
  paymentAndDelivery: "/payment-and-delivery",
  contacts: "/contacts",
  faq: "/faq",
  product: (categorySlug: string | undefined, productSlug: string) =>
    categorySlug
      ? `/katalog/raskraski/${categorySlug}/${productSlug}`
      : `/katalog/raskraski/${productSlug}`,
  legal: {
    privacyPolicy: "/legal/privacy-policy",
    publicOffer: "/legal/public-offer",
    userAgreement: "/legal/user-agreement",
    personalDataConsent: "/legal/personal-data-consent",
    cookiePolicy: "/legal/cookie-policy",
    returnPolicy: "/legal/return-policy",
  },
} as const;
