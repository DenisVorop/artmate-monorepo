import { IsISO8601, IsInt, IsOptional, IsString, Min } from "class-validator";

export class ProductImageDTO {
  @IsString()
  id!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsISO8601()
  createdAt!: string;
}
