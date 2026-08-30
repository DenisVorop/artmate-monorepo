import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import {
  coloringDerivativeMaxSide,
  coloringDerivativeProfiles,
  type ColoringDerivativeProfile,
} from "../coloring-derivative-profile";
import {
  coloringPaletteMaxColors,
  coloringPaletteSymbolPattern,
} from "../coloring-palette";

const checksumPattern = /^[0-9a-f]{64}$/;
const markerColorIdPattern = /^marker-color-\d{3}$/;
const markerNumberPattern = /^\d{3}$/;
const hexPattern = /^#[0-9A-F]{6}$/;

export class ColoringRevisionAssetDTO {
  @ApiProperty({ enum: ["image/png", "image/webp"] })
  @IsIn(["image/png", "image/webp"])
  sourceMime!: "image/png" | "image/webp";

  @ApiProperty({ pattern: checksumPattern.source })
  @Matches(checksumPattern)
  sourceChecksum!: string;

  @ApiProperty({ enum: ["image/webp"] })
  @IsIn(["image/webp"])
  mimeType!: "image/webp";

  @ApiProperty({ type: "integer", minimum: 1 })
  @IsInt()
  @Min(1)
  byteSize!: number;

  @ApiProperty({ pattern: checksumPattern.source })
  @Matches(checksumPattern)
  checksum!: string;

  @ApiProperty()
  @IsString()
  alt!: string;

  @ApiProperty()
  @IsString()
  previewUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicUrl?: string;
}

export class ColoringRevisionReviewDTO {
  @ApiProperty({ enum: ["approved", "rejected"] })
  @IsIn(["approved", "rejected"])
  decision!: "approved" | "rejected";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewedById?: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  reviewedAt!: string;
}

export class ColoringRevisionPaletteColorDTO {
  @ApiProperty({ pattern: markerColorIdPattern.source })
  @Matches(markerColorIdPattern)
  markerColorId!: string;

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: coloringPaletteMaxColors,
  })
  @IsInt()
  @Min(1)
  @Max(coloringPaletteMaxColors)
  symbolPosition!: number;

  @ApiProperty({ pattern: coloringPaletteSymbolPattern.source, example: "A" })
  @Matches(coloringPaletteSymbolPattern)
  symbol!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  colorNumber!: number;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  pantone!: string;

  @ApiProperty({ pattern: hexPattern.source })
  @Matches(hexPattern)
  hex!: string;

  @ApiProperty({ pattern: markerNumberPattern.source })
  @Matches(markerNumberPattern)
  markerNumber!: string;
}

export class ColoringRevisionDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  coloringId!: string;

  @ApiProperty({ type: "integer", minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    enum: ["review_required", "approved", "rejected", "published"],
  })
  @IsIn(["review_required", "approved", "rejected", "published"])
  status!: "review_required" | "approved" | "rejected" | "published";

  @ApiProperty()
  @IsString()
  paletteLabel!: string;

  @ApiProperty()
  @IsString()
  paletteVersion!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 168 })
  @IsInt()
  @Min(1)
  @Max(168)
  usedColorCount!: number;

  @ApiProperty({
    type: () => [ColoringRevisionPaletteColorDTO],
    maxItems: coloringPaletteMaxColors,
  })
  @IsArray()
  @ArrayMaxSize(coloringPaletteMaxColors)
  @ValidateNested({ each: true })
  @Type(() => ColoringRevisionPaletteColorDTO)
  paletteColors!: ColoringRevisionPaletteColorDTO[];

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: coloringDerivativeMaxSide,
  })
  @IsInt()
  @Min(1)
  @Max(coloringDerivativeMaxSide)
  width!: number;

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: coloringDerivativeMaxSide,
  })
  @IsInt()
  @Min(1)
  @Max(coloringDerivativeMaxSide)
  height!: number;

  @ApiProperty({ enum: coloringDerivativeProfiles })
  @IsIn(coloringDerivativeProfiles)
  derivativeProfile!: ColoringDerivativeProfile;

  @ApiProperty({ enum: ["srgb"] })
  @IsIn(["srgb"])
  colorSpace!: "srgb";

  @ApiProperty({ type: () => ColoringRevisionAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => ColoringRevisionAssetDTO)
  outline!: ColoringRevisionAssetDTO;

  @ApiProperty({ type: () => ColoringRevisionAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => ColoringRevisionAssetDTO)
  colored!: ColoringRevisionAssetDTO;

  @ApiPropertyOptional({ type: () => ColoringRevisionReviewDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => ColoringRevisionReviewDTO)
  review?: ColoringRevisionReviewDTO;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;
}
