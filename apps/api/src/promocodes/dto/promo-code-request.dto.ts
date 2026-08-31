import { Transform } from "class-transformer";
import { IsString, Matches } from "class-validator";

import { normalizePromoCodeValue, promoCodePattern } from "../promo-code";

export class PromoCodeRequestDTO {
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePromoCodeValue(value) : value,
  )
  @IsString()
  @Matches(promoCodePattern)
  code!: string;
}
