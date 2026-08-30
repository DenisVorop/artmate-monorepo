import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

import {
  coloringPaletteDescription,
  coloringPaletteMaxColors,
} from "../coloring-palette";

const markerColorIdPattern = /^marker-color-\d{3}$/;

function trimMultipartText({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
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

export class CreateColoringRevisionRequestDTO {
  @ApiProperty({
    type: "string",
    description: coloringPaletteDescription,
    example: '["marker-color-104","marker-color-001"]',
  })
  @Transform(parseMultipartJson)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(coloringPaletteMaxColors)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(markerColorIdPattern, { each: true })
  markerColorIds!: string[];

  @ApiProperty({ minLength: 1, maxLength: 220 })
  @Transform(trimMultipartText)
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  outlineAlt!: string;

  @ApiProperty({ minLength: 1, maxLength: 220 })
  @Transform(trimMultipartText)
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  coloredAlt!: string;
}
