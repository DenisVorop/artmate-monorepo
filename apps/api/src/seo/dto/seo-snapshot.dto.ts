import { Allow, IsISO8601, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

import { seoSnapshotKinds, type SeoPayload, type SeoSnapshotKind } from "../seo.types";

export class SeoSnapshotDTO {
  @IsString()
  id!: string;

  @IsString()
  entryId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsIn(seoSnapshotKinds)
  kind!: SeoSnapshotKind;

  @Allow()
  payload!: SeoPayload;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsISO8601()
  createdAt!: string;
}
