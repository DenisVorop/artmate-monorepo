import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  catalogLandingProductSources,
  catalogLandingStatuses,
  type CatalogLandingProductSource,
  type CatalogLandingStatus,
} from "../catalog-landings.types";

import { CatalogLandingFaqItemInputDTO } from "./catalog-landing-faq-item-input.dto";
import { CatalogLandingProductOverrideInputDTO } from "./catalog-landing-product-override-input.dto";
import { CatalogLandingTagRuleInputDTO } from "./catalog-landing-tag-rule-input.dto";

export class CreateCatalogLandingPageRequestDTO {
  @IsString()
  @MaxLength(180)
  slug!: string;

  @IsOptional()
  @IsIn(catalogLandingStatuses)
  status?: CatalogLandingStatus;

  @IsOptional()
  @IsBoolean()
  isIndexable?: boolean;

  @IsString()
  @MaxLength(220)
  h1!: string;

  @IsString()
  @MaxLength(260)
  metaTitle!: string;

  @IsString()
  @MaxLength(500)
  metaDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  introHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  seoHtml?: string;

  @IsOptional()
  @IsIn(catalogLandingProductSources)
  productSource?: CatalogLandingProductSource;

  @IsOptional()
  @IsInt()
  @Min(0)
  minProducts?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingTagRuleInputDTO)
  tagRules?: CatalogLandingTagRuleInputDTO[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingProductOverrideInputDTO)
  productOverrides?: CatalogLandingProductOverrideInputDTO[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogLandingFaqItemInputDTO)
  faqItems?: CatalogLandingFaqItemInputDTO[];
}
