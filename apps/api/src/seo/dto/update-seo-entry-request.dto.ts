import { Allow, IsOptional, IsString, MaxLength } from "class-validator";

import type { SeoJsonObject, SeoPayload } from "../seo.types";

export class UpdateSeoEntryRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  path?: string;

  @IsOptional()
  @Allow()
  source?: SeoJsonObject | null;

  @IsOptional()
  @Allow()
  payload?: SeoPayload;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}
