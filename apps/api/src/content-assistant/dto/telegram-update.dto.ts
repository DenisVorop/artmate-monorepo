import { Allow, IsOptional } from "class-validator";

export class TelegramUpdateDTO {
  @IsOptional()
  @Allow()
  callback_query?: unknown;

  @IsOptional()
  @Allow()
  message?: unknown;
}
