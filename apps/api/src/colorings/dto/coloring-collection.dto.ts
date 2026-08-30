import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import {
  coloringCollectionStatuses,
  type ColoringCollectionStatus,
} from "../colorings.types";
import { productStatuses, type ProductStatus } from "../../products/products.types";

export class ColoringCollectionProductReferenceDTO {
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

export class ColoringCollectionProductDTO extends ColoringCollectionProductReferenceDTO {
  @ApiProperty({ enum: productStatuses })
  @IsIn(productStatuses)
  status!: ProductStatus;
}

export class ColoringCollectionReferenceDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ type: () => ColoringCollectionProductReferenceDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => ColoringCollectionProductReferenceDTO)
  product!: ColoringCollectionProductReferenceDTO;
}

export class ColoringCollectionCoverDTO {
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

export class ColoringCollectionDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  productId!: string;

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
  position!: number;

  @ApiProperty({ enum: coloringCollectionStatuses })
  @IsIn(coloringCollectionStatuses)
  status!: ColoringCollectionStatus;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  expectedColoringCount!: number;

  @ApiPropertyOptional({ type: () => ColoringCollectionCoverDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => ColoringCollectionCoverDTO)
  cover?: ColoringCollectionCoverDTO;

  @ApiProperty({ type: "integer", minimum: 0 })
  @IsInt()
  @Min(0)
  coloringCount!: number;

  @ApiProperty({ type: "integer", minimum: 0 })
  @IsInt()
  @Min(0)
  publishedColoringCount!: number;

  @ApiProperty({ type: () => ColoringCollectionProductDTO })
  @IsDefined()
  @ValidateNested()
  @Type(() => ColoringCollectionProductDTO)
  product!: ColoringCollectionProductDTO;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  updatedAt!: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}
