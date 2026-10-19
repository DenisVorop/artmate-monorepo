import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateOrderOzonPostingsRequestDTO {
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(/^\d+-\d+-\d+$/, { each: true })
  postingNumbers!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(/^\d+-\d+-\d+$/, { each: true })
  fbsPostingNumbers!: string[];
}
