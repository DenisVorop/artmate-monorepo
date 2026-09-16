import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class AffiliateCodeDTO {
  @IsString() id!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() @MaxLength(500) comment!: string | null;
  @IsInt() @Min(0) @Max(15) partnerPercent!: number;
  @IsInt() @Min(5) @Max(20) buyerPercent!: number;
  @IsBoolean() isActive!: boolean;
  @IsISO8601() createdAt!: string;
  @IsISO8601() updatedAt!: string;
}

export class AffiliateCodeListDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffiliateCodeDTO)
  items!: AffiliateCodeDTO[];

  @IsInt() @Min(0) total!: number;
  @IsInt() @Min(1) page!: number;
  @IsInt() @Min(1) pageSize!: number;
}
