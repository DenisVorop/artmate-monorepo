import { IsOptional, IsString, MinLength } from "class-validator";

export class RegisterRequestDTO {
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
