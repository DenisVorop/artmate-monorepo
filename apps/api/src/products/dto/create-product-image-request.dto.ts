import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProductImageRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  alt?: string;
}
