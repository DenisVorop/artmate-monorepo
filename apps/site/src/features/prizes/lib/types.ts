import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
export type {
  AlbumPrize,
  AvailablePrize,
  PromoPrize,
  PrizeAlbum,
  PrizeHistoryItem,
} from "@/entities/prize";
export type PrizePickupSelection = { city: DeliveryCityDTO; point: DeliveryPickupPointDTO };
