import { IsISO8601, IsString, MaxLength, MinLength } from "class-validator";

export class UploadColoringCollectionCoverRequestDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  alt!: string;

  @IsISO8601()
  updatedAt!: string;
}
