import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";

import {
  normalizePromoCodeValue,
  promoCodePattern,
} from "../../promocodes/promo-code";

import { CreateOrderDeliveryRequestDTO } from "./create-order-delivery-request.dto";

export class CalculateCheckoutRequestDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderDeliveryRequestDTO)
  delivery!: CreateOrderDeliveryRequestDTO;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePromoCodeValue(value) : value,
  )
  @IsString()
  @Matches(promoCodePattern)
  promoCode?: string;
}
