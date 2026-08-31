import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import {
  promoCodeKinds,
  promoCodeTypes,
  promoRedemptionStatuses,
  type PromoCodeKind,
  type PromoCodeType,
  type PromoRedemptionStatus,
} from "../promocodes.types";

export class PromoCodeUsageDTO {
  @IsString() orderId!: string;
  @IsIn(promoRedemptionStatuses) status!: PromoRedemptionStatus;
  @IsISO8601() createdAt!: string;
  @IsOptional() @IsISO8601() usedAt!: string | null;
}

export class PromoCodeAdminDTO {
  @IsString() id!: string;
  @IsString() code!: string;
  @IsIn(promoCodeKinds) kind!: PromoCodeKind;
  @IsString() name!: string;
  @IsOptional() @IsString() description!: string | null;
  @IsIn(promoCodeTypes) type!: PromoCodeType;
  @IsOptional() @IsInt() @Min(1) basisPoints!: number | null;
  @IsOptional() @IsInt() @Min(1) amountKopecks!: number | null;
  @IsOptional() @IsInt() @Min(1) maxDiscountKopecks!: number | null;
  @IsInt() @Min(0) minSubtotalKopecks!: number;
  @IsOptional() @IsISO8601() startsAt!: string | null;
  @IsOptional() @IsISO8601() endsAt!: string | null;
  @IsOptional() @IsInt() @Min(1) maxUses!: number | null;
  @IsOptional() @IsInt() @Min(1) maxUsesPerUser!: number | null;
  @IsBoolean() isActive!: boolean;
  @IsInt() @Min(0) usedCount!: number;
  @IsInt() @Min(0) reservedCount!: number;
  @IsISO8601() createdAt!: string;
  @IsISO8601() updatedAt!: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoCodeUsageDTO)
  usages?: PromoCodeUsageDTO[];
}
