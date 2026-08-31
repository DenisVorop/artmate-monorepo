import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

import {
  featureBannerAudiences,
  featureBannerTones,
  type FeatureBannerAudience,
  type FeatureBannerTone,
} from "../feature-banners.types";
import { IsFeatureBannerAudienceSelection } from "./audiences-validation";

export class UpdateFeatureBannerRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  ctaHref?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(featureBannerAudiences, { each: true })
  @IsFeatureBannerAudienceSelection()
  audiences?: FeatureBannerAudience[];

  @IsOptional()
  @IsIn(featureBannerTones)
  tone?: FeatureBannerTone;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
