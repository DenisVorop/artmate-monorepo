import {
  Allow,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

import {
  aiBlogDraftRunStatuses,
  aiBlogDraftSourceTypes,
  type AiBlogDraftRunStatus,
  type AiBlogDraftSourceType,
} from "../content-assistant.types";

export class AiBlogDraftRunDTO {
  @IsString()
  id!: string;

  @IsIn(aiBlogDraftSourceTypes)
  sourceType!: AiBlogDraftSourceType;

  @IsIn(aiBlogDraftRunStatuses)
  status!: AiBlogDraftRunStatus;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @Allow()
  topics?: unknown;

  @IsOptional()
  @IsInt()
  selectedTopicIndex?: number;

  @IsOptional()
  @Allow()
  outline?: unknown;

  @IsOptional()
  @Allow()
  draft?: unknown;

  @IsOptional()
  @Allow()
  sources?: unknown;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  blogPostId?: string;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
