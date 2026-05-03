import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBlogCategoryRequestDTO {
  @IsString()
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
