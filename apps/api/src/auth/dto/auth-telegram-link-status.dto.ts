import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString, ValidateNested } from "class-validator";

import { AuthTelegramAccountDTO } from "./auth-telegram-account.dto";

export class AuthTelegramLinkStatusDTO {
  @IsBoolean()
  linked!: boolean;

  @IsOptional()
  @IsString()
  botUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuthTelegramAccountDTO)
  account?: AuthTelegramAccountDTO;
}
