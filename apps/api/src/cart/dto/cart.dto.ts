export type CartProductDTO = {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  categorySlug: string;
  image: string;
};

export type CartItemDTO = CartProductDTO & {
  quantity: number;
  lineTotal: number;
};

export type CartDTO = {
  id: string;
  items: CartItemDTO[];
  itemsCount: number;
  subtotal: number;
  total: number;
  currency: "RUB";
};

export type AddCartItemRequestDTO = {
  product: CartProductDTO;
  quantity?: number;
};

export type UpdateCartItemRequestDTO = {
  quantity: number;
};
