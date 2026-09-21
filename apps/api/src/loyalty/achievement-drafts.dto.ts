import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const achievementIntegerMax = 2_147_483_647;
export const achievementConditionKinds = [
  "published_coloring_count",
  "distinct_collection_count",
  "completed_collection_count",
  "completed_order_count",
] as const;
export type AchievementConditionKind =
  (typeof achievementConditionKinds)[number];

export class CreateAchievementDraftDTO {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiProperty({ maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: "uri" })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//)
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  imageUrl?: string | null;

  @ApiProperty({ enum: achievementConditionKinds })
  @IsIn(achievementConditionKinds)
  conditionKind!: AchievementConditionKind;

  @ApiProperty({ minimum: 1, maximum: achievementIntegerMax })
  @IsInt()
  @Min(1)
  @Max(achievementIntegerMax)
  target!: number;

  @ApiProperty({ minimum: 0, maximum: achievementIntegerMax })
  @IsInt()
  @Min(0)
  @Max(achievementIntegerMax)
  rewardPoints!: number;

  @ApiProperty({ minimum: 0, maximum: achievementIntegerMax })
  @IsInt()
  @Min(0)
  @Max(achievementIntegerMax)
  sortOrder!: number;
}

export class UpdateAchievementDraftDTO extends CreateAchievementDraftDTO {
  @ApiProperty({ minimum: 1, maximum: achievementIntegerMax })
  @IsInt()
  @Min(1)
  @Max(achievementIntegerMax)
  expectedVersion!: number;
}

export class ArchiveAchievementDraftDTO {
  @ApiProperty({ minimum: 1, maximum: achievementIntegerMax })
  @IsInt()
  @Min(1)
  @Max(achievementIntegerMax)
  expectedVersion!: number;
}

export class ActivateAchievementDTO extends ArchiveAchievementDraftDTO {}

export class AchievementDraftDTO extends CreateAchievementDraftDTO {
  @ApiProperty({ type: String, nullable: true, format: "uri" })
  declare imageUrl: string | null;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 1, maximum: achievementIntegerMax })
  @IsInt()
  @Min(1)
  @Max(achievementIntegerMax)
  version!: number;

  @ApiProperty({ enum: ["draft", "active", "archived"] })
  @IsIn(["draft", "active", "archived"])
  status!: "draft" | "active" | "archived";

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: achievementIntegerMax,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(achievementIntegerMax)
  activeVersion!: number | null;

  @ApiProperty({ format: "date-time" })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsDateString()
  updatedAt!: string;
}
