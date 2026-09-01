import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const idPattern = /^[0-9a-f]{32}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const symbolPattern = /^[1-9A-J]$/;
const markerNumberPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/;
const plainTextPattern = /^(?![\s\S]*(?:https?:\/\/|www\.|<|>))[\s\S]*$/i;

function trim({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptional({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim() || undefined;
}

function parseMultipartJson({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export class UpdateWorkshopVisibilityDTO {
  @ApiProperty()
  @IsBoolean()
  isPublic!: boolean;
}

export class AddWorkshopCollectionDTO {
  @ApiProperty({ pattern: slugPattern.source, maxLength: 180 })
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  @Matches(slugPattern)
  collectionSlug!: string;
}

export class WorkshopCropDTO {
  @ApiProperty({ enum: [0, 90, 180, 270] })
  @IsIn([0, 90, 180, 270])
  rotation!: 0 | 90 | 180 | 270;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(1)
  @Max(3)
  zoom!: number;

  @ApiProperty({ minimum: -1, maximum: 1 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-1)
  @Max(1)
  x!: number;

  @ApiProperty({ minimum: -1, maximum: 1 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-1)
  @Max(1)
  y!: number;
}

export class WorkshopRevisionMaterialInputDTO {
  @ApiProperty({ pattern: idPattern.source })
  @IsString()
  @Matches(idPattern)
  toolId!: string;
}

export class WorkshopSymbolMappingInputDTO {
  @ApiProperty({ pattern: symbolPattern.source })
  @Transform(trim)
  @Matches(symbolPattern)
  symbol!: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  materialPosition!: number;

  @ApiProperty({ pattern: markerNumberPattern.source, maxLength: 12 })
  @Transform(trim)
  @Matches(markerNumberPattern)
  markerNumber!: string;

  @ApiPropertyOptional({ pattern: /^marker-color-\d{3}$/.source })
  @IsOptional()
  @Matches(/^marker-color-\d{3}$/)
  officialMarkerColorId?: string;
}

export class WorkshopRevisionPayloadDTO {
  @ApiProperty({ enum: ["DRAFT", "SUBMIT"] })
  @IsIn(["DRAFT", "SUBMIT"])
  intent!: "DRAFT" | "SUBMIT";

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(plainTextPattern)
  caption?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  advertisingConsent?: boolean;

  @ApiProperty({ type: () => WorkshopCropDTO })
  @ValidateNested()
  @Type(() => WorkshopCropDTO)
  crop!: WorkshopCropDTO;

  @ApiProperty({ type: () => [WorkshopRevisionMaterialInputDTO], maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WorkshopRevisionMaterialInputDTO)
  materials!: WorkshopRevisionMaterialInputDTO[];

  @ApiProperty({ type: () => [WorkshopSymbolMappingInputDTO], maxItems: 19 })
  @IsArray()
  @ArrayMaxSize(19)
  @ValidateNested({ each: true })
  @Type(() => WorkshopSymbolMappingInputDTO)
  symbolMappings!: WorkshopSymbolMappingInputDTO[];
}

export class CreateWorkshopRevisionMultipartDTO {
  @ApiProperty({ type: "string", description: "JSON WorkshopRevisionPayloadDTO" })
  @Transform(parseMultipartJson)
  @ValidateNested()
  @Type(() => WorkshopRevisionPayloadDTO)
  payload!: WorkshopRevisionPayloadDTO;
}

export class CreateWorkshopToolDTO {
  @ApiProperty({ enum: ["ARTMATE_168", "CUSTOM"] })
  @IsIn(["ARTMATE_168", "CUSTOM"])
  type!: "ARTMATE_168" | "CUSTOM";

  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(plainTextPattern)
  brand!: string;

  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(plainTextPattern)
  line!: string;
}

export class WorkshopModerationDecisionDTO {
  @ApiProperty({ enum: ["APPROVE", "REQUEST_CHANGES", "HIDE"] })
  @IsIn(["APPROVE", "REQUEST_CHANGES", "HIDE"])
  decision!: "APPROVE" | "REQUEST_CHANGES" | "HIDE";

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(plainTextPattern)
  reason?: string;
}

export class CreateWorkshopReportDTO {
  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  revisionId!: string;

  @ApiProperty({
    enum: [
      "COPYRIGHT",
      "OFFICIAL_COPY",
      "INAPPROPRIATE",
      "SPAM",
      "PERSONAL_DATA",
      "OTHER",
    ],
  })
  @IsIn([
    "COPYRIGHT",
    "OFFICIAL_COPY",
    "INAPPROPRIATE",
    "SPAM",
    "PERSONAL_DATA",
    "OTHER",
  ])
  reason!:
    | "COPYRIGHT"
    | "OFFICIAL_COPY"
    | "INAPPROPRIATE"
    | "SPAM"
    | "PERSONAL_DATA"
    | "OTHER";

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(plainTextPattern)
  details?: string;
}
