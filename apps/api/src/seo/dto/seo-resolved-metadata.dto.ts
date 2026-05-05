import { Allow, IsBoolean, IsOptional, IsString } from "class-validator";

import type { SeoJsonObject, SeoPayload } from "../seo.types";

export class SeoResolvedMetadataDTO {
  @IsString()
  path!: string;

  @IsBoolean()
  found!: boolean;

  @IsOptional()
  @Allow()
  source?: SeoJsonObject;

  @IsOptional()
  @Allow()
  metadata?: SeoPayload;
}
