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

export type WelcomePromoDTO = {
  code: string;
  discountPercent: number | null;
  amount: number | null;
  minSubtotal: number;
  maxDiscount: number | null;
  endsAt: string | null;
};

export type WelcomePromoResponseDTO = {
  promo: WelcomePromoDTO | null;
};

export type WelcomeOfferDTO = {
  action: "authorize" | "link_telegram";
  discountPercent: number | null;
  amount: number | null;
  minSubtotal: number;
  maxDiscount: number | null;
  endsAt: string | null;
};

export type WelcomeOfferResponseDTO = {
  offer: WelcomeOfferDTO | null;
};
