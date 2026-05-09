import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import {
  featureBannerAudiences,
  featureBannerTones,
  type FeatureBannerAudience,
  type FeatureBannerTone,
} from "../feature-banners.types";

export class CreateFeatureBannerRequestDTO {
  @IsString()
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(600)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  ctaHref?: string | null;

  @IsOptional()
  @IsIn(featureBannerAudiences)
  audience?: FeatureBannerAudience;

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
