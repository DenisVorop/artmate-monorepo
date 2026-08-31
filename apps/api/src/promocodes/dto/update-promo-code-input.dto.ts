import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches } from "class-validator";
import { OmitType } from "@nestjs/swagger";

import { normalizePromoCodeValue, promoCodePattern } from "../promo-code";

import { PromoCodeInputDTO } from "./promo-code-input.dto";

export class UpdatePromoCodeInputDTO extends OmitType(PromoCodeInputDTO, [
  "code",
] as const) {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePromoCodeValue(value) : value,
  )
  @IsString()
  @Matches(promoCodePattern)
  code?: string;
}
