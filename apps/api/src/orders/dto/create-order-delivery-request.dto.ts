import { IsIn, IsNotEmpty, IsString } from "class-validator";

import {
  deliveryProviders,
  type DeliveryProvider,
} from "../orders.constants";

export class CreateOrderDeliveryRequestDTO {
  @IsIn(deliveryProviders)
  provider!: DeliveryProvider;

  @IsString()
  @IsNotEmpty()
  pickupPointAddress!: string;
}
