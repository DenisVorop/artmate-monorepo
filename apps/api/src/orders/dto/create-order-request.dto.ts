import { Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { ORDER_COMMENT_MAX_LENGTH } from "../orders.constants";

import { CreateOrderDeliveryRequestDTO } from "./create-order-delivery-request.dto";
import { CreateOrderPaymentRequestDTO } from "./create-order-payment-request.dto";
import { OrderCustomerDTO } from "./order-customer.dto";

export class CreateOrderRequestDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => OrderCustomerDTO)
  customer!: OrderCustomerDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOrderDeliveryRequestDTO)
  delivery?: CreateOrderDeliveryRequestDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOrderPaymentRequestDTO)
  payment?: CreateOrderPaymentRequestDTO;

  @IsOptional()
  @IsString()
  @MaxLength(ORDER_COMMENT_MAX_LENGTH)
  comment?: string;

  @IsBoolean()
  @Equals(true)
  acceptedLegal!: boolean;

  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;
}
