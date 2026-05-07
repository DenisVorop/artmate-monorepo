import { IsDateString, IsEmail, IsOptional, IsString } from "class-validator";

export class AuthEmailVerificationStateDTO {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  emailMasked?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsDateString()
  resendAvailableAt!: string;
}
