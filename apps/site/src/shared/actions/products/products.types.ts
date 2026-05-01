export type ProductCategory = {
  id: string;
  title: string;
  slug: string;
  image: string;
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
  categoryId?: string;
  category?: ApiProductCategoryDTO;
  price: number;
  priceRub: number;
  currency: "RUB";
  images: ApiProductImageDTO[];
  createdAt: string;
  updatedAt: string;
};
