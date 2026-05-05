export const routes = {
  home: "/",
  auth: "/auth",
  authOAuth: (provider: string) => `/auth/oauth/${provider}`,
  account: "/account",
  cart: "/cart",
  catalog: "/catalog",
  catalogCategory: (categorySlug: string) => `/catalog/raskraski/${categorySlug}`,
  blog: "/blog",
  blogPost: (id: string) => `/blog/${id}`,
  checkout: "/checkout",
  checkoutSuccess: "/checkout/success",
  paymentAndDelivery: "/payment-and-delivery",
  contacts: "/contacts",
  faq: "/faq",
  product: (categorySlug: string | undefined, productSlug: string) =>
    categorySlug
      ? `/catalog/raskraski/${categorySlug}/${productSlug}`
      : `/catalog/raskraski/${productSlug}`,
  legal: {
    privacyPolicy: "/legal/privacy-policy",
    publicOffer: "/legal/public-offer",
    userAgreement: "/legal/user-agreement",
    personalDataConsent: "/legal/personal-data-consent",
    cookiePolicy: "/legal/cookie-policy",
    returnPolicy: "/legal/return-policy",
  },
} as const;
