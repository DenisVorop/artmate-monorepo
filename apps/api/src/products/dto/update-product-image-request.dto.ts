import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateProductImageRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  alt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
