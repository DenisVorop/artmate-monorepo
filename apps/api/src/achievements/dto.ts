import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  IsDateString,
  ValidateNested,
} from "class-validator";

const achievementConditionKinds = [
  "published_coloring_count",
  "distinct_collection_count",
  "completed_collection_count",
  "completed_order_count",
] as const;

export class AchievementDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  imageUrl!: string | null;

  @ApiProperty({ enum: achievementConditionKinds })
  @IsIn(achievementConditionKinds)
  conditionKind!: (typeof achievementConditionKinds)[number];

  @ApiProperty()
  @IsInt()
  @Min(1)
  target!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  rewardPoints!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  progress!: number;

  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  earnedAt!: string | null;
}

export class AchievementsDTO {
  @ApiProperty({ type: [AchievementDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AchievementDTO)
  achievements!: AchievementDTO[];
}
