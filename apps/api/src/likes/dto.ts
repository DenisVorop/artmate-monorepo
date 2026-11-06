import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LikeSubjectDTO {
  @ApiProperty({ example: "community-work", maxLength: 64 })
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9-]{0,63}$/)
  subjectType!: string;

  @ApiProperty({
    description: "Stable subject ID (work publicId or blog post id)",
    maxLength: 128,
  })
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/)
  subjectId!: string;
}

export class LikeBatchRequestDTO {
  @ApiProperty({ type: [LikeSubjectDTO], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LikeSubjectDTO)
  subjects!: LikeSubjectDTO[];
}

export class LikeStateDTO extends LikeSubjectDTO {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  count!: number;

  @ApiProperty()
  @IsBoolean()
  viewerHasLiked!: boolean;

  @ApiProperty()
  @IsBoolean()
  canLike!: boolean;
}

export class LikeBatchDTO {
  @ApiProperty({
    type: [LikeStateDTO],
    description: "Unavailable subjects are omitted; duplicates appear once.",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LikeStateDTO)
  items!: LikeStateDTO[];
}
