export const productStatuses = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const productCurrencies = ["RUB"] as const;
export type ProductCurrency = (typeof productCurrencies)[number];

export const productImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProductImageMimeType = (typeof productImageMimeTypes)[number];
