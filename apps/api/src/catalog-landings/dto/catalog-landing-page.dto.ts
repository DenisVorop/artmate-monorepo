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

import { ProductDTO } from "../../products/dto";
import {
  catalogLandingProductSources,
  catalogLandingStatuses,
  type CatalogLandingProductSource,
  type CatalogLandingStatus,
} from "../catalog-landings.types";

import { CatalogLandingFaqItemDTO } from "./catalog-landing-faq-item.dto";
import { CatalogLandingProductOverrideDTO } from "./catalog-landing-product-override.dto";
import { CatalogLandingTagRuleDTO } from "./catalog-landing-tag-rule.dto";

export class CatalogLandingPageDTO {
  @IsString()
  id!: string;

  @IsString()
  slug!: string;

  @IsIn(catalogLandingStatuses)
  status!: CatalogLandingStatus;

  @IsBoolean()
  isIndexable!: boolean;

  @IsString()
  h1!: string;

  @IsString()
  metaTitle!: string;

  @IsString()
  metaDescription!: string;

  @IsOptional()
  @IsString()
  introHtml?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoHtml?: string;

  @IsIn(catalogLandingProductSources)
  productSource!: CatalogLandingProductSource;

  @IsInt()
  @Min(0)
  minProducts!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingTagRuleDTO)
  tagRules!: CatalogLandingTagRuleDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingProductOverrideDTO)
  productOverrides!: CatalogLandingProductOverrideDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingFaqItemDTO)
  faqItems!: CatalogLandingFaqItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDTO)
  products!: ProductDTO[];

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
