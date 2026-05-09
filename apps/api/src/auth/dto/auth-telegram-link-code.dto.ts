import { IsDateString, IsString, Matches } from "class-validator";

export class AuthTelegramLinkCodeDTO {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsDateString()
  expiresAt!: string;
}
