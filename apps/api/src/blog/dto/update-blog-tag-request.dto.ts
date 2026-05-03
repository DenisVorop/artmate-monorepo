import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateBlogTagRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
