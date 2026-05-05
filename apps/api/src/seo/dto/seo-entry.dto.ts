import { Type } from "class-transformer";
import {
  Allow,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { seoEntryStatuses, type SeoEntryStatus, type SeoJsonObject } from "../seo.types";

import { SeoSnapshotDTO } from "./seo-snapshot.dto";

export class SeoEntryDTO {
  @IsString()
  id!: string;

  @IsString()
  path!: string;

  @IsOptional()
  @Allow()
  source?: SeoJsonObject;

  @IsIn(seoEntryStatuses)
  status!: SeoEntryStatus;

  @IsOptional()
  @IsString()
  draftSnapshotId?: string;

  @IsOptional()
  @IsString()
  publishedSnapshotId?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsString()
  updatedById?: string;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeoSnapshotDTO)
  draftSnapshot?: SeoSnapshotDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeoSnapshotDTO)
  publishedSnapshot?: SeoSnapshotDTO;
}
