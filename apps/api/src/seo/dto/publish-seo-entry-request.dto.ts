import { Allow, IsOptional, IsString, MaxLength } from "class-validator";

import type { SeoPayload } from "../seo.types";

export class PublishSeoEntryRequestDTO {
  @IsOptional()
  @Allow()
  payload?: SeoPayload;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}
