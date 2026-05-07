import { IsString, MinLength } from "class-validator";

export class ConfirmPasswordResetRequestDTO {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
