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

export type ProductCategoryDTO = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductDTO = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: ProductStatusDTO;
  isHit: boolean;
  isOutOfStock: boolean;
  categoryId?: string;
  category?: ProductCategoryDTO;
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
  isHit?: boolean;
  isOutOfStock?: boolean;
  categoryId?: string;
  priceRub: number;
  currency?: ProductCurrencyDTO;
};

export type UpdateProductInputDTO = Partial<Omit<CreateProductInputDTO, "categoryId">> & {
  categoryId?: string | null;
};

export type CreateProductCategoryInputDTO = {
  title: string;
  slug: string;
  image?: string;
};

export type UpdateProductCategoryInputDTO = Partial<CreateProductCategoryInputDTO>;

export type UpdateProductImageInputDTO = {
  alt?: string;
  sortOrder?: number;
};
