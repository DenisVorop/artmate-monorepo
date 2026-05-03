import { IsString, MaxLength } from "class-validator";

export class CreateBlogTagRequestDTO {
  @IsString()
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MaxLength(120)
  title!: string;
}
