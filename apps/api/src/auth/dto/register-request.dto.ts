import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterRequestDTO {
  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  email!: string;
}
