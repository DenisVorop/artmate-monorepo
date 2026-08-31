import { Transform, Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateNested,
} from "class-validator";

import { ORDER_COMMENT_MAX_LENGTH } from "../orders.constants";
import {
  normalizePromoCodeValue,
  promoCodePattern,
} from "../../promocodes/promo-code";

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

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePromoCodeValue(value) : value,
  )
  @IsString()
  @Matches(promoCodePattern)
  promoCode?: string;

  @IsBoolean()
  @Equals(true)
  acceptedLegal!: boolean;

  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;
}
