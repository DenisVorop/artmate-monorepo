import { Type } from "class-transformer";
import { IsBoolean, ValidateNested } from "class-validator";

import { AuthTelegramAccountDTO } from "./auth-telegram-account.dto";

export class AuthTelegramLinkResponseDTO {
  @IsBoolean()
  linked!: true;

  @ValidateNested()
  @Type(() => AuthTelegramAccountDTO)
  account!: AuthTelegramAccountDTO;
}
