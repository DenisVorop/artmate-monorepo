import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  ArrayUnique,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { contestAppearances, type ContestAppearance } from "../contests.types";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class ContestPlacePrizeRequestDTO {
  @IsOptional() @IsInt() @Min(1) @Max(100) winnersCount?: number;
  @IsOptional() @IsBoolean() deferredProduct?: boolean;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) prize!: string;
  @Transform(trim) @IsString() @MaxLength(1000) prizeDetail!: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) prizeAlbumQuantity?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  prizeAlbumIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(20) prizeMarkerQuantity?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  prizeMarkerIds?: string[];
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(32) prizePromoCodeId?:
    | string
    | null;
}
export class CreateContestRequestDTO {
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  description!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  task!: string;
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? item.trim() : item))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(1000, { each: true })
  rules!: string[];
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  manualCriteria?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  manualTieBreak?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  manualEvaluator?: string;
  @IsIn(contestAppearances)
  appearance!: ContestAppearance;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  prize!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  prizeDetail!: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  prizeAlbumQuantity?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  prizeAlbumIds?: string[];
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  prizePromoCodeId?: string | null;
  @IsOptional() @IsIn(["EQUAL", "PLACES"]) prizeMode?: "EQUAL" | "PLACES";
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ContestPlacePrizeRequestDTO)
  prizePlaces?: ContestPlacePrizeRequestDTO[];
  @IsOptional() @IsInt() @Min(1) @Max(20) prizeMarkerQuantity?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  prizeMarkerIds?: string[];
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  participationPromoCodeId?: string | null;
  @IsInt()
  @Min(1)
  @Max(100)
  winnersCount!: number;
  @IsIn(["AUTOMATIC", "MANUAL"])
  selectionMode!: "AUTOMATIC" | "MANUAL";
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  opensAt!: string;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  closesAt!: string;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  drawAt!: string;
  @IsBoolean()
  published!: boolean;
}
export class UpdateContestRequestDTO extends CreateContestRequestDTO {
  @IsInt()
  @Min(1)
  version!: number;
}

export class BindContestPrizeProductRequestDTO {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  productId!: string;
}
