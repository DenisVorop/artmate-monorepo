import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateColoringCollectionRequestDTO {
  @ApiProperty({ minLength: 1, maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  productId!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 180,
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

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

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  expectedColoringCount!: number;
}
