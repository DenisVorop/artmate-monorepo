import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { deliveryPickupPointIdMaxLength } from "../../delivery/delivery.constants";

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
  @MaxLength(deliveryPickupPointIdMaxLength)
  @IsOptional()
  pickupPointId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  cityCode?: number;
}
