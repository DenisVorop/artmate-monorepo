import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
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

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  loyaltyPointsToSpend?: number;
}
