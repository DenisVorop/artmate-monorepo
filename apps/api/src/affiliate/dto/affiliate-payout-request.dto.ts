import { Equals, IsBoolean, IsDefined, IsInt, IsISO8601, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateAffiliatePayoutRequestDTO {
  @IsDefined() @IsUUID() requestId!: string;
  @IsDefined() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountKopecks!: number;
}

export class MarkAffiliatePayoutPaidRequestDTO {
  @IsDefined() @IsUUID() requestId!: string;
  @IsDefined() @IsISO8601({ strict: true }) paidAt!: string;
  @IsDefined() @IsString() @MinLength(1) @MaxLength(160) reference!: string;
  @IsDefined() @IsBoolean() @Equals(true) confirmed!: true;
}

export class RejectAffiliatePayoutRequestDTO {
  @IsDefined() @IsUUID() requestId!: string;
  @IsDefined() @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
}
