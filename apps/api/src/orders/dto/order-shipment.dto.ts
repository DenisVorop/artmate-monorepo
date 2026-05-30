import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

import {
  deliveryProviders,
  type DeliveryProvider,
} from "../orders.constants";

export class OrderShipmentDTO {
  @IsIn(deliveryProviders)
  provider!: DeliveryProvider;

  @IsOptional()
  @IsString()
  externalUuid?: string;

  @IsOptional()
  @IsString()
  externalNumber?: string;

  @IsOptional()
  @IsString()
  requestUuid?: string;

  @IsOptional()
  @IsString()
  requestState?: string;

  @IsOptional()
  @IsString()
  statusCode?: string;

  @IsOptional()
  @IsString()
  statusName?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;

  @IsOptional()
  @IsISO8601()
  syncedAt?: string;
}
