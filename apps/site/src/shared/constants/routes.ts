const coloringNumberPattern = /^(?:0[1-9]|[1-9]\d)$/;

export function formatColoringNumber(number: number) {
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw new RangeError("Coloring number must be an integer from 1 to 99");
  }

  return String(number).padStart(2, "0");
}

export function parseColoringNumber(value: string) {
  if (!coloringNumberPattern.test(value)) {
    return null;
  }

  return Number(value);
}

export const routes = {
  home: "/",
  auth: "/auth",
  authOAuth: (provider: string) => `/auth/oauth/${provider}`,
  authResetPassword: "/auth/reset-password",
  account: "/account",
  cart: "/cart",
  catalog: "/catalog",
  colorings: "/raskraski",
  coloringCollection: (slug: string) => `/raskraski/digital/${slug}`,
  digitalCollection: (slug: string) => `/raskraski/digital/${slug}`,
  coloring: (collectionSlug: string, number: number) =>
    `/raskraski/digital/${collectionSlug}/${formatColoringNumber(number)}`,
  catalogCategory: (categorySlug: string) => `/catalog/raskraski/${categorySlug}`,
  catalogLanding: (slug: string) => `/catalog/podborki/${slug}`,
  blog: "/blog",
  blogPost: (id: string) => `/blog/${id}`,
  checkout: "/checkout",
  checkoutFailure: "/checkout/failure",
  checkoutPayment: "/checkout/payment",
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
    promocodes: "/legal/promocodes",
  },
} as const;
