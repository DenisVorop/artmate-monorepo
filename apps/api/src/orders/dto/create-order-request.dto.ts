import { Transform, Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateNested,
} from "class-validator";

import { IsYandexAttributionIdentifier } from "../../analytics/yandex-attribution";
import { ORDER_COMMENT_MAX_LENGTH } from "../orders.constants";
import {
  normalizePromoCodeValue,
  promoCodePattern,
} from "../../promocodes/promo-code";

import { CreateOrderDeliveryRequestDTO } from "./create-order-delivery-request.dto";
import { CreateOrderCustomerRequestDTO } from "./create-order-customer-request.dto";
import { CreateOrderPaymentRequestDTO } from "./create-order-payment-request.dto";

class YandexAttributionDTO {
  @IsOptional()
  @IsString()
  @IsYandexAttributionIdentifier()
  clientId?: string;

  @IsOptional()
  @IsString()
  @IsYandexAttributionIdentifier()
  yclid?: string;
}

export class CreateOrderRequestDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  checkoutAttemptId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => YandexAttributionDTO)
  attribution?: YandexAttributionDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderCustomerRequestDTO)
  customer!: CreateOrderCustomerRequestDTO;

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
