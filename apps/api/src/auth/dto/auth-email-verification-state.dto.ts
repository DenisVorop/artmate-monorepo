import { IsDateString, IsOptional, IsString } from "class-validator";

export class AuthEmailVerificationStateDTO {
  @IsString()
  login!: string;

  @IsOptional()
  @IsString()
  emailMasked?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsDateString()
  resendAvailableAt!: string;
}
