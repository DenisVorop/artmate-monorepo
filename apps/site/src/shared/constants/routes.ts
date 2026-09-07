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
  authOrderActivation: "/auth/activate-order",
  authOAuth: (provider: string) => `/auth/oauth/${provider}`,
  authRecovery: "/auth/recovery",
  authResetPassword: "/auth/reset-password",
  account: "/account",
  workshop: "/account/workshop",
  workshopCollection: (collectionSlug: string) => `/account/workshop/${collectionSlug}`,
  workshopColoring: (collectionSlug: string, number: number) =>
    `/account/workshop/${collectionSlug}/${formatColoringNumber(number)}`,
  publicWorkshop: (handle: string) => `/club/${handle}`,
  publicWork: (publicId: string) => `/club/works/${publicId}`,
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
  partners: "/partners",
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
