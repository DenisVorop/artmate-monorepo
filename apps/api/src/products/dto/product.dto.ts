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
import { ProductCharacteristicDTO } from "./product-characteristic.dto";
import { ProductImageDTO } from "./product-image.dto";
import { ProductTagDTO } from "./product-tag.dto";

export class ProductDigitalCollectionDTO {
  @IsString()
  slug!: string;

  @IsString()
  title!: string;
}

export class ProductLoyaltyRewardDTO {
  @IsInt()
  @Min(0)
  ratePercent!: number;

  @IsInt()
  @Min(0)
  points!: number;
}

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCharacteristicDTO)
  characteristics!: ProductCharacteristicDTO[];

  @IsOptional()
  @IsString()
  usageInstructions?: string;

  @IsIn(productStatuses)
  status!: ProductStatus;

  @IsBoolean()
  isHit!: boolean;

  @IsBoolean()
  isOutOfStock!: boolean;

  @IsBoolean()
  isOzonDeliveryAvailable!: boolean;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  salePrice!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  salePriceRub!: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductLoyaltyRewardDTO)
  loyaltyRewards!: ProductLoyaltyRewardDTO[];

  @IsIn(productCurrencies)
  currency!: ProductCurrency;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDTO)
  images!: ProductImageDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTagDTO)
  tags!: ProductTagDTO[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDigitalCollectionDTO)
  digitalCollection?: ProductDigitalCollectionDTO;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
