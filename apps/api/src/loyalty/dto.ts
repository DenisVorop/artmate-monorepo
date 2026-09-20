import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class EnrollLoyaltyDTO {
  @ApiProperty({ enum: [true] })
  @Equals(true)
  acceptedTerms!: true;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  termsVersion!: string;
}

export class LoyaltyHistoryQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[1-9]\d{0,15}$/)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class LoyaltyWalletDTO {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  balancePoints!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  reservedPoints!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  availablePoints!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  revision!: number;
}

export class LoyaltyMemberDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsDateString()
  joinedAt!: string;

  @ApiProperty()
  @IsString()
  termsVersion!: string;

  @ApiProperty({ enum: ["active", "blocked"] })
  @IsIn(["active", "blocked"])
  status!: "active" | "blocked";

  @ApiProperty({ enum: ["pending", "ready", "failed"] })
  @IsIn(["pending", "ready", "failed"])
  historyState!: "pending" | "ready" | "failed";

  @ApiProperty({ type: LoyaltyWalletDTO })
  @Type(() => LoyaltyWalletDTO)
  @ValidateNested()
  wallet!: LoyaltyWalletDTO;
}

export class LoyaltyOverviewDTO {
  @ApiProperty()
  @IsBoolean()
  enrolled!: boolean;

  @ApiProperty()
  @IsString()
  termsVersion!: string;

  @ApiProperty({ type: LoyaltyMemberDTO, nullable: true })
  @IsOptional()
  @Type(() => LoyaltyMemberDTO)
  @ValidateNested()
  member!: LoyaltyMemberDTO | null;
}

export class LoyaltyOperationDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  sequence!: number;

  @ApiProperty({
    enum: ["credit", "reversal", "reserve", "consume", "release"],
  })
  @IsIn(["credit", "reversal", "reserve", "consume", "release"])
  kind!: string;

  @ApiProperty()
  @IsInt()
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  balanceDelta!: number;

  @ApiProperty()
  @IsInt()
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  reservedDelta!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  balanceAfter!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  reservedAfter!: number;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;

  @ApiProperty()
  @IsDateString()
  recordedAt!: string;
}

export class LoyaltyHistoryDTO {
  @ApiProperty({ type: [LoyaltyOperationDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoyaltyOperationDTO)
  items!: LoyaltyOperationDTO[];

  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @Matches(/^[1-9]\d{0,15}$/)
  nextCursor!: string | null;
}
