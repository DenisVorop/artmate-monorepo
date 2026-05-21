import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { deliveryProviders, type DeliveryProvider } from "../orders.constants";

export class CreateOrderDeliveryRequestDTO {
  @IsIn(deliveryProviders)
  provider!: DeliveryProvider;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  pickupPointAddress?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  pickupPointId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  cityCode?: number;
}
