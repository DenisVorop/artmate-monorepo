import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsISO8601, IsString, Max, Min, ValidateIf, ValidateNested } from "class-validator";

const statuses = ["pending", "paid", "rejected", "cancelled"] as const;

export class AffiliatePayoutEventDTO {
  @IsDefined() @IsString() id!: string;
  @IsDefined() @IsIn(statuses) status!: (typeof statuses)[number];
  @IsDefined() @IsISO8601() createdAt!: string;
  @ValidateIf((_, value) => value !== null) @IsDefined() @IsString() actorUserId!: string | null;
  @ValidateIf((_, value) => value !== null) @IsDefined() @IsString() reason!: string | null;
}

export class AffiliatePayoutContractDTO {
  @IsDefined() @IsInt() @Min(1) version!: number;
  @IsDefined() @IsString() number!: string;
  @IsDefined() @IsISO8601() signedAt!: string;
  @IsDefined() @IsString() paymentDetails!: string;
}

export class AffiliatePayoutDTO {
  @IsDefined() @IsString() id!: string;
  @IsDefined() @IsIn(statuses) status!: (typeof statuses)[number];
  @IsDefined() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountKopecks!: number;
  @IsDefined() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) minimumPayoutKopecks!: number;
  @IsDefined() @IsISO8601() createdAt!: string;
  @IsDefined() @IsISO8601() updatedAt!: string;
  @ValidateIf((_, value) => value !== null) @IsDefined() @IsISO8601() paidAt!: string | null;
  @ValidateIf((_, value) => value !== null) @IsDefined() @IsString() reference!: string | null;
  @ValidateIf((_, value) => value !== null) @IsDefined() @IsString() reason!: string | null;
  @IsDefined() @ValidateNested() @Type(() => AffiliatePayoutContractDTO) contract!: AffiliatePayoutContractDTO;
  @IsDefined() @IsArray() @ValidateNested({ each: true }) @Type(() => AffiliatePayoutEventDTO) events!: AffiliatePayoutEventDTO[];
}

export class AffiliatePayoutSummaryDTO {
  @IsDefined() @IsISO8601() asOf!: string;
  @IsDefined() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) availableKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) reservedKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) paidKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) debtKopecks!: number;
  @IsDefined() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) minimumPayoutKopecks!: number;
  @IsDefined() @IsBoolean() canRequest!: boolean;
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsIn(["partner_inactive", "open_request", "debt", "no_available_balance", "below_minimum"])
  blockedReason!: "partner_inactive" | "open_request" | "debt" | "no_available_balance" | "below_minimum" | null;
}

export class AffiliatePayoutListDTO {
  @IsDefined() @ValidateNested() @Type(() => AffiliatePayoutSummaryDTO) summary!: AffiliatePayoutSummaryDTO;
  @IsDefined() @IsArray() @ValidateNested({ each: true }) @Type(() => AffiliatePayoutDTO) items!: AffiliatePayoutDTO[];
  @IsDefined() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) total!: number;
  @IsDefined() @IsInt() @Min(1) page!: number;
  @IsDefined() @IsInt() @Min(1) @Max(50) pageSize!: number;
}
