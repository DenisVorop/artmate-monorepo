import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBlogAuthorRequestDTO {
  @IsString()
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  role?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  avatar?: string | null;

  @IsOptional()
  @IsString()
  image?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;
}
