import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from "class-validator";

const maxSafeInteger = Number.MAX_SAFE_INTEGER;
const minSafeInteger = Number.MIN_SAFE_INTEGER;

export class AffiliateMetricsDTO {
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) orderCount!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) salesKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) earnedKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) reversedKopecks!: number;
  @IsDefined() @IsInt() @Min(minSafeInteger) @Max(maxSafeInteger) netKopecks!: number;
}

export class AffiliatePeriodDTO {
  @IsDefined() @IsIn([7, 30, 90]) days!: 7 | 30 | 90;
  @IsDefined() @IsISO8601() from!: string;
  @IsDefined() @IsISO8601() to!: string;
  @IsDefined() @IsIn(["Europe/Moscow"]) timeZone!: "Europe/Moscow";
}

export class AffiliateBalanceDTO {
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) availableKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) reservedKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) paidKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) debtKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) pendingKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) heldKopecks!: number;
  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) reversedKopecks!: number;
}

export class AffiliateDailyMetricsDTO extends AffiliateMetricsDTO {
  @IsDefined() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}

export class AffiliateCodeMetricsDTO extends AffiliateMetricsDTO {
  @IsDefined() @IsString() code!: string;
}

export class AffiliateCodeMetricsListDTO {
  @IsArray()
  @IsDefined()
  @ValidateNested({ each: true })
  @Type(() => AffiliateCodeMetricsDTO)
  items!: AffiliateCodeMetricsDTO[];

  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) total!: number;
  @IsDefined() @IsInt() @Min(1) @Max(maxSafeInteger) page!: number;
  @IsDefined() @IsInt() @Min(1) @Max(50) pageSize!: number;
}

export class AffiliateAnalyticsDTO {
  @IsDefined() @IsISO8601() asOf!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliatePeriodDTO)
  period!: AffiliatePeriodDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliateBalanceDTO)
  balance!: AffiliateBalanceDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliateMetricsDTO)
  totals!: AffiliateMetricsDTO;

  @IsArray()
  @IsDefined()
  @ValidateNested({ each: true })
  @Type(() => AffiliateDailyMetricsDTO)
  daily!: AffiliateDailyMetricsDTO[];

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliateCodeMetricsListDTO)
  codes!: AffiliateCodeMetricsListDTO;
}

export class AffiliateLedgerEntryDTO {
  @IsDefined() @IsString() id!: string;
  @IsDefined() @IsString() code!: string;
  @IsDefined() @IsIn(["credit", "reversal"]) kind!: "credit" | "reversal";
  @IsDefined() @IsInt() @Min(minSafeInteger) @Max(maxSafeInteger) amountKopecks!: number;
  @IsDefined() @IsISO8601() createdAt!: string;
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsISO8601()
  availableAt!: string | null;
  @IsDefined()
  @IsIn(["pending", "available", "held", "reversed", "not_earned"])
  status!: "pending" | "available" | "held" | "reversed" | "not_earned";
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsIn(["order_cancelled", "payment_not_confirmed", "order_not_completed"])
  holdReason!:
    | "order_cancelled"
    | "payment_not_confirmed"
    | "order_not_completed"
    | null;
  @IsDefined() @IsBoolean() isSelfPurchase!: boolean;
  @IsDefined() @IsInt() @Min(0) @Max(15) partnerPercent!: number;
}

export class AffiliateLedgerDTO {
  @IsDefined() @IsISO8601() asOf!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AffiliatePeriodDTO)
  period!: AffiliatePeriodDTO;

  @IsArray()
  @IsDefined()
  @ValidateNested({ each: true })
  @Type(() => AffiliateLedgerEntryDTO)
  items!: AffiliateLedgerEntryDTO[];

  @IsDefined() @IsInt() @Min(0) @Max(maxSafeInteger) total!: number;
  @IsDefined() @IsInt() @Min(1) @Max(maxSafeInteger) page!: number;
  @IsDefined() @IsInt() @Min(1) @Max(50) pageSize!: number;
}
