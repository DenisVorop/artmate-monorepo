import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const markerColorIdPattern = /^marker-color-\d{3}$/;
const markerNumberPattern = /^\d{3}$/;
const hexPattern = /^#[0-9A-F]{6}$/;
const nonWhitespacePattern = /\S/;

export class MarkerColorDTO {
  @ApiProperty({
    pattern: markerColorIdPattern.source,
    example: "marker-color-173",
  })
  @Matches(markerColorIdPattern)
  id!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  colorNumber!: number;

  @ApiProperty({ maxLength: 40, example: "5595C" })
  @IsString()
  @Matches(nonWhitespacePattern)
  @MaxLength(40)
  pantone!: string;

  @ApiProperty({ pattern: hexPattern.source, example: "#BFCEC2" })
  @Matches(hexPattern)
  hex!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 168 })
  @IsInt()
  @Min(1)
  @Max(168)
  catalogPosition!: number;

  @ApiProperty({ pattern: markerNumberPattern.source, example: "027" })
  @Matches(markerNumberPattern)
  markerNumber!: string;
}
