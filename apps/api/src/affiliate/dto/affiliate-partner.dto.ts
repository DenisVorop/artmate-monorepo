import { Type } from "class-transformer";
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import {
  affiliatePartnerStatuses,
  type AffiliatePartnerStatus,
} from "../affiliate.types";

export class AffiliatePartnerSummaryDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  userName!: string | null;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  userEmail!: string | null;

  @IsIn(affiliatePartnerStatuses)
  status!: AffiliatePartnerStatus;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  partnerApplicationId!: string | null;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  minimumPayoutKopecks!: number | null;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  effectiveMinimumPayoutKopecks!: number;

  @IsInt()
  @Min(1)
  contractVersion!: number;

  @IsISO8601({ strict: true })
  createdAt!: string;

  @IsISO8601({ strict: true })
  updatedAt!: string;
}

export class AffiliateContractDTO {
  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsISO8601({ strict: true })
  signedAt!: string;

  @IsString()
  @IsNotEmpty()
  paymentDetails!: string;
}

export class AffiliatePartnerDTO extends AffiliatePartnerSummaryDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliateContractDTO)
  contract!: AffiliateContractDTO;
}
