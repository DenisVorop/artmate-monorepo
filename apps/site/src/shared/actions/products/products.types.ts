export type ProductCategory = {
  id: string;
  title: string;
  slug: string;
  image: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductTag = {
  id: string;
  slug: string;
  title: string;
  group: "format" | "theme" | "audience" | "mood" | "difficulty";
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  price: number;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  image: string;
  images: string[];
  description: string;
  isHit: boolean;
  isOutOfStock: boolean;
  tags: ProductTag[];
  createdAt: string;
  updatedAt: string;
};

export type ProductHighlight = {
  id: "delivery" | "paper" | "print";
  title: string;
  description: string;
};

export type ProductsData = {
  categories: ProductCategory[];
  products: Product[];
  productSpecs: string[];
  productHowItWorks: string;
  productHighlights: ProductHighlight[];
};

export type ApiProductCategoryDTO = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiProductTagDTO = {
  id: string;
  slug: string;
  title: string;
  group: "format" | "theme" | "audience" | "mood" | "difficulty";
  createdAt: string;
  updatedAt: string;
};

export type ApiProductImageDTO = {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
  createdAt: string;
};

export type ApiProductDTO = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: "draft" | "published" | "archived";
  isHit: boolean;
  isOutOfStock: boolean;
  categoryId?: string;
  category?: ApiProductCategoryDTO;
  price: number;
  priceRub: number;
  currency: "RUB";
  images: ApiProductImageDTO[];
  tags: ApiProductTagDTO[];
  createdAt: string;
  updatedAt: string;
};
