import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { MaterialKind } from "../../generated/prisma/client";
import {
  PublicColoringAssetDTO,
  PublicColoringCollectionReferenceDTO,
  PublicColoringProductDTO,
  PublicColoringThemeDTO,
} from "./public-coloring.dto";
import { PublicColoringCollectionImageDTO } from "./public-coloring-collection.dto";

export class PublicVariantColorDTO {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(19)
  symbolPosition!: number;
  @ApiProperty()
  @Matches(/^[1-9A-J]$/)
  symbol!: string;
  @ApiProperty()
  @Matches(/^#[a-f0-9]{6}$/i)
  hex!: string;
}

export class PublicMaterialVariantColorDTO extends PublicVariantColorDTO {
  @ApiProperty()
  @IsString()
  code!: string;
}

export class PublicOriginalVariantDTO {
  @ApiProperty({ type: PublicColoringAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringAssetDTO)
  outline!: PublicColoringAssetDTO;
  @ApiProperty()
  @IsString()
  id!: string;
  @ApiProperty()
  @IsString()
  label!: string;
  @ApiProperty({ type: PublicColoringAssetDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringAssetDTO)
  image!: PublicColoringAssetDTO;
  @ApiProperty({ type: PublicColoringCollectionImageDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringCollectionImageDTO)
  card!: PublicColoringCollectionImageDTO;
  @ApiProperty({ type: [PublicVariantColorDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(19)
  @ValidateNested({ each: true })
  @Type(() => PublicVariantColorDTO)
  colors!: PublicVariantColorDTO[];
}

export class PublicMaterialVariantDTO extends PublicOriginalVariantDTO {
  @ApiProperty({ enum: MaterialKind })
  @IsEnum(MaterialKind)
  kind!: MaterialKind;
  @ApiProperty()
  @IsInt()
  @Min(1)
  totalColors!: number;
  @ApiPropertyOptional({ type: PublicColoringProductDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicColoringProductDTO)
  product?: PublicColoringProductDTO;
  @ApiProperty({ type: [PublicMaterialVariantColorDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(19)
  @ValidateNested({ each: true })
  @Type(() => PublicMaterialVariantColorDTO)
  declare colors: PublicMaterialVariantColorDTO[];
}

export class PublicColoringVariantsDTO {
  @ApiProperty()
  @IsString()
  id!: string;
  @ApiProperty()
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
  @IsInt()
  @Min(1)
  @Max(8000)
  width!: number;
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(8000)
  height!: number;
  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;
  @ApiProperty()
  @IsString()
  defaultPaletteId!: string;
  @ApiProperty()
  @IsISO8601()
  publishedAt!: string;
  @ApiProperty({ type: PublicOriginalVariantDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicOriginalVariantDTO)
  original!: PublicOriginalVariantDTO;
  @ApiProperty({ type: [PublicMaterialVariantDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicMaterialVariantDTO)
  variants!: PublicMaterialVariantDTO[];
  @ApiProperty({ type: PublicColoringCollectionReferenceDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringCollectionReferenceDTO)
  collection!: PublicColoringCollectionReferenceDTO;
  @ApiProperty({ type: [PublicColoringThemeDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicColoringThemeDTO)
  themes!: PublicColoringThemeDTO[];
}
