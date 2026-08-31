export type PromoPreviewDTO = {
  code: string;
  cartId: string;
  subtotal: number;
  discount: number;
  total: number;
  currency: "RUB";
};

export type PromoCodeInputDTO = {
  code: string;
};
