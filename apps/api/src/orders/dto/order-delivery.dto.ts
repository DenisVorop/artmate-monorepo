import { Type } from "class-transformer";
import { IsDefined, IsIn, ValidateNested } from "class-validator";

import {
  deliveryProviders,
  type DeliveryProvider,
} from "../orders.constants";

import { PickupPointDTO } from "./pickup-point.dto";

export class OrderDeliveryDTO {
  @IsIn(deliveryProviders)
  provider!: DeliveryProvider;

  @IsDefined()
  @ValidateNested()
  @Type(() => PickupPointDTO)
  pickupPoint!: PickupPointDTO;
}
