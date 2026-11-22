import type { ContestAward } from "@repo/ui/contest-prizes";
export type PrizeProductDTO = { id: string; title: string; image: string; available: boolean };
export type PrizeProductGroupDTO = {
  kind: "albums" | "markers";
  quantity: number;
  products: PrizeProductDTO[];
};
export type ProductPrizeDTO = {
  id: string;
  kind: "products";
  title: string;
  contestTitle: string;
  contestSlug: string;
  awardedAt: string;
  award?: ContestAward;
  groups: PrizeProductGroupDTO[];
  orderId: string | null;
};
export type ProductPrizeHistoryDTO = Omit<ProductPrizeDTO, "groups" | "orderId"> & {
  orderId: string;
  usedAt: string;
  products: PrizeProductDTO[];
};
export type PromoPrizeDTO = {
  id: string;
  kind: "promocode";
  code: string;
  contestTitle: string;
  contestSlug: string;
  awardedAt: string;
  award?: ContestAward;
  status: "available" | "upcoming" | "reserved" | "used" | "expired" | "disabled";
  discountPercent: number | null;
  amount: number | null;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  orderId: string | null;
  usedAt: string | null;
};
export type AvailablePrizeDTO = ProductPrizeDTO | PromoPrizeDTO;
export type PrizeHistoryDTO = ProductPrizeHistoryDTO | PromoPrizeDTO;
export type MyPrizesDTO = { available: AvailablePrizeDTO[]; history: PrizeHistoryDTO[] };
export type CreatePrizeOrderInput = {
  productIds: string[];
  customer: { name: string; phone: string; email: string };
  pickupPointId: string;
  acceptedLegal: boolean;
  acceptedPersonalDataConsent: boolean;
  comment?: string;
};
