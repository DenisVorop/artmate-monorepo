import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDefined,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { coloringStatuses, type ColoringStatus } from "../colorings.types";

import { ColoringCollectionReferenceDTO } from "./coloring-collection.dto";
import { ColoringThemeDTO } from "./coloring-theme.dto";

export class ColoringDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  collectionId!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  number!: number;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: "integer", minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty({ enum: coloringStatuses })
  @IsIn(coloringStatuses)
  status!: ColoringStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishedRevisionId?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @ApiProperty({ type: () => ColoringCollectionReferenceDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => ColoringCollectionReferenceDTO)
  collection!: ColoringCollectionReferenceDTO;

  @ApiProperty({ type: () => ColoringThemeDTO, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColoringThemeDTO)
  themes!: ColoringThemeDTO[];

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  updatedAt!: string;
}
