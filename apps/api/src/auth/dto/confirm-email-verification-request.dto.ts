import { IsString, Matches, MinLength } from "class-validator";

export class ConfirmEmailVerificationRequestDTO {
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
