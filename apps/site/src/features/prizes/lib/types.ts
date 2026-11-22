import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
export type {
  ProductPrize,
  PrizeProductGroup,
  AvailablePrize,
  PromoPrize,
  PrizeProduct,
  PrizeHistoryItem,
} from "@/entities/prize";
export type PrizePickupSelection = { city: DeliveryCityDTO; point: DeliveryPickupPointDTO };
