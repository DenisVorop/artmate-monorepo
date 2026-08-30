import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateColoringRequestDTO {
  @ApiProperty({ minLength: 1, maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  collectionId!: string;

  @ApiProperty({ minLength: 1, maxLength: 220 })
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional({ maxLength: 12000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  description?: string | null;

  @ApiProperty({ type: "integer", minimum: 0, maximum: 2_147_483_647 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  position!: number;

  @ApiPropertyOptional({
    type: [String],
    minItems: 0,
    uniqueItems: true,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  themeTagIds?: string[];
}
