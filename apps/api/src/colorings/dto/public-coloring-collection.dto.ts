import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDefined,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { PublicColoringProductDTO } from "./public-coloring.dto";

export class PublicColoringCollectionImageDTO {
  @ApiProperty({ format: "uri" })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty()
  @IsString()
  alt!: string;

  @ApiProperty({ type: "integer", minimum: 1 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ type: "integer", minimum: 1 })
  @IsInt()
  @Min(1)
  height!: number;
}

export class PublicColoringCollectionSummaryDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

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
  coloringCount!: number;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  expectedColoringCount!: number;

  @ApiProperty({ type: () => PublicColoringCollectionImageDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringCollectionImageDTO)
  cover!: PublicColoringCollectionImageDTO;

  @ApiProperty({ type: () => PublicColoringProductDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringProductDTO)
  product!: PublicColoringProductDTO;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  lastModified!: string;
}

export class PublicColoringCollectionItemDTO {
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

  @ApiProperty({ type: "integer", minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty()
  @IsString()
  publishedRevisionId!: string;

  @ApiProperty({ type: () => PublicColoringCollectionImageDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicColoringCollectionImageDTO)
  card!: PublicColoringCollectionImageDTO;
}

export class PublicColoringCollectionDTO extends PublicColoringCollectionSummaryDTO {
  @ApiProperty({ type: () => PublicColoringCollectionItemDTO, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicColoringCollectionItemDTO)
  colorings!: PublicColoringCollectionItemDTO[];
}
