import { Transform, Type } from "class-transformer";
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import {
  affiliatePartnerStatuses,
  type AffiliatePartnerStatus,
  strictIsoDateTimePattern,
} from "../affiliate.types";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class AffiliateContractInputDTO {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  number!: string;

  @Matches(strictIsoDateTimePattern)
  @IsISO8601({ strict: true })
  signedAt!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  paymentDetails!: string;
}

export class PutAffiliatePartnerRequestDTO {
  @IsIn(affiliatePartnerStatuses)
  status!: AffiliatePartnerStatus;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  partnerApplicationId!: string | null;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  minimumPayoutKopecks!: number | null;

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliateContractInputDTO)
  contract!: AffiliateContractInputDTO;
}
