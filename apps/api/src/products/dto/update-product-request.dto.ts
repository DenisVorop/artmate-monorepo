import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import {
  productCurrencies,
  productStatuses,
  type ProductCurrency,
  type ProductStatus,
} from "../products.types";

export class UpdateProductRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(productStatuses)
  status?: ProductStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceRub?: number;

  @IsOptional()
  @IsIn(productCurrencies)
  currency?: ProductCurrency;
}
