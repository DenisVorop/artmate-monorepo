import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class ManualContestDrawRequestDTO {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  rosterToken!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  entryIds!: string[];
}
