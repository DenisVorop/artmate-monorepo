export const productStatuses = ["draft", "published", "archived"] as const;
export type ProductStatusDTO = (typeof productStatuses)[number];

export const productCurrencies = ["RUB"] as const;
export type ProductCurrencyDTO = (typeof productCurrencies)[number];

export type ProductImageDTO = {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
  createdAt: string;
};

export type ProductDTO = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: ProductStatusDTO;
  price: number;
  priceRub: number;
  currency: ProductCurrencyDTO;
  images: ProductImageDTO[];
  createdAt: string;
  updatedAt: string;
};

export type CreateProductInputDTO = {
  title: string;
  slug: string;
  description?: string;
  status?: ProductStatusDTO;
  priceRub: number;
  currency?: ProductCurrencyDTO;
};

export type UpdateProductInputDTO = Partial<CreateProductInputDTO>;

export type UpdateProductImageInputDTO = {
  alt?: string;
  sortOrder?: number;
};
