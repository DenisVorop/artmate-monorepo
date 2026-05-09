import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString } from "class-validator";

import {
  featureBannerAudiences,
  featureBannerTones,
  type FeatureBannerAudience,
  type FeatureBannerTone,
} from "../feature-banners.types";

export class FeatureBannerDTO {
  @IsString()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsIn(featureBannerAudiences)
  audience!: FeatureBannerAudience;

  @IsIn(featureBannerTones)
  tone!: FeatureBannerTone;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsISO8601()
  archivedAt?: string;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
