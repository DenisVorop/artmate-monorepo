import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { coloringDerivativeMaxSide } from "../coloring-derivative-profile";
import {
  coloringPaletteMaxColors,
  coloringPaletteSymbolPattern,
} from "../coloring-palette";

const hexPattern = /^#[0-9A-F]{6}$/;
const markerNumberPattern = /^\d{3}$/;

export class PublicColoringManifestItemDTO {
  @ApiProperty()
  @IsString()
  collectionSlug!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  number!: number;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  lastModified!: string;
}

export class PublicColoringThemeDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;
}

export class PublicColoringCategoryDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;
}

export class PublicColoringProductDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional({ type: () => PublicColoringCategoryDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicColoringCategoryDTO)
  category?: PublicColoringCategoryDTO;
}

export class PublicColoringCollectionReferenceDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ type: () => PublicColoringProductDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringProductDTO)
  product!: PublicColoringProductDTO;
}

export class PublicColoringPaletteColorDTO {
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

export class PublicColoringPaletteDTO {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsString()
  version!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 168 })
  @IsInt()
  @Min(1)
  @Max(168)
  usedColorCount!: number;

  @ApiProperty({
    type: () => [PublicColoringPaletteColorDTO],
    maxItems: coloringPaletteMaxColors,
  })
  @IsArray()
  @ArrayMaxSize(coloringPaletteMaxColors)
  @ValidateNested({ each: true })
  @Type(() => PublicColoringPaletteColorDTO)
  colors!: PublicColoringPaletteColorDTO[];
}

export class PublicColoringAssetDTO {
  @ApiProperty({ format: "uri" })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty()
  @IsString()
  alt!: string;
}

export class PublicColoringDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  number!: number;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  publishedRevisionId!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  publishedAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  firstPublishedAt!: string;

  @ApiProperty({ type: () => PublicColoringThemeDTO, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicColoringThemeDTO)
  themes!: PublicColoringThemeDTO[];

  @ApiProperty({ type: () => PublicColoringCollectionReferenceDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringCollectionReferenceDTO)
  collection!: PublicColoringCollectionReferenceDTO;

  @ApiProperty({ type: () => PublicColoringPaletteDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringPaletteDTO)
  palette!: PublicColoringPaletteDTO;

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

  @ApiProperty({ type: () => PublicColoringAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringAssetDTO)
  outline!: PublicColoringAssetDTO;

  @ApiProperty({ type: () => PublicColoringAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringAssetDTO)
  colored!: PublicColoringAssetDTO;
}
