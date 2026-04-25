import { IsString, MinLength } from "class-validator";

export class LoginRequestDTO {
  @IsString()
  login!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
