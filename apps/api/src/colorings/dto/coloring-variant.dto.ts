import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, plainToInstance, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class VariantPaletteInputDTO {
  @ApiProperty({ minimum: 1, maximum: 19 })
  @IsInt()
  @Min(1)
  @Max(19)
  symbolPosition!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  hex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]{1,32}$/)
  materialColorId?: string;
}

export class SaveColoringVariantDTO {
  @ApiProperty({ description: "original or material set ID" })
  @IsString()
  @Matches(/^[a-z0-9_-]{1,32}$/)
  target!: string;

  @ApiProperty({
    description: "Token from GET variants; new for initial upload",
  })
  @IsString()
  @MaxLength(40)
  @MinLength(1)
  expectedToken!: string;

  @ApiProperty({ maxLength: 220 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  outlineAlt!: string;

  @ApiProperty({ maxLength: 220 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  imageAlt!: string;

  @ApiProperty({
    type: String,
    description:
      "JSON array of explicit symbol positions and HEX or materialColorId",
  })
  @Transform(({ value }: { value: unknown }) => {
    try {
      const rows: unknown =
        typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(rows)
        ? rows.map((row) => plainToInstance(VariantPaletteInputDTO, row))
        : rows;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(19)
  @ArrayUnique((row: VariantPaletteInputDTO) => row?.symbolPosition)
  @ValidateNested({ each: true })
  palette!: VariantPaletteInputDTO[];
}

export class VariantPaletteDTO {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(19)
  symbolPosition!: number;
  @ApiProperty()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  hex!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  materialColorId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;
}

export class ColoringVariantDTO {
  @ApiProperty({ enum: ["draft", "published", "archived"] })
  @IsIn(["draft", "published", "archived"])
  status!: "draft" | "published" | "archived";
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  materialSetId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
  @ApiProperty()
  @IsString()
  updatedAt!: string;
  @ApiProperty()
  @IsString()
  imageUrl!: string;
  @ApiProperty()
  @IsString()
  cardUrl!: string;
  @ApiProperty({ type: [VariantPaletteDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPaletteDTO)
  palette!: VariantPaletteDTO[];
}

export class ColoringVariantsDTO {
  @ApiProperty()
  @IsString()
  coloringId!: string;
  @ApiProperty()
  @IsString()
  token!: string;
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  width!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  height!: number | null;
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  outlineUrl!: string | null;
  @ApiProperty({ type: ColoringVariantDTO, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ColoringVariantDTO)
  original!: ColoringVariantDTO | null;
  @ApiProperty({ type: [ColoringVariantDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColoringVariantDTO)
  variants!: ColoringVariantDTO[];
}

export class PublishColoringVariantDTO {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  expectedToken!: string;
}
