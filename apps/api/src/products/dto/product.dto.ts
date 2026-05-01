import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import {
  productCurrencies,
  productStatuses,
  type ProductCurrency,
  type ProductStatus,
} from "../products.types";

import { ProductCategoryDTO } from "./product-category.dto";
import { ProductImageDTO } from "./product-image.dto";

export class ProductDTO {
  @IsString()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(productStatuses)
  status!: ProductStatus;

  @IsBoolean()
  isHit!: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductCategoryDTO)
  category?: ProductCategoryDTO;

  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  priceRub!: number;

  @IsIn(productCurrencies)
  currency!: ProductCurrency;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDTO)
  images!: ProductImageDTO[];

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
