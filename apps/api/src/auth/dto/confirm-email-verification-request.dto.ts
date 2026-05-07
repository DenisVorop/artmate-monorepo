import { IsEmail, IsString, Matches } from "class-validator";

export class ConfirmEmailVerificationRequestDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
