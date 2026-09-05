import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

const idPattern = /^[0-9a-f]{32}$/;

export class WorkshopCollectionSummaryDTO {
  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-z0-9]{1,32}$/)
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: ["MANUAL", "PURCHASE", "ACTIVATION_CODE"] })
  @IsIn(["MANUAL", "PURCHASE", "ACTIVATION_CODE"])
  source!: "MANUAL" | "PURCHASE" | "ACTIVATION_CODE";

  @ApiProperty()
  @IsBoolean()
  hasPaidOrder!: boolean;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedColoringCount!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  workCount!: number;

  @ApiProperty()
  @IsObject()
  cover!: object;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  addedAt!: string;
}

export class WorkshopDTO {
  @ApiProperty()
  @IsString()
  handle!: string;

  @ApiProperty()
  @IsBoolean()
  isPublic!: boolean;

  @ApiProperty()
  @IsBoolean()
  isIndexable!: boolean;

  @ApiProperty({ type: () => [WorkshopCollectionSummaryDTO] })
  @IsArray()
  @ArrayMaxSize(500)
  collections!: WorkshopCollectionSummaryDTO[];

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  updatedAt!: string;
}

export class WorkshopCollectionDetailDTO extends WorkshopCollectionSummaryDTO {
  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: "array", maxItems: 500 })
  @IsArray()
  @ArrayMaxSize(500)
  colorings!: unknown[];
}

export class WorkshopColoringDetailDTO {
  @ApiProperty()
  @IsObject()
  collection!: object;

  @ApiProperty()
  @IsObject()
  coloring!: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  work?: object;
}

export class WorkshopToolDTO {
  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  id!: string;

  @ApiProperty({ enum: ["ARTMATE_168", "CUSTOM"] })
  @IsIn(["ARTMATE_168", "CUSTOM"])
  type!: "ARTMATE_168" | "CUSTOM";

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  brand!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  line!: string;

  @ApiPropertyOptional({ type: "array", maxItems: 168 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(168)
  officialPalette?: unknown[];
}

export class WorkshopWorkDTO {
  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  id!: string;

  @ApiProperty()
  @IsString()
  publicId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  attemptNumber!: number;

  @ApiProperty()
  @IsBoolean()
  isPublicationEnabled!: boolean;

  @ApiProperty()
  @IsBoolean()
  isIndexable!: boolean;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  currentRevision?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  publishedRevision?: object;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;
}

export class PublicWorkshopDTO {
  @ApiProperty()
  @IsString()
  handle!: string;

  @ApiProperty()
  @IsObject()
  author!: object;

  @ApiProperty({ type: "array", maxItems: 500 })
  @IsArray()
  @ArrayMaxSize(500)
  works!: unknown[];
}

export class PublicWorkshopWorkDTO {
  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  revisionId!: string;

  @ApiProperty()
  @IsString()
  publicId!: string;

  @ApiProperty()
  @IsObject()
  author!: object;

  @ApiProperty()
  @IsObject()
  official!: object;

  @ApiProperty()
  @IsObject()
  relatedProduct!: object;

  @ApiProperty()
  @IsObject()
  submission!: object;
}

export class WorkshopModerationListItemDTO {
  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  revisionId!: string;

  @ApiProperty({ pattern: idPattern.source })
  @Matches(idPattern)
  workId!: string;

  @ApiProperty({ enum: ["PENDING", "APPROVED", "CHANGES_REQUESTED", "HIDDEN"] })
  @IsIn(["PENDING", "APPROVED", "CHANGES_REQUESTED", "HIDDEN"])
  status!: string;

  @ApiProperty()
  @IsBoolean()
  isPublishedRevision!: boolean;

  @ApiProperty()
  @IsObject()
  author!: object;

  @ApiProperty()
  @IsString()
  workshopHandle!: string;

  @ApiProperty()
  @IsObject()
  collection!: object;

  @ApiProperty()
  @IsObject()
  coloring!: object;

  @ApiProperty()
  @IsBoolean()
  suspectedOfficialCopy!: boolean;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  submittedAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;
}

export class WorkshopModerationDetailDTO extends WorkshopModerationListItemDTO {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty()
  @IsBoolean()
  advertisingConsent!: boolean;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  advertisingConsentAt?: string;

  @ApiProperty()
  @IsBoolean()
  publicationConsent!: boolean;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  publicationConsentAt?: string;

  @ApiProperty()
  @IsObject()
  officialComparison!: object;

  @ApiProperty({ type: "array", maxItems: 19 })
  @IsArray()
  @ArrayMaxSize(19)
  materials!: unknown[];

  @ApiProperty({ type: "array", maxItems: 19 })
  @IsArray()
  @ArrayMaxSize(19)
  symbolMappings!: unknown[];

  @ApiProperty({ type: "array" })
  @IsArray()
  decisionHistory!: unknown[];

  @ApiProperty()
  @IsObject()
  assets!: object;
}

export class WorkshopReportDTO {
  @ApiProperty()
  @IsString()
  status!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  createdAt!: string;
}
