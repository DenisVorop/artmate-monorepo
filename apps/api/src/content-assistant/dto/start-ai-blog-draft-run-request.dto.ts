import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import {
  aiBlogDraftSourceTypes,
  type AiBlogDraftSourceType,
} from "../content-assistant.types";

export class StartAiBlogDraftRunRequestDTO {
  @IsOptional()
  @IsIn(aiBlogDraftSourceTypes)
  sourceType?: AiBlogDraftSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  prompt?: string;
}
