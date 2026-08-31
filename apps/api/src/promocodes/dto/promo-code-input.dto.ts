import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  normalizePromoCodeValue,
  promoCodePattern,
  strictIsoDateTimePattern,
} from "../promo-code";
import { promoCodeTypes, type PromoCodeType } from "../promocodes.types";

export class PromoCodeInputDTO {
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePromoCodeValue(value) : value,
  )
  @IsString()
  @Matches(promoCodePattern)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsIn(promoCodeTypes)
  type!: PromoCodeType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  basisPoints?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountKopecks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  maxDiscountKopecks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  minSubtotalKopecks?: number;

  @IsOptional()
  @Matches(strictIsoDateTimePattern)
  @IsISO8601({ strict: true })
  startsAt?: string | null;

  @IsOptional()
  @Matches(strictIsoDateTimePattern)
  @IsISO8601({ strict: true })
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  maxUses?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  maxUsesPerUser?: number | null;

  @IsBoolean()
  isActive!: boolean;
}
