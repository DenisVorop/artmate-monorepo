export const productStatuses = ["draft", "published", "archived"] as const;
export type ProductStatusDTO = (typeof productStatuses)[number];

export const productTagGroups = [
  "format",
  "theme",
  "audience",
  "mood",
  "difficulty",
] as const;
export type ProductTagGroupDTO = (typeof productTagGroups)[number];

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

export type ProductTagDTO = {
  id: string;
  slug: string;
  title: string;
  group: ProductTagGroupDTO;
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
  isOzonDeliveryAvailable: boolean;
  categoryId?: string;
  category?: ProductCategoryDTO;
  price: number;
  priceRub: number;
  currency: ProductCurrencyDTO;
  images: ProductImageDTO[];
  tags: ProductTagDTO[];
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
  isOzonDeliveryAvailable?: boolean;
  categoryId?: string;
  priceRub: number;
  currency?: ProductCurrencyDTO;
  tagIds?: string[];
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

export type CreateProductTagInputDTO = {
  title: string;
  slug: string;
  group?: ProductTagGroupDTO;
};

export type UpdateProductTagInputDTO = Partial<CreateProductTagInputDTO>;

export type UpdateProductImageInputDTO = {
  alt?: string;
  sortOrder?: number;
};
