import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProductCategoryRequestDTO {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(160)
  slug!: string;

  @IsOptional()
  @IsString()
  image?: string;
}
